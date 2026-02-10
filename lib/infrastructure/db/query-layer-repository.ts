import { Effect } from 'effect';

import type {
  PersistedSessionSnapshotRow,
  QueryLayerInfrastructureError,
  QueryLayerRepositoryService,
  SessionTagNameRow,
} from '../../application/use-cases/query-layer/query-layer-dependencies';
import type { SqlQueryExecutor } from './sql-query-executor';

const repositoryError = (message: string): QueryLayerInfrastructureError => ({
  _tag: 'QueryLayerInfrastructureError',
  source: 'repository',
  message,
});

const toCauseMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
};

export const makeQueryLayerRepositoryFromSqlExecutor = (
  sql: SqlQueryExecutor
): QueryLayerRepositoryService => ({
  listSessions: () =>
    Effect.tryPromise({
      try: () =>
        sql.all<PersistedSessionSnapshotRow>(
          `SELECT
            id,
            title,
            problem_description as problemDescription,
            output_goal as outputGoal,
            status,
            token_count as tokenCount,
            cost_estimate as costEstimate,
            orchestrator_enabled as orchestratorEnabled,
            orchestrator_persona_id as orchestratorPersonaId,
            blackboard,
            auto_reply_count as autoReplyCount,
            token_budget as tokenBudget,
            summary,
            archived_at as archivedAt,
            created_at as createdAt,
            updated_at as updatedAt
          FROM sessions
          ORDER BY updated_at DESC`
        ),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to load sessions')),
    }),

  getSessionById: (sessionId) =>
    Effect.tryPromise({
      try: () =>
        sql.get<PersistedSessionSnapshotRow>(
          `SELECT
            id,
            title,
            problem_description as problemDescription,
            output_goal as outputGoal,
            status,
            token_count as tokenCount,
            cost_estimate as costEstimate,
            orchestrator_enabled as orchestratorEnabled,
            orchestrator_persona_id as orchestratorPersonaId,
            blackboard,
            auto_reply_count as autoReplyCount,
            token_budget as tokenBudget,
            summary,
            archived_at as archivedAt,
            created_at as createdAt,
            updated_at as updatedAt
          FROM sessions
          WHERE id = ?`,
          [sessionId]
        ),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to load session')),
    }),

  listSessionTagNamesBySessionIds: (sessionIds) =>
    Effect.tryPromise({
      try: () => {
        if (sessionIds.length === 0) {
          return Promise.resolve([] as readonly SessionTagNameRow[]);
        }

        const placeholders = sessionIds.map(() => '?').join(',');
        return sql.all<SessionTagNameRow>(
          `SELECT st.session_id as sessionId, t.name as tagName
           FROM session_tags st
           JOIN tags t ON st.tag_id = t.id
           WHERE st.session_id IN (${placeholders})
           ORDER BY st.created_at ASC`,
          sessionIds
        );
      },
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to load session tags')),
    }),

  listSessionTagNames: (sessionId) =>
    Effect.tryPromise({
      try: () =>
        sql
          .all<{ name: string }>(
            `SELECT t.name
             FROM tags t
             JOIN session_tags st ON t.id = st.tag_id
             WHERE st.session_id = ?
             ORDER BY st.created_at ASC`,
            [sessionId]
          )
          .then((rows) => rows.map((row) => row.name)),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to load session tags')),
    }),
});
