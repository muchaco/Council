import type { Persona, PersonaInput } from '../../types';
import { parsePersonaPayload, parsePersonaPayloadList } from '../../boundary/persona-payload-parser';

interface PersonaCatalogElectronDB {
  readonly getPersonas: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
  readonly createPersona: (input: PersonaInput) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  readonly updatePersona: (
    personaId: string,
    input: Partial<PersonaInput>
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  readonly deletePersona: (personaId: string) => Promise<{ success: boolean; error?: string }>;
}

const parsePersonaList = (value: unknown): Persona[] => {
  const parsed = parsePersonaPayloadList(value);
  if (parsed === null) {
    throw new Error('Invalid persona catalog payload');
  }

  return parsed;
};

const parsePersona = (value: unknown): Persona => {
  const parsed = parsePersonaPayload(value);
  if (parsed === null) {
    throw new Error('Invalid persona payload');
  }

  return parsed;
};

export const loadPersonaCatalog = async (electronDB: PersonaCatalogElectronDB): Promise<Persona[]> => {
  const result = await electronDB.getPersonas();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch personas');
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
