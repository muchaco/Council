import { Effect } from 'effect';

import type {
  ConductorTurnRepositoryService,
  ConductorInfrastructureError,
} from '../../application/use-cases/conductor/conductor-dependencies';
import type {
  ConductorBlackboard,
  ConductorMessageSnapshot,
  ConductorPersonaSnapshot,
  ConductorSessionSnapshot,
} from '../../core/domain/conductor';
import type { SqlQueryExecutor } from './sql-query-executor';

const repositoryError = (message: string): ConductorInfrastructureError => ({
  _tag: 'ConductorInfrastructureError',
  source: 'repository',
  message,
});

interface ConductorSessionRow {
  readonly sessionId: string;
  readonly conductorEnabled: number;
  readonly conductorPersonaId: string | null;
  readonly autoReplyCount: number;
  readonly tokenCount: number;
  readonly problemDescription: string;
  readonly outputGoal: string;
  readonly blackboard: string | null;
}

interface ConductorPersonaRow {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly geminiModel: string;
  readonly hushTurnsRemaining: number;
}

interface ConductorMessageRow {
  readonly personaId: string | null;
  readonly content: string;
}

const parseConductorBlackboard = (value: string | null): ConductorBlackboard | null => {
  if (value === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<ConductorBlackboard>;
    if (
      typeof parsed.consensus !== 'string' ||
      typeof parsed.conflicts !== 'string' ||
      typeof parsed.nextStep !== 'string' ||
      typeof parsed.facts !== 'string'
    ) {
      return null;
    }

    return {
      consensus: parsed.consensus,
      conflicts: parsed.conflicts,
      nextStep: parsed.nextStep,
      facts: parsed.facts,
    };
  } catch {
    return null;
  }
};

const mapSessionRowToSnapshot = (
  row: ConductorSessionRow | null
): ConductorSessionSnapshot | null => {
  if (row === null) {
    return null;
  }

  return {
    sessionId: row.sessionId,
    conductorEnabled: Boolean(row.conductorEnabled),
    conductorPersonaId: row.conductorPersonaId,
    autoReplyCount: row.autoReplyCount,
    tokenCount: row.tokenCount,
    problemDescription: row.problemDescription,
    outputGoal: row.outputGoal,
    blackboard: parseConductorBlackboard(row.blackboard),
  };
};

export const makeConductorTurnRepositoryFromSqlExecutor = (
  sql: SqlQueryExecutor
): ConductorTurnRepositoryService => ({
  getSession: (sessionId) =>
    Effect.tryPromise({
      try: () =>
        sql.get<ConductorSessionRow>(
          `SELECT
            id as sessionId,
            orchestrator_enabled as conductorEnabled,
            orchestrator_persona_id as conductorPersonaId,
            auto_reply_count as autoReplyCount,
            token_count as tokenCount,
            problem_description as problemDescription,
            output_goal as outputGoal,
            blackboard
           FROM sessions
           WHERE id = ?`,
          [sessionId]
        ),
      catch: () => repositoryError('Failed to load session'),
    }).pipe(Effect.map(mapSessionRowToSnapshot)),

  getSessionPersonas: (sessionId) =>
    Effect.tryPromise({
      try: () =>
        sql.all<ConductorPersonaRow>(
          `SELECT
            p.id,
            p.name,
            p.role,
            p.gemini_model as geminiModel,
            sp.hush_turns_remaining as hushTurnsRemaining
           FROM personas p
           JOIN session_personas sp ON p.id = sp.persona_id
           WHERE sp.session_id = ?
           ORDER BY p.name`,
          [sessionId]
        ),
      catch: () => repositoryError('Failed to load session personas'),
    }),

  decrementAllHushTurns: (sessionId) =>
    Effect.tryPromise({
      try: () =>
        sql.run(
          `UPDATE session_personas
           SET hush_turns_remaining = MAX(0, hush_turns_remaining - 1)
           WHERE session_id = ? AND hush_turns_remaining > 0`,
          [sessionId]
        ),
      catch: () => repositoryError('Failed to decrement hush turns'),
    }),

  getLastMessages: (sessionId, limit) =>
    Effect.tryPromise({
      try: () =>
        sql.all<ConductorMessageRow>(
          `SELECT
            persona_id as personaId,
            content
           FROM messages
           WHERE session_id = ?
           ORDER BY turn_number DESC, created_at DESC
           LIMIT ?`,
          [sessionId, limit]
        ),
      catch: () => repositoryError('Failed to load recent messages'),
    }).pipe(Effect.map((rows) => [...rows].reverse())),

  updateBlackboard: (sessionId, blackboard) =>
    Effect.tryPromise({
      try: () =>
        sql.run('UPDATE sessions SET blackboard = ? WHERE id = ?', [
          JSON.stringify(blackboard),
          sessionId,
        ]),
      catch: () => repositoryError('Failed to update blackboard'),
    }),

  getNextTurnNumber: (sessionId) =>
    Effect.tryPromise({
      try: () =>
        sql.get<{ maxTurn: number | null }>(
          `SELECT MAX(turn_number) as maxTurn
           FROM messages
           WHERE session_id = ?`,
          [sessionId]
        ),
      catch: () => repositoryError('Failed to load next turn number'),
    }).pipe(Effect.map((row) => (row?.maxTurn ?? 0) + 1)),

  createInterventionMessage: (input) =>
    Effect.tryPromise({
      try: () =>
        sql.run(
          `INSERT INTO messages (
             id,
             session_id,
             persona_id,
             content,
             turn_number,
             token_count,
             metadata
           ) VALUES (
             ?,
             ?,
             ?,
             ?,
             ?,
             0,
             ?
           )`,
          [
            input.messageId,
            input.sessionId,
            input.personaId,
            input.content,
            input.turnNumber,
            JSON.stringify({
              isIntervention: true,
              selectorReasoning: input.selectorReasoning,
            }),
          ]
        ),
      catch: () => repositoryError('Failed to create intervention message'),
    }),

  incrementAutoReplyCount: (sessionId) =>
    Effect.tryPromise({
      try: () =>
        sql.run('UPDATE sessions SET auto_reply_count = auto_reply_count + 1 WHERE id = ?', [sessionId]),
      catch: () => repositoryError('Failed to increment auto-reply count'),
    }).pipe(
      Effect.flatMap(() =>
        Effect.tryPromise({
          try: () =>
            sql.get<{ autoReplyCount: number }>(
              'SELECT auto_reply_count as autoReplyCount FROM sessions WHERE id = ?',
              [sessionId]
            ),
          catch: () => repositoryError('Failed to read auto-reply count'),
        })
      ),
      Effect.map((row) => row?.autoReplyCount ?? 0)
    ),
});
