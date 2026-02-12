import { z } from 'zod';

import * as queries from '../lib/queries.js';
import {
  DB_MUTATION_RATE_LIMIT,
  dbIpcMain,
  mapDatabaseFailure,
  personaIdSchema,
  personaInputSchema,
} from './db-handler-shared.js';

export function setupPersonaHandlers(): void {
  dbIpcMain.handle(
    'db:persona:create',
    async (_, data) => {
      try {
        const result = await queries.createPersona(data);
        return { success: true, data: result };
      } catch (error) {
        return mapDatabaseFailure('persona creation', error);
      }
    },
    {
      argsSchema: z.tuple([personaInputSchema]),
      rateLimit: DB_MUTATION_RATE_LIMIT,
    }
  );

  dbIpcMain.handle('db:persona:getAll', async () => {
    try {
      const result = await queries.getPersonas();
      return { success: true, data: result };
    } catch (error) {
      return mapDatabaseFailure('persona listing', error);
    }
  }, { argsSchema: z.tuple([]) });

  dbIpcMain.handle(
    'db:persona:get',
    async (_, id: string) => {
      try {
        const persona = await queries.getPersona(id);
        if (!persona) {
          return { success: false, error: 'Persona not found' };
        }

        return { success: true, data: persona };
      } catch (error) {
        return mapDatabaseFailure('persona lookup', error);
      }
    },
    { argsSchema: z.tuple([personaIdSchema]) }
  );

  dbIpcMain.handle(
    'db:persona:update',
    async (_, id: string, data) => {
      try {
        const result = await queries.updatePersona(id, data);
        return { success: true, data: result };
      } catch (error) {
        return mapDatabaseFailure('persona update', error);
      }
    },
    {
      argsSchema: z.tuple([personaIdSchema, personaInputSchema.partial()]),
      rateLimit: DB_MUTATION_RATE_LIMIT,
    }
  );

  dbIpcMain.handle(
    'db:persona:delete',
    async (_, id: string) => {
      try {
        await queries.deletePersona(id);
        return { success: true };
      } catch (error) {
        return mapDatabaseFailure('persona deletion', error);
      }
    },
    {
      argsSchema: z.tuple([personaIdSchema]),
      rateLimit: DB_MUTATION_RATE_LIMIT,
    }
  );
}
