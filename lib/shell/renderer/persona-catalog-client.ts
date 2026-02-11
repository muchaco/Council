import type { Persona, PersonaInput } from '../../types';

interface PersonaCatalogElectronDB {
  readonly getPersonas: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
  readonly createPersona: (input: PersonaInput) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  readonly updatePersona: (
    personaId: string,
    input: Partial<PersonaInput>
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  readonly deletePersona: (personaId: string) => Promise<{ success: boolean; error?: string }>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isPersona = (value: unknown): value is Persona => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.role === 'string' &&
    typeof value.systemPrompt === 'string' &&
    typeof value.geminiModel === 'string' &&
    typeof value.temperature === 'number' &&
    typeof value.color === 'string' &&
    (value.hiddenAgenda === undefined || typeof value.hiddenAgenda === 'string') &&
    (value.verbosity === undefined || typeof value.verbosity === 'string') &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
};

const parsePersonaList = (value: unknown): Persona[] => {
  if (!Array.isArray(value) || !value.every(isPersona)) {
    throw new Error('Invalid persona catalog payload');
  }

  return value;
};

const parsePersona = (value: unknown): Persona => {
  if (!isPersona(value)) {
    throw new Error('Invalid persona payload');
  }

  return value;
};

export const loadPersonaCatalog = async (electronDB: PersonaCatalogElectronDB): Promise<Persona[]> => {
  const result = await electronDB.getPersonas();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch personas');
  }

  if (!Array.isArray(result.data)) {
    throw new Error('Invalid persona catalog payload');
  }

  return parsePersonaList(result.data);
};

export const createPersonaCatalogEntry = async (
  electronDB: PersonaCatalogElectronDB,
  input: PersonaInput
): Promise<Persona> => {
  const result = await electronDB.createPersona(input);
  if (!result.success) {
    throw new Error(result.error || 'Failed to create persona');
  }

  return parsePersona(result.data);
};

export const updatePersonaCatalogEntry = async (
  electronDB: PersonaCatalogElectronDB,
  personaId: string,
  input: Partial<PersonaInput>
): Promise<Persona> => {
  const result = await electronDB.updatePersona(personaId, input);
  if (!result.success) {
    throw new Error(result.error || 'Failed to update persona');
  }

  return parsePersona(result.data);
};

export const deletePersonaCatalogEntry = async (
  electronDB: PersonaCatalogElectronDB,
  personaId: string
): Promise<void> => {
  const result = await electronDB.deletePersona(personaId);
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete persona');
  }
};
