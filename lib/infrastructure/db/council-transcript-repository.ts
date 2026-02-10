import { Effect } from 'effect';

import type {
  CouncilTranscriptInfrastructureError,
  CouncilTranscriptRepositoryService,
  PersistedCouncilTranscriptMessageRow,
} from '../../application/use-cases/council-transcript/council-transcript-dependencies';
import type { SqlQueryExecutor } from './sql-query-executor';

const repositoryError = (message: string): CouncilTranscriptInfrastructureError => ({
  _tag: 'CouncilTranscriptInfrastructureError',
  source: 'repository',
  message,
});

const toCauseMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallbackMessage;
};

export const makeCouncilTranscriptRepositoryFromSqlExecutor = (
  sql: SqlQueryExecutor
): CouncilTranscriptRepositoryService => ({
  createMessage: (command) =>
    Effect.tryPromise({
      try: () =>
        sql.run(
          `INSERT INTO messages (id, session_id, persona_id, content, turn_number, token_count, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            command.id,
            command.sessionId,
            command.personaId,
            command.content,
            command.turnNumber,
            command.tokenCount,
            command.metadata ? JSON.stringify(command.metadata) : null,
            command.now,
          ]
        ),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to create message')),
    }),

  listMessagesBySession: (sessionId) =>
    Effect.tryPromise({
      try: () =>
        sql.all<PersistedCouncilTranscriptMessageRow>(
          `SELECT
            id,
            session_id as sessionId,
            persona_id as personaId,
            content,
            turn_number as turnNumber,
            token_count as tokenCount,
            metadata,
            created_at as createdAt
          FROM messages
          WHERE session_id = ?
          ORDER BY turn_number ASC, created_at ASC`,
          [sessionId]
        ),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to load session transcript')),
    }),

  listRecentMessagesBySession: (sessionId, limit) =>
    Effect.tryPromise({
      try: () =>
        sql.all<PersistedCouncilTranscriptMessageRow>(
          `SELECT
            id,
            session_id as sessionId,
            persona_id as personaId,
            content,
            turn_number as turnNumber,
            token_count as tokenCount,
            metadata,
            created_at as createdAt
          FROM messages
          WHERE session_id = ?
          ORDER BY turn_number DESC, created_at DESC
          LIMIT ?`,
          [sessionId, limit]
        ),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to load recent session messages')),
    }),

  readMaxTurnNumber: (sessionId) =>
    Effect.tryPromise({
      try: () =>
        sql.get<{ maxTurn: number | null }>(
          `SELECT MAX(turn_number) as maxTurn
           FROM messages
           WHERE session_id = ?`,
          [sessionId]
        ),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to load max turn number')),
    }).pipe(Effect.map((row) => row?.maxTurn ?? 0)),
});
