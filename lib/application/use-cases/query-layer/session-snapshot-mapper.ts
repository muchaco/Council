import type { Session } from '../../../types';

import type { PersistedSessionSnapshotRow } from './query-layer-dependencies';

const parseBlackboard = (serializedBlackboard: string | null): Session['blackboard'] =>
  serializedBlackboard ? (JSON.parse(serializedBlackboard) as Session['blackboard']) : null;

export const mapPersistedSessionSnapshotRowToSession = (
  row: PersistedSessionSnapshotRow,
  tags: readonly string[]
): Session => ({
  id: row.id,
  title: row.title,
  problemDescription: row.problemDescription,
  outputGoal: row.outputGoal,
  status: row.status,
  tokenCount: row.tokenCount,
  costEstimate: row.costEstimate,
  conductorEnabled: Boolean(row.conductorEnabled),
  conductorPersonaId: row.conductorPersonaId,
  blackboard: parseBlackboard(row.blackboard),
  autoReplyCount: row.autoReplyCount,
  tokenBudget: row.tokenBudget,
  summary: row.summary,
  archivedAt: row.archivedAt ?? null,
  tags: [...tags],
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
