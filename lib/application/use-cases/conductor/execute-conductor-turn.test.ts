import { describe, expect, it } from 'vitest';
import { Effect, Either } from 'effect';

import { IdGenerator } from '../../runtime';
import type {
  ConductorMessageSnapshot,
  ConductorPersonaSnapshot,
  ConductorSessionSnapshot,
} from '../../../core/domain/conductor';
import {
  ConductorSettings,
  ConductorSelectorGateway,
  ConductorTurnRepository,
  executeConductorTurn,
  type ConductorSettingsService,
  type ConductorSelectorGatewayService,
  type ConductorTurnRepositoryService,
} from './index';

const baseSession: ConductorSessionSnapshot = {
  sessionId: 'session-1',
  conductorEnabled: true,
  conductorPersonaId: 'conductor',
  autoReplyCount: 0,
  tokenCount: 0,
  problemDescription: 'Ship migration',
  outputGoal: 'Safe rollout',
  blackboard: { consensus: '', conflicts: '', nextStep: '', facts: '' },
};

const basePersonas: readonly ConductorPersonaSnapshot[] = [
  {
    id: 'conductor',
    name: 'Conductor',
    role: 'System',
    geminiModel: 'gemini-1.5-flash',
    hushTurnsRemaining: 0,
  },
  {
    id: 'speaker-a',
    name: 'Architect',
    role: 'Architecture',
    geminiModel: 'gemini-1.5-pro',
    hushTurnsRemaining: 0,
  },
];

const makeRepository = (options?: {
  session?: ConductorSessionSnapshot;
  personas?: readonly ConductorPersonaSnapshot[];
  messages?: readonly ConductorMessageSnapshot[];
  onUpdateBlackboard?: () => void;
  onCreateIntervention?: () => void;
  onLoadSessionPersonas?: () => void;
  onDecrementHushTurns?: () => void;
  onLoadLastMessages?: () => void;
}): ConductorTurnRepositoryService => ({
  getSession: () => Effect.succeed(options?.session ?? baseSession),
  getSessionPersonas: () => {
    options?.onLoadSessionPersonas?.();
    return Effect.succeed(options?.personas ?? basePersonas);
  },
  decrementAllHushTurns: () => {
    options?.onDecrementHushTurns?.();
    return Effect.void;
  },
  getLastMessages: () => {
    options?.onLoadLastMessages?.();
    return Effect.succeed(options?.messages ?? [{ personaId: null, content: 'prompt' }]);
  },
  updateBlackboard: () => {
    options?.onUpdateBlackboard?.();
    return Effect.void;
  },
  getNextTurnNumber: () => Effect.succeed(3),
  createInterventionMessage: (_input) => {
    options?.onCreateIntervention?.();
    return Effect.void;
  },
  incrementAutoReplyCount: () => Effect.succeed(1),
});

const makeSelectorGateway = (
  service: ConductorSelectorGatewayService['selectNextSpeaker']
): ConductorSelectorGatewayService => ({
  selectNextSpeaker: service,
});

const makeSettings = (
  input?: Partial<{ apiKey: string; temperature: number; maxOutputTokens: number }>
): ConductorSettingsService => ({
  getGeminiApiKey: Effect.succeed(input?.apiKey ?? 'test-api-key'),
  getSelectorGenerationPolicy: Effect.succeed({
    temperature: input?.temperature ?? 0.3,
    maxOutputTokens: input?.maxOutputTokens ?? 2048,
  }),
});

