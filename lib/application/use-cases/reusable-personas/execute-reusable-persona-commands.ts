import { Effect } from 'effect';

import type { Persona, PersonaInput } from '../../../types';
import { mapPersistedReusablePersonaRowToPersona } from './reusable-persona-mapper';
import {
  ReusablePersonaRepository,
  type ReusablePersonaInfrastructureError,
} from './reusable-persona-dependencies';

const createId = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const randomValue = (Math.random() * 16) | 0;
    const value = token === 'x' ? randomValue : (randomValue & 0x3) | 0x8;
    return value.toString(16);
  });

const nowIso = (): string => new Date().toISOString();

export const executeCreateReusablePersona = (
  input: PersonaInput
): Effect.Effect<Persona, ReusablePersonaInfrastructureError, ReusablePersonaRepository> =>
  Effect.gen(function* () {
    const repository = yield* ReusablePersonaRepository;
    const id = createId();
    const now = nowIso();

    yield* repository.createPersona({ id, now, input });

    return {
      id,
      name: input.name,
      role: input.role,
      systemPrompt: input.systemPrompt,
      geminiModel: input.geminiModel,
      temperature: input.temperature,
      color: input.color,
      hiddenAgenda: input.hiddenAgenda,
      verbosity: input.verbosity,
      createdAt: now,
      updatedAt: now,
    };
  });

export const executeLoadReusablePersonas = (): Effect.Effect<
  Persona[],
  ReusablePersonaInfrastructureError,
  ReusablePersonaRepository
> =>
  Effect.gen(function* () {
    const repository = yield* ReusablePersonaRepository;
    const rows = yield* repository.listPersonas();
    return rows.map(mapPersistedReusablePersonaRowToPersona);
  });

export const executeLoadReusablePersonaById = (
  personaId: string
): Effect.Effect<Persona | null, ReusablePersonaInfrastructureError, ReusablePersonaRepository> =>
  Effect.gen(function* () {
    const repository = yield* ReusablePersonaRepository;
    const row = yield* repository.getPersonaById(personaId);
    return row ? mapPersistedReusablePersonaRowToPersona(row) : null;
  });

export const executeUpdateReusablePersona = (
  personaId: string,
  input: Partial<PersonaInput>
): Effect.Effect<Persona | null, ReusablePersonaInfrastructureError, ReusablePersonaRepository> =>
  Effect.gen(function* () {
    const repository = yield* ReusablePersonaRepository;
    yield* repository.updatePersona({ id: personaId, now: nowIso(), input });

    const row = yield* repository.getPersonaById(personaId);
    return row ? mapPersistedReusablePersonaRowToPersona(row) : null;
  });

export const executeDeleteReusablePersona = (
  personaId: string
): Effect.Effect<void, ReusablePersonaInfrastructureError, ReusablePersonaRepository> =>
  Effect.gen(function* () {
    const repository = yield* ReusablePersonaRepository;
    yield* repository.deletePersona(personaId);
  });
