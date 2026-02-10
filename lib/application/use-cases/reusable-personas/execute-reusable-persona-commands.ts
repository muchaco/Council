import { Effect } from 'effect';

import { Clock, IdGenerator } from '../../runtime';
import type { Persona, PersonaInput } from '../../../types';
import { mapPersistedReusablePersonaRowToPersona } from './reusable-persona-mapper';
import {
  ReusablePersonaRepository,
  type ReusablePersonaInfrastructureError,
} from './reusable-persona-dependencies';

export const executeCreateReusablePersona = (
  input: PersonaInput
): Effect.Effect<
  Persona,
  ReusablePersonaInfrastructureError,
  ReusablePersonaRepository | IdGenerator | Clock
> =>
  Effect.gen(function* () {
    const repository = yield* ReusablePersonaRepository;
    const idGenerator = yield* IdGenerator;
    const clock = yield* Clock;
    const id = yield* idGenerator.generate;
    const now = (yield* clock.now).toISOString();

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
): Effect.Effect<Persona | null, ReusablePersonaInfrastructureError, ReusablePersonaRepository | Clock> =>
  Effect.gen(function* () {
    const repository = yield* ReusablePersonaRepository;
    const clock = yield* Clock;
    yield* repository.updatePersona({ id: personaId, now: (yield* clock.now).toISOString(), input });

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
