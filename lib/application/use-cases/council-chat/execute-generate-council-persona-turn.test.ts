import { describe, expect, it } from 'vitest';
import { Effect, Either } from 'effect';

import type {
  CouncilChatGatewayService,
  CouncilChatRepositoryService,
  CouncilChatSettingsService,
} from './council-chat-dependencies';
import {
  CouncilChatGateway,
  CouncilChatRepository,
  CouncilChatSettings,
  executeGenerateCouncilPersonaTurn,
} from './index';

const input = {
  request: {
    personaId: 'persona-1',
    sessionId: 'session-1',
    model: 'gemini-1.5-pro',
    systemPrompt: 'Be concise.',
    hiddenAgenda: 'Favor incremental migration',
    verbosity: 'brief',
    temperature: 0.5,
    problemContext: 'How do we migrate safely?',
    outputGoal: 'Produce a rollout plan',
    blackboard: {
      consensus: 'behavior parity first',
      conflicts: '',
      nextStep: 'decompose query layer',
      facts: 'phases 1-2 done',
    },
    otherPersonas: [{ id: 'persona-2', name: 'Architect', role: 'Architecture Lead' }],
  },
};

const repository: CouncilChatRepositoryService = {
  getSessionPersonas: () =>
    Effect.succeed([
      { id: 'persona-1', name: 'Operator', role: 'Migration Operator' },
      { id: 'persona-2', name: 'Architect', role: 'Architecture Lead' },
    ]),
  getRecentMessages: () =>
    Effect.succeed([
      { personaId: null, content: 'Need a safe migration path.' },
      { personaId: 'persona-2', content: 'Start with query decomposition.' },
    ]),
};

const settings: CouncilChatSettingsService = {
  getGeminiApiKey: Effect.succeed('test-api-key'),
  getGenerationPolicy: Effect.succeed({ maxOutputTokens: 1024, defaultHistoryLimit: 12 }),
};

describe('execute_generate_council_persona_turn_use_case_spec', () => {
  it('generates_persona_turn_and_estimates_tokens', async () => {
    const observedGatewayCommands: Array<{ apiKey: string; maxOutputTokens: number }> = [];
    const observedHistoryLimits: number[] = [];
    const observedRepository: CouncilChatRepositoryService = {
      ...repository,
      getRecentMessages: (_sessionId, limit) => {
        observedHistoryLimits.push(limit);
        return Effect.succeed([
          { personaId: null, content: 'Need a safe migration path.' },
          { personaId: 'persona-2', content: 'Start with query decomposition.' },
        ]);
      },
    };
    const gateway: CouncilChatGatewayService = {
      generateCouncilPersonaTurn: (command) => {
        observedGatewayCommands.push({
          apiKey: command.apiKey,
          maxOutputTokens: command.maxOutputTokens,
        });
        return Effect.succeed('Ship phase 3 first, then isolate LLM pipeline.');
      },
    };

    const outcome = await Effect.runPromise(
      executeGenerateCouncilPersonaTurn(input).pipe(
        Effect.provideService(CouncilChatRepository, observedRepository),
        Effect.provideService(CouncilChatGateway, gateway),
        Effect.provideService(CouncilChatSettings, settings)
      )
    );

    expect(outcome.content).toBe('Ship phase 3 first, then isolate LLM pipeline.');
    expect(outcome.tokenCount).toBe(Math.ceil(outcome.content.length / 4));
    expect(observedHistoryLimits).toEqual([12]);
    expect(observedGatewayCommands).toEqual([{ apiKey: 'test-api-key', maxOutputTokens: 1024 }]);
  });

  it('returns_typed_domain_error_when_persona_is_missing', async () => {
    let recentMessagesRequested = false;
    const missingPersonaRepository: CouncilChatRepositoryService = {
      ...repository,
      getSessionPersonas: () => Effect.succeed([{ id: 'persona-2', name: 'Architect', role: 'Architecture Lead' }]),
      getRecentMessages: () => {
        recentMessagesRequested = true;
        return Effect.succeed([]);
      },
    };

    const gateway: CouncilChatGatewayService = {
      generateCouncilPersonaTurn: () => Effect.die('gateway should not run when persona precondition fails'),
    };

    const outcome = await Effect.runPromise(
      executeGenerateCouncilPersonaTurn(input).pipe(
        Effect.provideService(CouncilChatRepository, missingPersonaRepository),
        Effect.provideService(CouncilChatGateway, gateway),
        Effect.provideService(CouncilChatSettings, settings),
        Effect.either
      )
    );

    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'CouncilChatPersonaNotFoundError',
        message: 'Persona not found in session',
      });
    }
    expect(recentMessagesRequested).toBe(false);
  });

  it('prioritizes_settings_error_before_repository_reads', async () => {
    let personasRequested = false;
    const observedRepository: CouncilChatRepositoryService = {
      ...repository,
      getSessionPersonas: () => {
        personasRequested = true;
        return Effect.succeed([]);
      },
    };

    const failingSettings: CouncilChatSettingsService = {
      getGeminiApiKey: Effect.fail({
        _tag: 'CouncilChatInfrastructureError',
        source: 'settings',
        code: 'ApiKeyMissing',
        message: 'API key not configured',
      }),
      getGenerationPolicy: Effect.succeed({ maxOutputTokens: 1024, defaultHistoryLimit: 12 }),
    };

    const gateway: CouncilChatGatewayService = {
      generateCouncilPersonaTurn: () => Effect.die('gateway should not run when settings fail'),
    };

    const outcome = await Effect.runPromise(
      executeGenerateCouncilPersonaTurn(input).pipe(
        Effect.provideService(CouncilChatRepository, observedRepository),
        Effect.provideService(CouncilChatGateway, gateway),
        Effect.provideService(CouncilChatSettings, failingSettings),
        Effect.either
      )
    );

    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'CouncilChatInfrastructureError',
        source: 'settings',
        code: 'ApiKeyMissing',
        message: 'API key not configured',
      });
    }
    expect(personasRequested).toBe(false);
  });
});
