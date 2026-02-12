import { describe, expect, it, vi } from 'vitest';
import { Effect, Either } from 'effect';

import type { Session } from '../../../types';
import {
  executeTriggerSessionPersonaResponse,
  SessionMessagePersistence,
  SessionPersonaResponseGateway,
  type SessionMessagePersistenceService,
  type SessionPersonaResponseGatewayService,
} from './index';

const baseSession: Session = {
  id: 'session-1',
  title: 'Session',
  problemDescription: 'Problem',
  outputGoal: 'Goal',
  status: 'active',
  tokenCount: 100,
  costEstimate: 0,
  conductorEnabled: false,
  conductorMode: 'automatic',
  blackboard: null,
  autoReplyCount: 0,
  tokenBudget: 1000,
  summary: null,
  archivedAt: null,
  tags: [],
  createdAt: '2026-02-11T10:00:00.000Z',
  updatedAt: '2026-02-11T10:00:00.000Z',
};

describe('execute_trigger_session_persona_response_use_case_spec', () => {
  it('persists_message_and_updates_session_usage_with_backend_turn_number', async () => {
    const generatePersonaResponse = vi.fn(() =>
      Effect.succeed({
        content: 'Generated response',
        tokenCount: 25,
      })
    );
    const getNextTurnNumber = vi.fn(() => Effect.succeed(11));
    const createMessage = vi.fn(() =>
      Effect.succeed({
        id: 'message-1',
        sessionId: 'session-1',
        personaId: 'persona-1',
        source: 'persona' as const,
        content: 'Generated response',
        turnNumber: 11,
        tokenCount: 25,
        metadata: null,
        createdAt: '2026-02-11T10:00:00.000Z',
      })
    );
    const updateSessionUsage = vi.fn(() =>
      Effect.succeed({
        ...baseSession,
        tokenCount: 125,
        costEstimate: 0.000125,
      })
    );

    const gateway: SessionPersonaResponseGatewayService = {
      generatePersonaResponse,
    };
    const persistence: SessionMessagePersistenceService = {
      getNextTurnNumber,
      createMessage,
      updateSessionUsage,
    };

    const result = await Effect.runPromise(
      executeTriggerSessionPersonaResponse({
        session: baseSession,
        persona: {
          id: 'persona-1',
          name: 'Advisor',
          role: 'Advisor',
          systemPrompt: 'Assist',
          geminiModel: 'gemini-2.0-flash',
          temperature: 0.4,
          color: '#3B82F6',
          hiddenAgenda: undefined,
          verbosity: undefined,
          createdAt: '2026-02-11T10:00:00.000Z',
          updatedAt: '2026-02-11T10:00:00.000Z',
          isConductor: false,
          hushTurnsRemaining: 0,
          hushedAt: null,
        },
        otherPersonas: [],
        blackboard: {
          consensus: '',
          conflicts: '',
          nextStep: '',
          facts: '',
        },
      }).pipe(
        Effect.provideService(SessionPersonaResponseGateway, gateway),
        Effect.provideService(SessionMessagePersistence, persistence)
      )
    );

    expect(generatePersonaResponse).toHaveBeenCalledTimes(1);
    expect(getNextTurnNumber).toHaveBeenCalledWith('session-1');
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({ turnNumber: 11, tokenCount: 25 })
    );
    expect(updateSessionUsage).toHaveBeenCalledWith('session-1', 125, 0.000125);
    expect(result.updatedSession.tokenCount).toBe(125);
  });

  it('short_circuits_before_persistence_when_gateway_fails', async () => {
    const calls: string[] = [];
    const gateway: SessionPersonaResponseGatewayService = {
      generatePersonaResponse: vi.fn(() => {
        calls.push('generatePersonaResponse');
        return Effect.fail({
          _tag: 'SessionMessagingInfrastructureError' as const,
          source: 'llmGateway' as const,
          message: 'LLM unavailable',
        });
      }),
    };
    const persistence: SessionMessagePersistenceService = {
      getNextTurnNumber: vi.fn(() => {
        calls.push('getNextTurnNumber');
        return Effect.succeed(11);
      }),
      createMessage: vi.fn(() => {
        calls.push('createMessage');
        return Effect.die('not reached');
      }),
      updateSessionUsage: vi.fn(() => {
        calls.push('updateSessionUsage');
        return Effect.die('not reached');
      }),
    };

    const outcome = await Effect.runPromise(
      executeTriggerSessionPersonaResponse({
        session: baseSession,
        persona: {
          id: 'persona-1',
          name: 'Advisor',
          role: 'Advisor',
          systemPrompt: 'Assist',
          geminiModel: 'gemini-2.0-flash',
          temperature: 0.4,
          color: '#3B82F6',
          hiddenAgenda: undefined,
          verbosity: undefined,
          createdAt: '2026-02-11T10:00:00.000Z',
          updatedAt: '2026-02-11T10:00:00.000Z',
          isConductor: false,
          hushTurnsRemaining: 0,
          hushedAt: null,
        },
        otherPersonas: [],
        blackboard: {
          consensus: '',
          conflicts: '',
          nextStep: '',
          facts: '',
        },
      }).pipe(
        Effect.provideService(SessionPersonaResponseGateway, gateway),
        Effect.provideService(SessionMessagePersistence, persistence),
        Effect.either
      )
    );

    expect(Either.isLeft(outcome)).toBe(true);
    expect(calls).toEqual(['generatePersonaResponse']);
  });

  it('short_circuits_after_message_persistence_failure_without_updating_session_usage', async () => {
    const calls: string[] = [];
    const gateway: SessionPersonaResponseGatewayService = {
      generatePersonaResponse: vi.fn(() => {
        calls.push('generatePersonaResponse');
        return Effect.succeed({ content: 'Generated response', tokenCount: 25 });
      }),
    };
    const persistence: SessionMessagePersistenceService = {
      getNextTurnNumber: vi.fn(() => {
        calls.push('getNextTurnNumber');
        return Effect.succeed(11);
      }),
      createMessage: vi.fn(() => {
        calls.push('createMessage');
        return Effect.fail({
          _tag: 'SessionMessagingInfrastructureError' as const,
          source: 'messagePersistence' as const,
          message: 'Failed to persist session message',
        });
      }),
      updateSessionUsage: vi.fn(() => {
        calls.push('updateSessionUsage');
        return Effect.die('not reached');
      }),
    };

    const outcome = await Effect.runPromise(
      executeTriggerSessionPersonaResponse({
        session: baseSession,
        persona: {
          id: 'persona-1',
          name: 'Advisor',
          role: 'Advisor',
          systemPrompt: 'Assist',
          geminiModel: 'gemini-2.0-flash',
          temperature: 0.4,
          color: '#3B82F6',
          hiddenAgenda: undefined,
          verbosity: undefined,
          createdAt: '2026-02-11T10:00:00.000Z',
          updatedAt: '2026-02-11T10:00:00.000Z',
          isConductor: false,
          hushTurnsRemaining: 0,
          hushedAt: null,
        },
        otherPersonas: [],
        blackboard: {
          consensus: '',
          conflicts: '',
          nextStep: '',
          facts: '',
        },
      }).pipe(
        Effect.provideService(SessionPersonaResponseGateway, gateway),
        Effect.provideService(SessionMessagePersistence, persistence),
        Effect.either
      )
    );

    expect(Either.isLeft(outcome)).toBe(true);
    expect(calls).toEqual(['generatePersonaResponse', 'getNextTurnNumber', 'createMessage']);
  });

  it('propagates_session_usage_persistence_failure_after_prior_steps', async () => {
    const calls: string[] = [];
    const gateway: SessionPersonaResponseGatewayService = {
      generatePersonaResponse: vi.fn(() => {
        calls.push('generatePersonaResponse');
        return Effect.succeed({ content: 'Generated response', tokenCount: 25 });
      }),
    };
    const persistence: SessionMessagePersistenceService = {
      getNextTurnNumber: vi.fn(() => {
        calls.push('getNextTurnNumber');
        return Effect.succeed(11);
      }),
      createMessage: vi.fn(() => {
        calls.push('createMessage');
        return Effect.succeed({
          id: 'message-1',
          sessionId: 'session-1',
          personaId: 'persona-1',
          source: 'persona' as const,
          content: 'Generated response',
          turnNumber: 11,
          tokenCount: 25,
          metadata: null,
          createdAt: '2026-02-11T10:00:00.000Z',
        });
      }),
      updateSessionUsage: vi.fn(() => {
        calls.push('updateSessionUsage');
        return Effect.fail({
          _tag: 'SessionMessagingInfrastructureError' as const,
          source: 'sessionState' as const,
          message: 'Failed to update session usage',
        });
      }),
    };

    const outcome = await Effect.runPromise(
      executeTriggerSessionPersonaResponse({
        session: baseSession,
        persona: {
          id: 'persona-1',
          name: 'Advisor',
          role: 'Advisor',
          systemPrompt: 'Assist',
          geminiModel: 'gemini-2.0-flash',
          temperature: 0.4,
          color: '#3B82F6',
          hiddenAgenda: undefined,
          verbosity: undefined,
          createdAt: '2026-02-11T10:00:00.000Z',
          updatedAt: '2026-02-11T10:00:00.000Z',
          isConductor: false,
          hushTurnsRemaining: 0,
          hushedAt: null,
        },
        otherPersonas: [],
        blackboard: {
          consensus: '',
          conflicts: '',
          nextStep: '',
          facts: '',
        },
      }).pipe(
        Effect.provideService(SessionPersonaResponseGateway, gateway),
        Effect.provideService(SessionMessagePersistence, persistence),
        Effect.either
      )
    );

    expect(Either.isLeft(outcome)).toBe(true);
    expect(calls).toEqual([
      'generatePersonaResponse',
      'getNextTurnNumber',
      'createMessage',
      'updateSessionUsage',
    ]);
  });
});
