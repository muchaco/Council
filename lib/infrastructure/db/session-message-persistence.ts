import { Effect } from 'effect';

import type {
  CreateSessionMessageCommand,
  SessionMessagePersistenceService,
  SessionMessagingInfrastructureError,
} from '../../application/use-cases/session-messaging';
import type { Message, Session } from '../../types';

interface SessionMessageElectronDB {
  readonly getNextTurnNumber: (sessionId: string) => Promise<{ success: boolean; data?: number; error?: string }>;
  readonly createMessage: (
    data: CreateSessionMessageCommand
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

const isBlackboardState = (value: unknown): value is NonNullable<Session['blackboard']> => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.consensus === 'string' &&
    typeof value.conflicts === 'string' &&
    typeof value.nextStep === 'string' &&
    typeof value.facts === 'string'
  );
};

const isSessionStatus = (value: unknown): value is Session['status'] =>
  value === 'active' || value === 'completed' || value === 'archived';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

const isSession = (value: unknown): value is Session => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.problemDescription === 'string' &&
    typeof value.outputGoal === 'string' &&
    isSessionStatus(value.status) &&
    typeof value.tokenCount === 'number' &&
    typeof value.costEstimate === 'number' &&
    typeof value.conductorEnabled === 'boolean' &&
    (typeof value.conductorPersonaId === 'string' || value.conductorPersonaId === null) &&
    (value.blackboard === null || isBlackboardState(value.blackboard)) &&
    typeof value.autoReplyCount === 'number' &&
    typeof value.tokenBudget === 'number' &&
    (typeof value.summary === 'string' || value.summary === null) &&
    (typeof value.archivedAt === 'string' || value.archivedAt === null) &&
    isStringArray(value.tags) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
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

  createMessage: (command) =>
    Effect.tryPromise({
      try: () => electronDB.createMessage(command),
      catch: () => infrastructureError('messagePersistence', 'Failed to persist session message'),
    }).pipe(
      Effect.flatMap((result) => {
        if (!result.success || !isMessage(result.data)) {
          return Effect.fail(
            infrastructureError(
              'messagePersistence',
              result.error ?? (result.success ? 'Invalid session message payload' : 'Failed to persist session message')
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
