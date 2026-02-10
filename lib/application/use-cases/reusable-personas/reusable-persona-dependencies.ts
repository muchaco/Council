import { Context, Effect } from 'effect';

import type { PersonaInput } from '../../../types';

export interface PersistedReusablePersonaRow {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly systemPrompt: string;
  readonly geminiModel: string;
  readonly temperature: number;
  readonly color: string;
  readonly hiddenAgenda: string | undefined;
  readonly verbosity: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ReusablePersonaInfrastructureError {
  readonly _tag: 'ReusablePersonaInfrastructureError';
  readonly source: 'repository';
  readonly message: string;
}

export interface CreateReusablePersonaCommand {
  readonly id: string;
  readonly now: string;
  readonly input: PersonaInput;
}

export interface UpdateReusablePersonaCommand {
  readonly id: string;
  readonly now: string;
  readonly input: Partial<PersonaInput>;
}

export interface ReusablePersonaRepositoryService {
  readonly createPersona: (
    command: CreateReusablePersonaCommand
  ) => Effect.Effect<void, ReusablePersonaInfrastructureError>;
  readonly listPersonas: () => Effect.Effect<readonly PersistedReusablePersonaRow[], ReusablePersonaInfrastructureError>;
  readonly getPersonaById: (
    personaId: string
  ) => Effect.Effect<PersistedReusablePersonaRow | null, ReusablePersonaInfrastructureError>;
  readonly updatePersona: (
    command: UpdateReusablePersonaCommand
  ) => Effect.Effect<void, ReusablePersonaInfrastructureError>;
  readonly deletePersona: (personaId: string) => Effect.Effect<void, ReusablePersonaInfrastructureError>;
}

export class ReusablePersonaRepository extends Context.Tag('ReusablePersonaRepository')<
  ReusablePersonaRepository,
  ReusablePersonaRepositoryService
>() {}
