import { Effect } from 'effect';

import type {
  SessionMessagePersistenceService,
  SessionMessagingInfrastructureError,
  TriggerSessionPersonaResponseMessageCommand,
} from '../../application/use-cases/session-messaging';
import type { Message, Session } from '../../types';

interface SessionMessageElectronDB {
  readonly getNextTurnNumber: (sessionId: string) => Promise<{ success: boolean; data?: number; error?: string }>;
  readonly createMessage: (
    data: TriggerSessionPersonaResponseMessageCommand
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  readonly updateSession: (
    sessionId: string,
    data: { tokenCount: number; costEstimate: number }
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
}

const infrastructureError = (
  source: SessionMessagingInfrastructureError['source'],
  message: string
): SessionMessagingInfrastructureError => ({
  _tag: 'SessionMessagingInfrastructureError',
  source,
  message,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isMessage = (value: unknown): value is Message => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.sessionId === 'string' &&
    (typeof value.personaId === 'string' || value.personaId === null) &&
    typeof value.content === 'string' &&
    typeof value.turnNumber === 'number' &&
    typeof value.tokenCount === 'number' &&
    typeof value.createdAt === 'string'
  );
};

const isSession = (value: unknown): value is Session => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.problemDescription === 'string' &&
    typeof value.outputGoal === 'string' &&
    typeof value.tokenCount === 'number' &&
    typeof value.costEstimate === 'number' &&
    Array.isArray(value.tags)
  );
};

export const makeSessionMessagePersistenceFromElectronDB = (
  electronDB: SessionMessageElectronDB
): SessionMessagePersistenceService => ({
  getNextTurnNumber: (sessionId) =>
    Effect.tryPromise({
      try: () => electronDB.getNextTurnNumber(sessionId),
      catch: () => infrastructureError('messagePersistence', 'Failed to determine next turn number'),
    }).pipe(
      Effect.flatMap((result) => {
        if (!result.success || typeof result.data !== 'number') {
          return Effect.fail(
            infrastructureError('messagePersistence', result.error ?? 'Failed to determine next turn number')
          );
        }

        return Effect.succeed(result.data);
      })
    ),

  createPersonaMessage: (command) =>
    Effect.tryPromise({
      try: () => electronDB.createMessage(command),
      catch: () => infrastructureError('messagePersistence', 'Failed to persist persona message'),
    }).pipe(
      Effect.flatMap((result) => {
        if (!result.success || !isMessage(result.data)) {
          return Effect.fail(
            infrastructureError(
              'messagePersistence',
              result.error ?? (result.success ? 'Invalid persona message payload' : 'Failed to persist persona message')
            )
          );
        }

        return Effect.succeed(result.data);
      })
    ),

  updateSessionUsage: (sessionId, tokenCount, costEstimate) =>
    Effect.tryPromise({
      try: () => electronDB.updateSession(sessionId, { tokenCount, costEstimate }),
      catch: () => infrastructureError('sessionState', 'Failed to update session usage'),
    }).pipe(
      Effect.flatMap((result) => {
        if (!result.success || !isSession(result.data)) {
          return Effect.fail(
            infrastructureError(
              'sessionState',
              result.error ?? (result.success ? 'Invalid updated session payload' : 'Failed to update session usage')
            )
          );
        }

        return Effect.succeed(result.data);
      })
    ),
});
