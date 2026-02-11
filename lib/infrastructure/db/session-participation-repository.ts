import { Effect } from 'effect';

import type {
  PersistedSessionParticipantRow,
  SessionParticipationInfrastructureError,
  SessionParticipationRepositoryService,
} from '../../application/use-cases/session-participation/session-participation-dependencies';
import type { SqlQueryExecutor } from './sql-query-executor';

const repositoryError = (message: string): SessionParticipationInfrastructureError => ({
  _tag: 'SessionParticipationInfrastructureError',
  source: 'repository',
  message,
});

const toCauseMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallbackMessage;
};

export const makeSessionParticipationRepositoryFromSqlExecutor = (
  sql: SqlQueryExecutor
): SessionParticipationRepositoryService => ({
  addSessionParticipant: (sessionId, personaId, isConductor) =>
    Effect.tryPromise({
      try: () =>
        sql.run(
          `INSERT INTO session_personas (session_id, persona_id, is_orchestrator)
           VALUES (?, ?, ?)
           ON CONFLICT(session_id, persona_id) DO UPDATE SET is_orchestrator = excluded.is_orchestrator`,
          [sessionId, personaId, isConductor ? 1 : 0]
        ),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to add persona to session')),
    }),

  listSessionParticipants: (sessionId) =>
    Effect.tryPromise({
      try: () =>
        sql.all<PersistedSessionParticipantRow>(
          `SELECT
            p.id,
            p.name,
            p.role,
            p.system_prompt as systemPrompt,
            p.gemini_model as geminiModel,
            p.temperature,
            p.color,
            p.hidden_agenda as hiddenAgenda,
            p.verbosity,
            p.created_at as createdAt,
            p.updated_at as updatedAt,
            sp.is_orchestrator as isConductor,
            sp.hush_turns_remaining as hushTurnsRemaining,
            sp.hushed_at as hushedAt
          FROM personas p
          JOIN session_personas sp ON p.id = sp.persona_id
          WHERE sp.session_id = ?
          ORDER BY p.name`,
          [sessionId]
        ),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to load session personas')),
    }),

  setParticipantHush: (command) =>
    Effect.tryPromise({
      try: () =>
        sql.run(
          `UPDATE session_personas
           SET hush_turns_remaining = ?, hushed_at = ?
           WHERE session_id = ? AND persona_id = ?`,
          [command.turns, command.hushedAt, command.sessionId, command.personaId]
        ),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to hush persona')),
    }),

  decrementParticipantHush: (sessionId, personaId) =>
    Effect.tryPromise({
      try: () =>
        sql.run(
          `UPDATE session_personas
           SET hush_turns_remaining = MAX(0, hush_turns_remaining - 1)
           WHERE session_id = ? AND persona_id = ? AND hush_turns_remaining > 0`,
          [sessionId, personaId]
        ),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to decrement hush turns')),
    }),

  readParticipantHushTurns: (sessionId, personaId) =>
    Effect.tryPromise({
      try: () =>
        sql.get<{ hushTurnsRemaining: number }>(
          `SELECT hush_turns_remaining as hushTurnsRemaining
           FROM session_personas
           WHERE session_id = ? AND persona_id = ?`,
          [sessionId, personaId]
        ),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to read hush turns')),
    }).pipe(Effect.map((row) => row?.hushTurnsRemaining ?? 0)),

  clearParticipantHush: (sessionId, personaId) =>
    Effect.tryPromise({
      try: () =>
        sql.run(
          `UPDATE session_personas
           SET hush_turns_remaining = 0, hushed_at = NULL
           WHERE session_id = ? AND persona_id = ?`,
          [sessionId, personaId]
        ),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to clear hush turns')),
    }),

  decrementAllParticipantHushTurns: (sessionId) =>
    Effect.tryPromise({
      try: () =>
        sql.run(
          `UPDATE session_personas
           SET hush_turns_remaining = MAX(0, hush_turns_remaining - 1)
           WHERE session_id = ? AND hush_turns_remaining > 0`,
          [sessionId]
        ),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to decrement all hush turns')),
    }),

  listHushedParticipantIds: (sessionId) =>
    Effect.tryPromise({
      try: () =>
        sql.all<{ personaId: string }>(
          `SELECT persona_id as personaId
           FROM session_personas
           WHERE session_id = ? AND hush_turns_remaining > 0`,
          [sessionId]
        ),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to load hushed personas')),
    }).pipe(Effect.map((rows) => rows.map((row) => row.personaId))),

  removeSessionParticipant: (sessionId, personaId) =>
    Effect.tryPromise({
      try: () => sql.run('DELETE FROM session_personas WHERE session_id = ? AND persona_id = ?', [sessionId, personaId]),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to remove persona from session')),
    }),
});
