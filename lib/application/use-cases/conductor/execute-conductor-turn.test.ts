import { describe, expect, it } from 'vitest';
import { Effect, Either } from 'effect';

import type {
  ConductorMessageSnapshot,
  ConductorPersonaSnapshot,
  ConductorSessionSnapshot,
} from '../../../core/domain/conductor';
import {
  ConductorSelectorGateway,
  ConductorTurnRepository,
  executeConductorTurn,
  type ConductorSelectorGatewayService,
  type ConductorTurnRepositoryService,
} from './index';

const baseSession: ConductorSessionSnapshot = {
  sessionId: 'session-1',
  orchestratorEnabled: true,
  orchestratorPersonaId: 'conductor',
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
}): ConductorTurnRepositoryService => ({
  getSession: () => Effect.succeed(options?.session ?? baseSession),
  getSessionPersonas: () => Effect.succeed(options?.personas ?? basePersonas),
  decrementAllHushTurns: () => Effect.void,
  getLastMessages: () => Effect.succeed(options?.messages ?? [{ personaId: null, content: 'prompt' }]),
  updateBlackboard: () => {
    options?.onUpdateBlackboard?.();
    return Effect.void;
  },
  getNextTurnNumber: () => Effect.succeed(3),
  createInterventionMessage: () => {
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
        Effect.provideService(ConductorSelectorGateway, selectorGateway)
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
        Effect.provideService(ConductorSelectorGateway, selectorGateway)
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
        Effect.provideService(ConductorSelectorGateway, selectorGateway)
      )
    );

    expect(outcome).toEqual({
      _tag: 'WaitForUser',
      reasoning: 'All personas have spoken. Waiting for user input before next cycle.',
      blackboardUpdate: {},
    });
  });

  it('returns_domain_error_when_persona_set_is_empty', async () => {
    const repository = makeRepository({ personas: [] });
    const selectorGateway = makeSelectorGateway(() =>
      Effect.die('selector should not run when persona preconditions fail')
    );

    const outcome = await Effect.runPromise(
      executeConductorTurn({ sessionId: 'session-1' }).pipe(
        Effect.provideService(ConductorTurnRepository, repository),
        Effect.provideService(ConductorSelectorGateway, selectorGateway),
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
  });

  it('returns_domain_error_when_orchestrator_persona_is_missing', async () => {
    const repository = makeRepository({
      session: { ...baseSession, orchestratorPersonaId: 'missing-conductor' },
      personas: [basePersonas[1]],
    });
    const selectorGateway = makeSelectorGateway(() =>
      Effect.die('selector should not run when conductor preconditions fail')
    );

    const outcome = await Effect.runPromise(
      executeConductorTurn({ sessionId: 'session-1' }).pipe(
        Effect.provideService(ConductorTurnRepository, repository),
        Effect.provideService(ConductorSelectorGateway, selectorGateway),
        Effect.either
      )
    );

    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'ConductorPersonaMissingError',
        message: 'Orchestrator persona not found',
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
        message: 'Selector agent failed: timeout',
      })
    );

    const outcome = await Effect.runPromise(
      executeConductorTurn({ sessionId: 'session-1' }).pipe(
        Effect.provideService(ConductorTurnRepository, repository),
        Effect.provideService(ConductorSelectorGateway, selectorGateway),
        Effect.either
      )
    );

    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'ConductorInfrastructureError',
        source: 'selector',
        message: 'Selector agent failed: timeout',
      });
    }
  });
});
