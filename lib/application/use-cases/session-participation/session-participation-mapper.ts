import type {
  PersistedSessionParticipantRow,
  SessionParticipantProfile,
} from './session-participation-dependencies';

export const mapPersistedSessionParticipantRowToSessionPersona = (
  row: PersistedSessionParticipantRow
): SessionParticipantProfile => ({
  id: row.id,
  name: row.name,
  role: row.role,
  systemPrompt: row.systemPrompt,
  geminiModel: row.geminiModel,
  temperature: row.temperature,
  color: row.color,
  hiddenAgenda: row.hiddenAgenda,
  verbosity: row.verbosity,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  isOrchestrator: Boolean(row.isOrchestrator),
  hushTurnsRemaining: row.hushTurnsRemaining ?? 0,
  hushedAt: row.hushedAt ?? null,
});
