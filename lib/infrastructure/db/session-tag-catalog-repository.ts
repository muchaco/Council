import { Effect } from 'effect';

import type {
  SessionTagCatalogEntry,
  SessionTagCatalogInfrastructureError,
  SessionTagCatalogRepositoryService,
} from '../../application/use-cases/session-tag-catalog/session-tag-catalog-dependencies';
import type { SqlQueryExecutor } from './sql-query-executor';

const repositoryError = (message: string): SessionTagCatalogInfrastructureError => ({
  _tag: 'SessionTagCatalogInfrastructureError',
  source: 'repository',
  message,
});

const toCauseMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallbackMessage;
};

export const makeSessionTagCatalogRepositoryFromSqlExecutor = (
  sql: SqlQueryExecutor
): SessionTagCatalogRepositoryService => ({
  createTag: (command) =>
    Effect.tryPromise({
      try: () => sql.run('INSERT INTO tags (name, created_at) VALUES (?, ?)', [command.name, command.createdAt]),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to create tag')),
    }),

  getTagByName: (name) =>
    Effect.tryPromise({
      try: () => sql.get<SessionTagCatalogEntry>('SELECT id, name, created_at as createdAt FROM tags WHERE name = ?', [name]),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to load tag by name')),
    }),

  listActiveTags: () =>
    Effect.tryPromise({
      try: () =>
        sql.all<SessionTagCatalogEntry>(
          `SELECT t.id, t.name, t.created_at as createdAt
           FROM tags t
           INNER JOIN session_tags st ON t.id = st.tag_id
           GROUP BY t.id, t.name, t.created_at
           ORDER BY t.name ASC`
        ),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to load tags')),
    }),

  deleteTag: (tagId) =>
    Effect.tryPromise({
      try: () => sql.run('DELETE FROM tags WHERE id = ?', [tagId]),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to delete tag')),
    }),

  addTagToSession: (sessionId, tagId) =>
    Effect.tryPromise({
      try: () =>
        sql.run(
          `INSERT INTO session_tags (session_id, tag_id) VALUES (?, ?)
           ON CONFLICT(session_id, tag_id) DO NOTHING`,
          [sessionId, tagId]
        ),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to add tag to session')),
    }),

  removeTagFromSession: (sessionId, tagId) =>
    Effect.tryPromise({
      try: () => sql.run('DELETE FROM session_tags WHERE session_id = ? AND tag_id = ?', [sessionId, tagId]),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to remove tag from session')),
    }),

  listTagNamesBySession: (sessionId) =>
    Effect.tryPromise({
      try: () =>
        sql.all<{ name: string }>(
          `SELECT t.name
           FROM tags t
           JOIN session_tags st ON t.id = st.tag_id
           WHERE st.session_id = ?
           ORDER BY st.created_at ASC`,
          [sessionId]
        ),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to load session tags')),
    }).pipe(Effect.map((rows) => rows.map((row) => row.name))),

  cleanupOrphanedTags: () =>
    Effect.tryPromise({
      try: () =>
        sql.run(
          `DELETE FROM tags
           WHERE id NOT IN (SELECT DISTINCT tag_id FROM session_tags)`
        ),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to cleanup orphaned tags')),
    }).pipe(Effect.as(0)),
});
