import { Effect } from 'effect';

import type {
  PersistedReusablePersonaRow,
  ReusablePersonaInfrastructureError,
  ReusablePersonaRepositoryService,
  UpdateReusablePersonaCommand,
} from '../../application/use-cases/reusable-personas/reusable-persona-dependencies';
import type { SqlQueryExecutor } from './sql-query-executor';

const repositoryError = (message: string): ReusablePersonaInfrastructureError => ({
  _tag: 'ReusablePersonaInfrastructureError',
  source: 'repository',
  message,
});

const toCauseMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
};

const toPersistedPersonaSelect = `
  SELECT
    id,
    name,
    role,
    system_prompt as systemPrompt,
    gemini_model as geminiModel,
    temperature,
    color,
    hidden_agenda as hiddenAgenda,
    verbosity,
    created_at as createdAt,
    updated_at as updatedAt
  FROM personas
`;

const buildUpdatePersonaStatement = (command: UpdateReusablePersonaCommand): { sql: string; params: readonly unknown[] } => {
  const assignments: string[] = [];
  const params: unknown[] = [];

  if (command.input.name !== undefined) {
    assignments.push('name = ?');
    params.push(command.input.name);
  }
  if (command.input.role !== undefined) {
    assignments.push('role = ?');
    params.push(command.input.role);
  }
  if (command.input.systemPrompt !== undefined) {
    assignments.push('system_prompt = ?');
    params.push(command.input.systemPrompt);
  }
  if (command.input.geminiModel !== undefined) {
    assignments.push('gemini_model = ?');
    params.push(command.input.geminiModel);
  }
  if (command.input.temperature !== undefined) {
    assignments.push('temperature = ?');
    params.push(command.input.temperature);
  }
  if (command.input.color !== undefined) {
    assignments.push('color = ?');
    params.push(command.input.color);
  }
  if (command.input.hiddenAgenda !== undefined) {
    assignments.push('hidden_agenda = ?');
    params.push(command.input.hiddenAgenda ?? null);
  }
  if (command.input.verbosity !== undefined) {
    assignments.push('verbosity = ?');
    params.push(command.input.verbosity ?? null);
  }

  assignments.push('updated_at = ?');
  params.push(command.now);
  params.push(command.id);

  return {
    sql: `UPDATE personas SET ${assignments.join(', ')} WHERE id = ?`,
    params,
  };
};

export const makeReusablePersonaRepositoryFromSqlExecutor = (
  sql: SqlQueryExecutor
): ReusablePersonaRepositoryService => ({
  createPersona: (command) =>
    Effect.tryPromise({
      try: () =>
        sql.run(
          `INSERT INTO personas (id, name, role, system_prompt, gemini_model, temperature, color, hidden_agenda, verbosity, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            command.id,
            command.input.name,
            command.input.role,
            command.input.systemPrompt,
            command.input.geminiModel,
            command.input.temperature,
            command.input.color,
            command.input.hiddenAgenda ?? null,
            command.input.verbosity ?? null,
            command.now,
            command.now,
          ]
        ),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to create persona')),
    }),

  listPersonas: () =>
    Effect.tryPromise({
      try: () => sql.all<PersistedReusablePersonaRow>(`${toPersistedPersonaSelect} ORDER BY created_at DESC`),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to load personas')),
    }),

  getPersonaById: (personaId) =>
    Effect.tryPromise({
      try: () => sql.get<PersistedReusablePersonaRow>(`${toPersistedPersonaSelect} WHERE id = ?`, [personaId]),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to load persona')),
    }),

  updatePersona: (command) =>
    Effect.tryPromise({
      try: () => {
        const statement = buildUpdatePersonaStatement(command);
        return sql.run(statement.sql, statement.params);
      },
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to update persona')),
    }),

  deletePersona: (personaId) =>
    Effect.tryPromise({
      try: () => sql.run('DELETE FROM personas WHERE id = ?', [personaId]),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to delete persona')),
    }),
});
