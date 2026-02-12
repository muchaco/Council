import { z } from 'zod';

import * as queries from '../lib/queries.js';
import {
  DB_MUTATION_RATE_LIMIT,
  dbIpcMain,
  hushTurnsSchema,
  mapDatabaseFailure,
  personaIdSchema,
  sessionIdSchema,
} from './db-handler-shared.js';

export function setupSessionParticipationHandlers(): void {
  dbIpcMain.handle(
    'db:sessionPersona:add',
    async (_, sessionId: string, personaId: string, isConductor: boolean) => {
      try {
        await queries.addPersonaToSession(sessionId, personaId, isConductor);
        return { success: true };
      } catch (error) {
        return mapDatabaseFailure('session participant add', error);
      }
    },
    {
      argsSchema: z.tuple([sessionIdSchema, personaIdSchema, z.boolean()]),
      rateLimit: DB_MUTATION_RATE_LIMIT,
    }
  );

  dbIpcMain.handle(
    'db:sessionPersona:getBySession',
    async (_, sessionId: string) => {
      try {
        const result = await queries.getSessionPersonas(sessionId);
        return { success: true, data: result };
      } catch (error) {
        return mapDatabaseFailure('session participant listing', error);
      }
    },
    { argsSchema: z.tuple([sessionIdSchema]) }
  );

  dbIpcMain.handle(
    'db:persona:hush',
    async (_, sessionId: string, personaId: string, turns: number) => {
      try {
        await queries.setPersonaHush(sessionId, personaId, turns);
        return { success: true };
      } catch (error) {
        return mapDatabaseFailure('persona hush', error);
      }
    },
    {
      argsSchema: z.tuple([sessionIdSchema, personaIdSchema, hushTurnsSchema]),
      rateLimit: DB_MUTATION_RATE_LIMIT,
    }
  );

  dbIpcMain.handle(
    'db:persona:unhush',
    async (_, sessionId: string, personaId: string) => {
      try {
        await queries.clearPersonaHush(sessionId, personaId);
        return { success: true };
      } catch (error) {
        return mapDatabaseFailure('persona unhush', error);
      }
    },
    {
      argsSchema: z.tuple([sessionIdSchema, personaIdSchema]),
      rateLimit: DB_MUTATION_RATE_LIMIT,
    }
  );
}
