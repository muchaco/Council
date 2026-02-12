import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';

import { Clock, IdGenerator } from '../../runtime';
import {
  ReusablePersonaRepository,
  type CreateReusablePersonaCommand,
  type PersistedReusablePersonaRow,
  type ReusablePersonaRepositoryService,
} from './reusable-persona-dependencies';
import {
  executeCreateReusablePersona,
  executeLoadReusablePersonas,
} from './execute-reusable-persona-commands';

const baseRepository: ReusablePersonaRepositoryService = {
  createPersona: () => Effect.void,
  listPersonas: () => Effect.succeed([]),
  getPersonaById: () => Effect.succeed(null),
  updatePersona: () => Effect.void,
  deletePersona: () => Effect.void,
};

describe('execute_reusable_persona_commands_use_case_spec', () => {
  it('creates_reusable_persona_with_deterministic_runtime_services', async () => {
    const observedCreateCommands: CreateReusablePersonaCommand[] = [];

    const writeCapableRepository: ReusablePersonaRepositoryService = {
      ...baseRepository,
      createPersona: (command) => {
        observedCreateCommands.push(command);
        return Effect.void;
      },
    };

    const persona = await Effect.runPromise(
      executeCreateReusablePersona({
        name: 'Architect',
        role: 'Architecture Lead',
        systemPrompt: 'Balance quality and delivery speed.',
        geminiModel: 'gemini-1.5-pro',
        temperature: 0.6,
        color: '#3B82F6',
        hiddenAgenda: 'Keep boundaries explicit',
        verbosity: 'concise',
      }).pipe(
        Effect.provideService(ReusablePersonaRepository, writeCapableRepository),
        Effect.provideService(IdGenerator, { generate: Effect.succeed('persona-1') }),
        Effect.provideService(Clock, { now: Effect.succeed(new Date('2026-02-10T11:10:00.000Z')) })
      )
    );

    expect(observedCreateCommands).toEqual([
      {
        id: 'persona-1',
        now: '2026-02-10T11:10:00.000Z',
        input: {
          name: 'Architect',
          role: 'Architecture Lead',
          systemPrompt: 'Balance quality and delivery speed.',
          geminiModel: 'gemini-1.5-pro',
          temperature: 0.6,
          color: '#3B82F6',
          hiddenAgenda: 'Keep boundaries explicit',
          verbosity: 'concise',
        },
      },
    ]);
    expect(persona.id).toBe('persona-1');
    expect(persona.createdAt).toBe('2026-02-10T11:10:00.000Z');
    expect(persona.updatedAt).toBe('2026-02-10T11:10:00.000Z');
  });

  it('normalizes_nullable_optional_fields_when_loading_reusable_personas', async () => {
    const persistedRows: readonly PersistedReusablePersonaRow[] = [
      {
        id: 'persona-1',
        name: 'Architect',
        role: 'Architecture Lead',
        systemPrompt: 'Balance quality and delivery speed.',
        geminiModel: 'gemini-1.5-pro',
        temperature: 0.6,
        color: '#3B82F6',
        hiddenAgenda: null,
        verbosity: null,
        createdAt: '2026-02-10T11:10:00.000Z',
        updatedAt: '2026-02-10T11:10:00.000Z',
      },
    ];

    const readCapableRepository: ReusablePersonaRepositoryService = {
      ...baseRepository,
      listPersonas: () => Effect.succeed(persistedRows),
    };

    const personas = await Effect.runPromise(
      executeLoadReusablePersonas().pipe(
        Effect.provideService(ReusablePersonaRepository, readCapableRepository)
      )
    );

    expect(personas).toEqual([
      {
        id: 'persona-1',
        name: 'Architect',
        role: 'Architecture Lead',
        systemPrompt: 'Balance quality and delivery speed.',
        geminiModel: 'gemini-1.5-pro',
        temperature: 0.6,
        color: '#3B82F6',
        hiddenAgenda: undefined,
        verbosity: undefined,
        createdAt: '2026-02-10T11:10:00.000Z',
        updatedAt: '2026-02-10T11:10:00.000Z',
      },
    ]);
  });
});
