import { describe, expect, it } from 'vitest';
import { Effect, Either } from 'effect';

import { makeSessionMessagePersistenceFromElectronDB } from './session-message-persistence';

const validUpdatedSession = {
  id: 'session-1',
  title: 'Session',
  problemDescription: 'Problem',
  outputGoal: 'Goal',
  status: 'active',
  tokenCount: 10,
  costEstimate: 0.00001,
  conductorEnabled: false,
  conductorPersonaId: null,
  blackboard: null,
  autoReplyCount: 0,
  tokenBudget: 1000,
  summary: null,
  archivedAt: null,
  tags: [],
  createdAt: '2026-02-11T10:00:00.000Z',
  updatedAt: '2026-02-11T10:00:00.000Z',
} as const;

describe('session_message_persistence_spec', () => {
  it('loads_next_turn_number_from_transport', async () => {
    const persistence = makeSessionMessagePersistenceFromElectronDB({
      getNextTurnNumber: async () => ({ success: true, data: 9 }),
      createMessage: async () => ({ success: true, data: undefined }),
      updateSession: async () => ({ success: true, data: validUpdatedSession }),
    });

    const turnNumber = await Effect.runPromise(persistence.getNextTurnNumber('session-1'));
    expect(turnNumber).toBe(9);
  });

  it('fails_when_message_payload_is_invalid', async () => {
    const persistence = makeSessionMessagePersistenceFromElectronDB({
      getNextTurnNumber: async () => ({ success: true, data: 1 }),
      createMessage: async () => ({ success: true, data: { id: 1 } }),
      updateSession: async () => ({ success: true, data: validUpdatedSession }),
    });

    const outcome = await Effect.runPromise(
      persistence
        .createMessage({
          sessionId: 'session-1',
          personaId: null,
          content: 'hello',
          turnNumber: 1,
          tokenCount: 0,
        })
        .pipe(Effect.either)
    );

    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left.message).toBe('Invalid session message payload');
    }
  });

  it('maps_transport_failure_to_typed_error_when_loading_next_turn_number', async () => {
    const persistence = makeSessionMessagePersistenceFromElectronDB({
      getNextTurnNumber: async () => ({ success: false, error: 'turn read failed' }),
      createMessage: async () => ({ success: true, data: undefined }),
      updateSession: async () => ({ success: true, data: validUpdatedSession }),
    });

    const outcome = await Effect.runPromise(persistence.getNextTurnNumber('session-1').pipe(Effect.either));
    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'SessionMessagingInfrastructureError',
        source: 'messagePersistence',
        message: 'turn read failed',
      });
    }
  });

  it('maps_thrown_exception_to_typed_error_when_persisting_message', async () => {
    const persistence = makeSessionMessagePersistenceFromElectronDB({
      getNextTurnNumber: async () => ({ success: true, data: 1 }),
      createMessage: async () => {
        throw new Error('sqlite unavailable');
      },
      updateSession: async () => ({ success: true, data: validUpdatedSession }),
    });

    const outcome = await Effect.runPromise(
      persistence
        .createMessage({
          sessionId: 'session-1',
          personaId: null,
          content: 'hello',
          turnNumber: 1,
          tokenCount: 0,
        })
        .pipe(Effect.either)
    );

    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'SessionMessagingInfrastructureError',
        source: 'messagePersistence',
        message: 'Failed to persist session message',
      });
    }
  });

  it('rejects_updated_session_payload_when_required_fields_are_missing', async () => {
    const persistence = makeSessionMessagePersistenceFromElectronDB({
      getNextTurnNumber: async () => ({ success: true, data: 1 }),
      createMessage: async () => ({ success: true, data: undefined }),
      updateSession: async () => ({
        success: true,
        data: {
          id: 'session-1',
          title: 'Session',
          problemDescription: 'Problem',
          outputGoal: 'Goal',
          tokenCount: 12,
          costEstimate: 0.000012,
          tags: [],
        },
      }),
    });

    const outcome = await Effect.runPromise(
      persistence.updateSessionUsage('session-1', 12, 0.000012).pipe(Effect.either)
    );

    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'SessionMessagingInfrastructureError',
        source: 'sessionState',
        message: 'Invalid updated session payload',
      });
    }
  });
});