describe('execute_conductor_turn_use_case_spec', () => {
  it('interprets_plans_and_returns_trigger_persona_on_happy_path', async () => {
    const updates: string[] = [];
    const repository = makeRepository({
      session: { ...baseSession, tokenCount: 70_000 },
      onUpdateBlackboard: () => updates.push('blackboard'),
      onCreateIntervention: () => updates.push('intervention'),
      messages: [{ personaId: null, content: 'Please propose next action' }],
    });

    const selectorGateway = makeSelectorGateway(() =>
      Effect.succeed({
        selectedPersonaId: 'speaker-a',
        reasoning: 'Architect should define rollout constraints',
        isIntervention: true,
        interventionMessage: 'Please focus on rollout risks first.',
        updateBlackboard: { nextStep: 'Define rollout constraints' },
      })
    );

    const outcome = await Effect.runPromise(
      executeConductorTurn({ sessionId: 'session-1' }).pipe(
        Effect.provideService(ConductorTurnRepository, repository),
        Effect.provideService(ConductorSelectorGateway, selectorGateway),
        Effect.provideService(ConductorSettings, makeSettings()),
        Effect.provideService(IdGenerator, { generate: Effect.succeed('intervention-message-1') })
      )
    );

    expect(updates).toEqual(['blackboard', 'intervention']);
    expect(outcome).toEqual({
      _tag: 'TriggerPersona',
      personaId: 'speaker-a',
      reasoning: 'Architect should define rollout constraints',
      blackboardUpdate: { nextStep: 'Define rollout constraints' },
      isIntervention: true,
      autoReplyCount: 1,
      warning: 'Warning: Token usage at 70% of budget',
    });
  });

  it('returns_circuit_breaker_stopped_when_auto_reply_limit_is_reached', async () => {
    const repository = makeRepository({
      session: { ...baseSession, autoReplyCount: 8 },
    });

    const selectorGateway = makeSelectorGateway(() =>
      Effect.die('selector should not run when circuit breaker stops')
    );

    const outcome = await Effect.runPromise(
      executeConductorTurn({ sessionId: 'session-1' }).pipe(
        Effect.provideService(ConductorTurnRepository, repository),
        Effect.provideService(ConductorSelectorGateway, selectorGateway),
        Effect.provideService(ConductorSettings, makeSettings()),
        Effect.provideService(IdGenerator, { generate: Effect.succeed('intervention-message-1') })
      )
    );

    expect(outcome).toEqual({
      _tag: 'CircuitBreakerStopped',
      message: 'Circuit breaker: Maximum 8 auto-replies reached. Click continue to proceed.',
    });
  });

  it('returns_wait_for_user_when_no_eligible_speakers_remain', async () => {
    const repository = makeRepository({
      personas: [
        basePersonas[0],
        { ...basePersonas[1], hushTurnsRemaining: 1 },
      ],
      messages: [{ personaId: 'speaker-a', content: 'last response' }],
    });

    const selectorGateway = makeSelectorGateway(() =>
      Effect.die('selector should not run when wait-for-user triggers before selection')
    );

    const outcome = await Effect.runPromise(
      executeConductorTurn({ sessionId: 'session-1' }).pipe(
        Effect.provideService(ConductorTurnRepository, repository),
        Effect.provideService(ConductorSelectorGateway, selectorGateway),
        Effect.provideService(ConductorSettings, makeSettings()),
        Effect.provideService(IdGenerator, { generate: Effect.succeed('intervention-message-1') })
      )
    );

    expect(outcome).toEqual({
      _tag: 'WaitForUser',
      reasoning: 'All personas have spoken. Waiting for user input before next cycle.',
      blackboardUpdate: {},
    });
  });

  it('returns_domain_error_when_persona_set_is_empty', async () => {
    const calls: string[] = [];
    const repository = makeRepository({
      personas: [],
      onLoadSessionPersonas: () => calls.push('personas'),
      onDecrementHushTurns: () => calls.push('decrement-hush'),
      onLoadLastMessages: () => calls.push('messages'),
    });
    const selectorGateway = makeSelectorGateway(() =>
      Effect.die('selector should not run when persona preconditions fail')
    );

    const outcome = await Effect.runPromise(
      executeConductorTurn({ sessionId: 'session-1' }).pipe(
        Effect.provideService(ConductorTurnRepository, repository),
        Effect.provideService(ConductorSelectorGateway, selectorGateway),
        Effect.provideService(ConductorSettings, makeSettings()),
        Effect.provideService(IdGenerator, { generate: Effect.succeed('intervention-message-1') }),
        Effect.either
      )
    );

    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'ConductorNoPersonasError',
        message: 'No personas in session',
      });
    }
    expect(calls).toEqual(['personas']);
  });

  it('returns_domain_error_when_conductor_persona_is_missing', async () => {
    const repository = makeRepository({
      session: { ...baseSession, conductorPersonaId: 'missing-conductor' },
      personas: [basePersonas[1]],
    });
    const selectorGateway = makeSelectorGateway(() =>
      Effect.die('selector should not run when conductor preconditions fail')
    );

    const outcome = await Effect.runPromise(
      executeConductorTurn({ sessionId: 'session-1' }).pipe(
        Effect.provideService(ConductorTurnRepository, repository),
        Effect.provideService(ConductorSelectorGateway, selectorGateway),
        Effect.provideService(ConductorSettings, makeSettings()),
        Effect.provideService(IdGenerator, { generate: Effect.succeed('intervention-message-1') }),
        Effect.either
      )
    );

    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'ConductorPersonaMissingError',
        message: 'Conductor persona not found',
      });
    }
  });

  it('returns_typed_domain_error_when_selector_picks_unknown_persona', async () => {
    const repository = makeRepository();
    const selectorGateway = makeSelectorGateway(() =>
      Effect.succeed({
        selectedPersonaId: 'unknown-speaker',
        reasoning: 'unknown speaker selected',
        isIntervention: false,
        updateBlackboard: {},
      })
    );

    const outcome = await Effect.runPromise(
      executeConductorTurn({ sessionId: 'session-1' }).pipe(
        Effect.provideService(ConductorTurnRepository, repository),
        Effect.provideService(ConductorSelectorGateway, selectorGateway),
        Effect.provideService(ConductorSettings, makeSettings()),
        Effect.provideService(IdGenerator, { generate: Effect.succeed('intervention-message-1') }),
        Effect.either
      )
    );

    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'ConductorSelectedPersonaNotFoundError',
        message: 'Selected persona unknown-speaker not found',
      });
    }
  });

  it('maps_selector_gateway_failure_to_typed_infrastructure_error', async () => {
    const repository = makeRepository();
    const selectorGateway = makeSelectorGateway(() =>
      Effect.fail({
        _tag: 'ConductorInfrastructureError',
        source: 'selector',
        code: 'ExecutionFailed',
        message: 'Selector agent failed: timeout',
      })
    );

    const outcome = await Effect.runPromise(
      executeConductorTurn({ sessionId: 'session-1' }).pipe(
        Effect.provideService(ConductorTurnRepository, repository),
        Effect.provideService(ConductorSelectorGateway, selectorGateway),
        Effect.provideService(ConductorSettings, makeSettings()),
        Effect.provideService(IdGenerator, { generate: Effect.succeed('intervention-message-1') }),
        Effect.either
      )
    );

    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'ConductorInfrastructureError',
        source: 'selector',
        code: 'ExecutionFailed',
        message: 'Selector agent failed: timeout',
      });
    }
  });
});
