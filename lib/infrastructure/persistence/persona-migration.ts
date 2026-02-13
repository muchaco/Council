import { Effect } from 'effect';

import type { Persona } from '../../core/domain/persona';
import type {
  PersistedReusablePersonaRow,
  ReusablePersonaInfrastructureError,
} from '../../application/use-cases/reusable-personas/reusable-persona-dependencies';

/**
 * Loads a persona from raw database row, applying migration logic transparently.
 *
 * Migration rules:
 * - If persona has modelId and providerId (new format), use them as-is
 * - If persona has geminiModel but no modelId (legacy format), populate modelId from geminiModel and providerId as 'gemini'
 * - geminiModel is kept as-is for backward compatibility
 * - This migration is in-memory only; stored data is not modified
 *
 * @param raw - The raw database row (unknown type for runtime safety)
 * @returns Effect that produces the migrated Persona
 */
export const loadPersona = (
  raw: unknown
): Effect.Effect<Persona, ReusablePersonaInfrastructureError> =>
  Effect.sync(() => {
    const row = raw as PersistedReusablePersonaRow;

    // Determine providerId and modelId with migration logic
    const hasModernFields = row.modelId !== undefined && row.providerId !== undefined;
    const hasLegacyField = row.geminiModel !== undefined && row.geminiModel !== '';

    const providerId = hasModernFields ? row.providerId : hasLegacyField ? 'gemini' : undefined;
    const modelId = hasModernFields ? row.modelId : hasLegacyField ? row.geminiModel : undefined;

    return {
      id: row.id,
      name: row.name,
      role: row.role,
      systemPrompt: row.systemPrompt,
      color: row.color,
      temperature: row.temperature,
      geminiModel: row.geminiModel,
      hiddenAgenda: row.hiddenAgenda ?? undefined,
      verbosity: row.verbosity ?? undefined,
      // Modern provider-agnostic fields (migrated from legacy if needed)
      modelId,
      providerId,
    };
  });

/**
 * Loads multiple personas from raw database rows, applying migration logic to each.
 *
 * @param rows - Array of raw database rows
 * @returns Effect that produces array of migrated Personas
 */
export const loadPersonas = (
  rows: readonly unknown[]
): Effect.Effect<readonly Persona[], ReusablePersonaInfrastructureError> =>
  Effect.all(rows.map((row) => loadPersona(row)));

/**
 * Migration helper that checks if a persona needs migration.
 *
 * @param persona - The persona to check
 * @returns true if the persona is in legacy format (has geminiModel but no modelId)
 */
export const isLegacyPersona = (persona: Persona): boolean => {
  return persona.geminiModel !== undefined && persona.modelId === undefined;
};

/**
 * Migration helper that checks if a persona is in modern format.
 *
 * @param persona - The persona to check
 * @returns true if the persona has modelId and providerId (new format)
 */
export const isModernPersona = (persona: Persona): boolean => {
  return persona.modelId !== undefined && persona.providerId !== undefined;
};
