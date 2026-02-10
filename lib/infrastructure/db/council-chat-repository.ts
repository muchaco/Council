import { Effect } from 'effect';

import type {
  CouncilChatInfrastructureError,
  CouncilChatRepositoryService,
} from '../../application/use-cases/council-chat/council-chat-dependencies';
import type { SqlQueryExecutor } from './sql-query-executor';

const repositoryError = (message: string): CouncilChatInfrastructureError => ({
  _tag: 'CouncilChatInfrastructureError',
  source: 'repository',
  code: 'QueryFailed',
  message,
});

const toCauseMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallbackMessage;
};

interface CouncilChatPersonaRow {
  readonly id: string;
  readonly name: string;
  readonly role: string;
}

interface CouncilChatMessageRow {
  readonly personaId: string | null;
  readonly content: string;
}

export const makeCouncilChatRepositoryFromSqlExecutor = (
  sql: SqlQueryExecutor
): CouncilChatRepositoryService => ({
  getSessionPersonas: (sessionId) =>
    Effect.tryPromise({
      try: () =>
        sql.all<CouncilChatPersonaRow>(
          `SELECT
            p.id,
            p.name,
            p.role
           FROM personas p
           JOIN session_personas sp ON p.id = sp.persona_id
           WHERE sp.session_id = ?
           ORDER BY p.name`,
          [sessionId]
        ),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to load session personas')),
    }),

  getRecentMessages: (sessionId, limit) =>
    Effect.tryPromise({
      try: () =>
        sql.all<CouncilChatMessageRow>(
          `SELECT
            persona_id as personaId,
            content
           FROM messages
           WHERE session_id = ?
           ORDER BY turn_number DESC, created_at DESC
           LIMIT ?`,
          [sessionId, limit]
        ),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to load recent messages')),
    }).pipe(Effect.map((messages) => [...messages].reverse())),
});
