import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';

import { executeLoadSessionById } from './execute-load-session-by-id';
import {
  QueryLayerRepository,
  type PersistedSessionSnapshotRow,
  type QueryLayerRepositoryService,
} from './query-layer-dependencies';
import { executeLoadSessions } from './execute-load-sessions';

const baseSessionRow: PersistedSessionSnapshotRow = {
  id: 'session-1',
  title: 'Migration plan',
  problemDescription: 'Move query layer to FCIS',
  outputGoal: 'Keep runtime behavior stable',
  status: 'active',
  tokenCount: 42,
  costEstimate: 0.12,
  conductorEnabled: 1,
  conductorPersonaId: 'persona-1',
  blackboard: JSON.stringify({ consensus: 'agreed', conflicts: '', nextStep: 'ship', facts: 'none' }),
  autoReplyCount: 2,
  tokenBudget: 100_000,
  summary: null,
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T01:00:00.000Z',
};

const makeRepository = (overrides?: Partial<QueryLayerRepositoryService>): QueryLayerRepositoryService => ({
  listSessions: () => Effect.succeed([baseSessionRow]),
  getSessionById: () => Effect.succeed(baseSessionRow),
  listSessionTagNamesBySessionIds: () =>
    Effect.succeed([
      { sessionId: 'session-1', tagName: 'phase-3' },
      { sessionId: 'session-1', tagName: 'fcis' },
    ]),
  listSessionTagNames: () => Effect.succeed(['phase-3', 'fcis']),
  ...overrides,
});

describe('execute_query_layer_session_reads_use_case_spec', () => {
  it('loads_sessions_with_attached_tag_names', async () => {
    const repository = makeRepository();

    const sessions = await Effect.runPromise(
      executeLoadSessions().pipe(Effect.provideService(QueryLayerRepository, repository))
    );

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.id).toBe('session-1');
    expect(sessions[0]?.conductorEnabled).toBe(true);
    expect(sessions[0]?.tags).toEqual(['phase-3', 'fcis']);
    expect(sessions[0]?.blackboard?.nextStep).toBe('ship');
  });

  it('loads_single_session_by_id_with_tags', async () => {
    const repository = makeRepository();

    const session = await Effect.runPromise(
      executeLoadSessionById('session-1').pipe(
        Effect.provideService(QueryLayerRepository, repository)
      )
    );

    expect(session?.id).toBe('session-1');
    expect(session?.tags).toEqual(['phase-3', 'fcis']);
  });

  it('returns_null_when_session_is_missing', async () => {
    const repository = makeRepository({ getSessionById: () => Effect.succeed(null) });

    const session = await Effect.runPromise(
      executeLoadSessionById('missing').pipe(
        Effect.provideService(QueryLayerRepository, repository)
      )
    );

    expect(session).toBeNull();
  });

  it('maps_malformed_blackboard_payload_to_null_without_throwing', async () => {
    const repository = makeRepository({
      listSessions: () =>
        Effect.succeed([
          {
            ...baseSessionRow,
            blackboard: '{"consensus":',
          },
        ]),
    });

    const sessions = await Effect.runPromise(
      executeLoadSessions().pipe(Effect.provideService(QueryLayerRepository, repository))
    );

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.blackboard).toBeNull();
  });
});
