import type { Session } from '../../../types';

import type { PersistedSessionSnapshotRow } from './query-layer-dependencies';

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isSessionBlackboard = (value: unknown): value is NonNullable<Session['blackboard']> => {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.consensus === 'string' &&
    typeof value.conflicts === 'string' &&
    typeof value.nextStep === 'string' &&
    typeof value.facts === 'string'
  );
};

const parseBlackboard = (serializedBlackboard: string | null): Session['blackboard'] => {
  if (serializedBlackboard === null || serializedBlackboard.trim().length === 0) {
    return null;
  }

  try {
    const parsedBlackboard = JSON.parse(serializedBlackboard) as unknown;
    return isSessionBlackboard(parsedBlackboard) ? parsedBlackboard : null;
  } catch {
    return null;
  }
};

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
  conductorMode: row.conductorMode ?? 'automatic',
  blackboard: parseBlackboard(row.blackboard),
  autoReplyCount: row.autoReplyCount,
  tokenBudget: row.tokenBudget,
  summary: row.summary,
  archivedAt: row.archivedAt ?? null,
  tags: [...tags],
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
