import { Context, Effect } from 'effect';

import type { Session } from '../../../types';

export interface PersistedSessionSnapshotRow {
  readonly id: string;
  readonly title: string;
  readonly problemDescription: string;
  readonly outputGoal: string;
  readonly status: Session['status'];
  readonly tokenCount: number;
  readonly costEstimate: number;
  readonly conductorEnabled: number | boolean;
  readonly conductorMode: 'automatic' | 'manual' | null;
  readonly blackboard: string | null;
  readonly autoReplyCount: number;
  readonly tokenBudget: number;
  readonly summary: string | null;
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SessionTagNameRow {
  readonly sessionId: string;
  readonly tagName: string;
}

export interface QueryLayerInfrastructureError {
  readonly _tag: 'QueryLayerInfrastructureError';
  readonly source: 'repository';
  readonly message: string;
}

export interface QueryLayerRepositoryService {
  readonly listSessions: () => Effect.Effect<readonly PersistedSessionSnapshotRow[], QueryLayerInfrastructureError>;
  readonly getSessionById: (
    sessionId: string
  ) => Effect.Effect<PersistedSessionSnapshotRow | null, QueryLayerInfrastructureError>;
  readonly listSessionTagNamesBySessionIds: (
    sessionIds: readonly string[]
  ) => Effect.Effect<readonly SessionTagNameRow[], QueryLayerInfrastructureError>;
  readonly listSessionTagNames: (
    sessionId: string
  ) => Effect.Effect<readonly string[], QueryLayerInfrastructureError>;
}

export class QueryLayerRepository extends Context.Tag('QueryLayerRepository')<
  QueryLayerRepository,
  QueryLayerRepositoryService
>() {}
