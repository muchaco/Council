import { describe, expect, it } from 'vitest';
import { Effect, Either } from 'effect';

import { makeConductorTurnRepositoryFromSqlExecutor } from './conductor-turn-repository';
import type { SqlQueryExecutor } from './sql-query-executor';

const makeSqlExecutor = (overrides?: Partial<SqlQueryExecutor>): SqlQueryExecutor => ({
  run: async () => undefined,
  get: async () => null,
  all: async () => [],
  ...overrides,
});

describe('conductor_turn_repository_spec', () => {
  it('maps_session_row_to_snapshot_with_parsed_blackboard', async () => {
    const repository = makeConductorTurnRepositoryFromSqlExecutor(
      makeSqlExecutor({
        get: async <TRow>() =>
          ({
            sessionId: 'session-1',
            conductorEnabled: 1,
            conductorPersonaId: 'conductor',
            autoReplyCount: 2,
            tokenCount: 300,
            problemDescription: 'Ship FCIS',
            outputGoal: 'Safe migration',
            blackboard: JSON.stringify({
              consensus: 'roll out incrementally',
              conflicts: 'none',
              nextStep: 'validate adapters',
              facts: 'tests are green',
            }),
          }) as TRow,
      })
    );

    const outcome = await Effect.runPromise(repository.getSession('session-1'));

    expect(outcome).toEqual({
      sessionId: 'session-1',
      conductorEnabled: true,
      conductorPersonaId: 'conductor',
      autoReplyCount: 2,
      tokenCount: 300,
      problemDescription: 'Ship FCIS',
      outputGoal: 'Safe migration',
      blackboard: {
        consensus: 'roll out incrementally',
        conflicts: 'none',
        nextStep: 'validate adapters',
        facts: 'tests are green',
      },
    });
  });

  it('falls_back_to_null_blackboard_when_stored_json_is_invalid', async () => {
    const repository = makeConductorTurnRepositoryFromSqlExecutor(
      makeSqlExecutor({
        get: async <TRow>() =>
          ({
            sessionId: 'session-1',
            conductorEnabled: 1,
            conductorPersonaId: 'conductor',
            autoReplyCount: 0,
            tokenCount: 0,
            problemDescription: 'Ship FCIS',
            outputGoal: 'Safe migration',
            blackboard: '{not-valid-json}',
          }) as TRow,
      })
    );

    const outcome = await Effect.runPromise(repository.getSession('session-1'));
    expect(outcome?.blackboard).toBeNull();
  });

  it('uses_application_generated_message_id_for_intervention_insert', async () => {
    const runCalls: Array<{ sql: string; params: readonly unknown[] }> = [];
    const repository = makeConductorTurnRepositoryFromSqlExecutor(
      makeSqlExecutor({
        run: async (sql, params) => {
          runCalls.push({ sql, params: params ?? [] });
        },
      })
    );

    await Effect.runPromise(
      repository.createInterventionMessage({
        messageId: 'msg-123',
        sessionId: 'session-1',
        personaId: 'conductor',
        content: 'Please refocus on rollout risk.',
        turnNumber: 4,
        selectorReasoning: 'topic drift',
      })
    );

    expect(runCalls).toHaveLength(1);
    expect(runCalls[0].params[0]).toBe('msg-123');
  });

  it('maps_query_failures_to_typed_repository_error', async () => {
    const repository = makeConductorTurnRepositoryFromSqlExecutor(
      makeSqlExecutor({
        get: async () => {
          throw new Error('db unavailable');
        },
      })
    );

    const outcome = await Effect.runPromise(repository.getSession('session-1').pipe(Effect.either));
    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'ConductorInfrastructureError',
        source: 'repository',
        message: 'Failed to load session',
      });
    }
  });
});
