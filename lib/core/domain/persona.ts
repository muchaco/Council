/**
 * Persona domain model
 * 
 * Represents a persona (AI participant) in a Council session.
 * Includes provider-agnostic model references for multi-LLM support.
 */

export interface Persona {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly systemPrompt: string;
  readonly color: string;
  readonly avatar?: string;
  readonly isActive?: boolean;
  
  // NEW: Provider-agnostic model reference
  readonly modelId?: string;
  readonly providerId?: string;
  
  // DEPRECATED: Keep for migration, mark as optional
  readonly geminiModel?: string;
}

/**
 * Migrates a legacy persona (using geminiModel) to the new provider-agnostic format.
 * 
 * @param persona - The persona to migrate (unknown type for runtime safety)
 * @returns Persona with modelId and providerId populated from legacy fields if needed
 */
export const migratePersona = (persona: unknown): Persona => {
  const p = persona as Persona;
  return {
    ...p,
    modelId: p.modelId ?? p.geminiModel,
    providerId: p.providerId ?? 'gemini',
  };
};
