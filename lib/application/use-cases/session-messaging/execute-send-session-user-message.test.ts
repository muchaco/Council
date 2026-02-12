import { describe, expect, it, vi } from 'vitest';
import { Effect, Either } from 'effect';

import {
  executeSendSessionUserMessage,
  SessionMessagePersistence,
  type SessionMessagePersistenceService,
} from './index';

describe('execute_send_session_user_message_use_case_spec', () => {
  it('persists_user_message_with_backend_turn_number', async () => {
    const getNextTurnNumber = vi.fn(() => Effect.succeed(4));
    const createMessage = vi.fn(() =>
      Effect.succeed({
        id: 'message-4',
        sessionId: 'session-1',
        personaId: null,
        source: 'user' as const,
        content: 'Hello council',
        turnNumber: 4,
        tokenCount: 0,
        metadata: null,
        createdAt: '2026-02-11T10:00:00.000Z',
      })
    );
    const persistence: SessionMessagePersistenceService = {
      getNextTurnNumber,
      createMessage,
      updateSessionUsage: () => Effect.die('not used'),
    };

    const result = await Effect.runPromise(
      executeSendSessionUserMessage({
        sessionId: 'session-1',
        content: 'Hello council',
      }).pipe(Effect.provideService(SessionMessagePersistence, persistence))
    );

    expect(getNextTurnNumber).toHaveBeenCalledWith('session-1');
    expect(createMessage).toHaveBeenCalledWith({
      sessionId: 'session-1',
      personaId: null,
      source: 'user',
      content: 'Hello council',
      turnNumber: 4,
      tokenCount: 0,
    });
    expect(result.turnNumber).toBe(4);
  });

  it('short_circuits_when_next_turn_number_lookup_fails', async () => {
    const getNextTurnNumber = vi.fn(() =>
      Effect.fail({
        _tag: 'SessionMessagingInfrastructureError' as const,
        source: 'messagePersistence' as const,
        message: 'Failed to determine next turn number',
      })
    );
    const createMessage = vi.fn(() =>
      Effect.succeed({
        id: 'message-ignored',
        sessionId: 'session-1',
        personaId: null,
        source: 'user' as const,
        content: 'Hello council',
        turnNumber: 1,
        tokenCount: 0,
        metadata: null,
        createdAt: '2026-02-11T10:00:00.000Z',
      })
    );
    const persistence: SessionMessagePersistenceService = {
      getNextTurnNumber,
      createMessage,
      updateSessionUsage: () => Effect.die('not used'),
    };

    const outcome = await Effect.runPromise(
      executeSendSessionUserMessage({
        sessionId: 'session-1',
        content: 'Hello council',
      }).pipe(Effect.provideService(SessionMessagePersistence, persistence), Effect.either)
    );

    expect(Either.isLeft(outcome)).toBe(true);
    expect(getNextTurnNumber).toHaveBeenCalledTimes(1);
    expect(createMessage).not.toHaveBeenCalled();
  });

  it('propagates_create_message_failure_after_turn_number_resolution', async () => {
    const getNextTurnNumber = vi.fn(() => Effect.succeed(5));
    const createMessage = vi.fn(() =>
      Effect.fail({
        _tag: 'SessionMessagingInfrastructureError' as const,
        source: 'messagePersistence' as const,
        message: 'Failed to persist session message',
      })
    );
    const persistence: SessionMessagePersistenceService = {
      getNextTurnNumber,
      createMessage,
      updateSessionUsage: () => Effect.die('not used'),
    };

    const outcome = await Effect.runPromise(
      executeSendSessionUserMessage({
        sessionId: 'session-1',
        content: 'Hello council',
      }).pipe(Effect.provideService(SessionMessagePersistence, persistence), Effect.either)
    );

    expect(Either.isLeft(outcome)).toBe(true);
    expect(getNextTurnNumber).toHaveBeenCalledWith('session-1');
    expect(createMessage).toHaveBeenCalledWith({
      sessionId: 'session-1',
      personaId: null,
      source: 'user',
      content: 'Hello council',
      turnNumber: 5,
      tokenCount: 0,
    });
  });
});
