import type { Message, MessageMetadata } from '../../../types';

import type { PersistedCouncilTranscriptMessageRow } from './council-transcript-dependencies';

const parseMessageMetadata = (serializedMetadata: string | null): MessageMetadata | null =>
  serializedMetadata ? (JSON.parse(serializedMetadata) as MessageMetadata) : null;

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
