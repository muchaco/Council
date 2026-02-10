import type { Persona } from '../../../types';

import type { PersistedReusablePersonaRow } from './reusable-persona-dependencies';

export const mapPersistedReusablePersonaRowToPersona = (
  row: PersistedReusablePersonaRow
): Persona => ({
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
});
