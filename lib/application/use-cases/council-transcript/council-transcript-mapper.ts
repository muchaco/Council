import type { Message, MessageMetadata } from '../../../types';

import type { PersistedCouncilTranscriptMessageRow } from './council-transcript-dependencies';

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isMessageMetadata = (value: unknown): value is MessageMetadata => {
  if (!isObjectRecord(value)) {
    return false;
  }

  if ('isIntervention' in value && typeof value.isIntervention !== 'boolean') {
    return false;
  }

  if ('driftDetected' in value && typeof value.driftDetected !== 'boolean') {
    return false;
  }

  if ('selectorReasoning' in value && typeof value.selectorReasoning !== 'string') {
    return false;
  }

  if ('isConductorMessage' in value && typeof value.isConductorMessage !== 'boolean') {
    return false;
  }

  return true;
};

const parseMessageMetadata = (serializedMetadata: string | null): MessageMetadata | null => {
  if (serializedMetadata === null || serializedMetadata.trim().length === 0) {
    return null;
  }

  try {
    const parsedMetadata = JSON.parse(serializedMetadata) as unknown;
    return isMessageMetadata(parsedMetadata) ? parsedMetadata : null;
  } catch {
    return null;
  }
};

export const mapPersistedCouncilTranscriptMessageRowToMessage = (
  row: PersistedCouncilTranscriptMessageRow
): Message => ({
  id: row.id,
  sessionId: row.sessionId,
  personaId: row.personaId,
  content: row.content,
  turnNumber: row.turnNumber,
  tokenCount: row.tokenCount,
  metadata: parseMessageMetadata(row.metadata),
  createdAt: row.createdAt,
});
