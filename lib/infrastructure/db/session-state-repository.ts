import { Effect } from 'effect';

import type {
  SessionStateInfrastructureError,
  SessionStateRepositoryService,
  UpdateSessionStateCommand,
} from '../../application/use-cases/session-state/session-state-dependencies';
import type { SqlQueryExecutor } from './sql-query-executor';

const repositoryError = (message: string): SessionStateInfrastructureError => ({
  _tag: 'SessionStateInfrastructureError',
  source: 'repository',
  message,
});

const toCauseMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
};

const buildUpdateSessionStatement = (
  command: UpdateSessionStateCommand
): { sql: string; params: readonly unknown[] } => {
  const assignments: string[] = [];
  const params: unknown[] = [];

  if (command.input.title !== undefined) {
    assignments.push('title = ?');
    params.push(command.input.title);
  }
  if (command.input.problemDescription !== undefined) {
    assignments.push('problem_description = ?');
    params.push(command.input.problemDescription);
  }
  if (command.input.outputGoal !== undefined) {
    assignments.push('output_goal = ?');
    params.push(command.input.outputGoal);
  }
  if (command.input.status !== undefined) {
    assignments.push('status = ?');
    params.push(command.input.status);
  }
  if (command.input.tokenCount !== undefined) {
    assignments.push('token_count = ?');
    params.push(command.input.tokenCount);
  }
  if (command.input.costEstimate !== undefined) {
    assignments.push('cost_estimate = ?');
    params.push(command.input.costEstimate);
  }
  if (command.input.orchestratorEnabled !== undefined) {
    assignments.push('orchestrator_enabled = ?');
    params.push(command.input.orchestratorEnabled ? 1 : 0);
  }
  if (command.input.orchestratorPersonaId !== undefined) {
    assignments.push('orchestrator_persona_id = ?');
    params.push(command.input.orchestratorPersonaId);
  }
  if (command.input.blackboard !== undefined) {
    assignments.push('blackboard = ?');
    params.push(JSON.stringify(command.input.blackboard));
  }
  if (command.input.autoReplyCount !== undefined) {
    assignments.push('auto_reply_count = ?');
    params.push(command.input.autoReplyCount);
  }
  if (command.input.tokenBudget !== undefined) {
    assignments.push('token_budget = ?');
    params.push(command.input.tokenBudget);
  }
  if (command.input.summary !== undefined) {
    assignments.push('summary = ?');
    params.push(command.input.summary);
  }

  assignments.push('updated_at = ?');
  params.push(command.now);
  params.push(command.id);

  return {
    sql: `UPDATE sessions SET ${assignments.join(', ')} WHERE id = ?`,
    params,
  };
};

export const makeSessionStateRepositoryFromSqlExecutor = (
  sql: SqlQueryExecutor
): SessionStateRepositoryService => ({
  createSession: (command) =>
    Effect.tryPromise({
      try: () =>
        sql.run(
          `INSERT INTO sessions (id, title, problem_description, output_goal, status, token_count, cost_estimate, orchestrator_enabled, orchestrator_persona_id, blackboard, auto_reply_count, token_budget, summary, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            command.id,
            command.input.title,
            command.input.problemDescription,
            command.input.outputGoal,
            'active',
            0,
            0,
            command.orchestratorEnabled ? 1 : 0,
            command.orchestratorPersonaId,
            null,
            0,
            100000,
            null,
            command.now,
            command.now,
          ]
        ),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to create session')),
    }),

  updateSession: (command) =>
    Effect.tryPromise({
      try: () => {
        const statement = buildUpdateSessionStatement(command);
        return sql.run(statement.sql, statement.params);
      },
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to update session')),
    }),

  deleteSession: (sessionId) =>
    Effect.tryPromise({
      try: () => sql.run('DELETE FROM sessions WHERE id = ?', [sessionId]),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to delete session')),
    }),

  updateBlackboard: (sessionId, blackboard) =>
    Effect.tryPromise({
      try: () => sql.run('UPDATE sessions SET blackboard = ? WHERE id = ?', [JSON.stringify(blackboard), sessionId]),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to update blackboard')),
    }),

  updateSessionSummary: (sessionId, summary) =>
    Effect.tryPromise({
      try: () => sql.run('UPDATE sessions SET summary = ? WHERE id = ?', [summary, sessionId]),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to update summary')),
    }),

  incrementAutoReplyCount: (sessionId) =>
    Effect.tryPromise({
      try: () => sql.run('UPDATE sessions SET auto_reply_count = auto_reply_count + 1 WHERE id = ?', [sessionId]),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to increment auto-reply count')),
    }),

  readAutoReplyCount: (sessionId) =>
    Effect.tryPromise({
      try: () => sql.get<{ autoReplyCount: number }>('SELECT auto_reply_count as autoReplyCount FROM sessions WHERE id = ?', [sessionId]),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to load auto-reply count')),
    }).pipe(Effect.map((row) => row?.autoReplyCount ?? 0)),

  resetAutoReplyCount: (sessionId) =>
    Effect.tryPromise({
      try: () => sql.run('UPDATE sessions SET auto_reply_count = 0 WHERE id = ?', [sessionId]),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to reset auto-reply count')),
    }),

  enableOrchestrator: (sessionId, orchestratorPersonaId) =>
    Effect.tryPromise({
      try: () =>
        sql.run('UPDATE sessions SET orchestrator_enabled = 1, orchestrator_persona_id = ? WHERE id = ?', [
          orchestratorPersonaId,
          sessionId,
        ]),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to enable orchestrator')),
    }),

  disableOrchestrator: (sessionId) =>
    Effect.tryPromise({
      try: () =>
        sql.run('UPDATE sessions SET orchestrator_enabled = 0, orchestrator_persona_id = NULL WHERE id = ?', [sessionId]),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to disable orchestrator')),
    }),

  archiveSession: (sessionId, archivedAt) =>
    Effect.tryPromise({
      try: () => sql.run('UPDATE sessions SET archived_at = ?, status = ? WHERE id = ?', [archivedAt, 'archived', sessionId]),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to archive session')),
    }),

  unarchiveSession: (sessionId) =>
    Effect.tryPromise({
      try: () => sql.run('UPDATE sessions SET archived_at = NULL, status = ? WHERE id = ?', ['active', sessionId]),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to unarchive session')),
    }),

  isSessionArchived: (sessionId) =>
    Effect.tryPromise({
      try: () => sql.get<{ archivedAt: string | null }>('SELECT archived_at as archivedAt FROM sessions WHERE id = ?', [sessionId]),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to load archived state')),
    }).pipe(Effect.map((row) => row?.archivedAt !== null && row?.archivedAt !== undefined)),
});
