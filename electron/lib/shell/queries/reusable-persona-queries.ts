import type { Persona, PersonaInput } from '../../types.js';
import {
  executeCreateReusablePersona,
  executeDeleteReusablePersona,
  executeLoadReusablePersonaById,
  executeLoadReusablePersonas,
  executeUpdateReusablePersona,
} from '../../../../lib/application/use-cases';
import { runReusablePersona } from './context.js';

export async function createPersona(data: PersonaInput): Promise<Persona> {
  return runReusablePersona(executeCreateReusablePersona(data));
}

export async function getPersonas(): Promise<Persona[]> {
  return runReusablePersona(executeLoadReusablePersonas());
}

export async function getPersona(id: string): Promise<Persona | null> {
  return runReusablePersona(executeLoadReusablePersonaById(id));
}

export async function updatePersona(id: string, data: Partial<PersonaInput>): Promise<Persona> {
  const updated = await runReusablePersona(executeUpdateReusablePersona(id, data));

  if (!updated) {
    throw new Error('Persona not found after update');
  }

  return updated;
}

export async function deletePersona(id: string): Promise<void> {
  await runReusablePersona(executeDeleteReusablePersona(id));
}
