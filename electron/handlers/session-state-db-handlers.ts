import { z } from 'zod';

import * as queries from '../lib/queries.js';
import {
  DB_MUTATION_RATE_LIMIT,
  dbIpcMain,
  mapDatabaseFailure,
  sessionCreateInputSchema,
  sessionIdSchema,
  sessionUpdateInputSchema,
} from './db-handler-shared.js';

export function setupSessionStateDbHandlers(): void {
  dbIpcMain.handle(
    'db:session:create',
    async (_, data) => {
      try {
        const { conductorConfig, ...sessionData } = data;
        const result = await queries.createSession(sessionData, conductorConfig);
        return { success: true, data: result };
      } catch (error) {
        return mapDatabaseFailure('session creation', error);
      }
    },
    {
      argsSchema: z.tuple([sessionCreateInputSchema]),
      rateLimit: DB_MUTATION_RATE_LIMIT,
    }
  );

  dbIpcMain.handle('db:session:getAll', async () => {
    try {
      const result = await queries.getSessions();
      return { success: true, data: result };
    } catch (error) {
      return mapDatabaseFailure('session listing', error);
    }
  }, { argsSchema: z.tuple([]) });

  dbIpcMain.handle(
    'db:session:get',
    async (_, id: string) => {
      try {
        const session = await queries.getSession(id);
        if (!session) {
          return { success: false, error: 'Session not found' };
        }

        return { success: true, data: session };
      } catch (error) {
        return mapDatabaseFailure('session lookup', error);
      }
    },
    { argsSchema: z.tuple([sessionIdSchema]) }
  );

  dbIpcMain.handle(
    'db:session:update',
    async (_, id: string, data) => {
      try {
        const result = await queries.updateSession(id, data);
        return { success: true, data: result };
      } catch (error) {
        return mapDatabaseFailure('session update', error);
      }
    },
    {
      argsSchema: z.tuple([sessionIdSchema, sessionUpdateInputSchema]),
      rateLimit: DB_MUTATION_RATE_LIMIT,
    }
  );

  dbIpcMain.handle(
    'db:session:delete',
    async (_, id: string) => {
      try {
        await queries.deleteSession(id);
        return { success: true };
      } catch (error) {
        return mapDatabaseFailure('session deletion', error);
      }
    },
    {
      argsSchema: z.tuple([sessionIdSchema]),
      rateLimit: DB_MUTATION_RATE_LIMIT,
    }
  );

  dbIpcMain.handle(
    'db:session:archive',
    async (_, id: string) => {
      try {
        await queries.archiveSession(id);
        return { success: true };
      } catch (error) {
        return mapDatabaseFailure('session archive', error);
      }
    },
    {
      argsSchema: z.tuple([sessionIdSchema]),
      rateLimit: DB_MUTATION_RATE_LIMIT,
    }
  );

  dbIpcMain.handle(
    'db:session:unarchive',
    async (_, id: string) => {
      try {
        await queries.unarchiveSession(id);
        return { success: true };
      } catch (error) {
        return mapDatabaseFailure('session unarchive', error);
      }
    },
    {
      argsSchema: z.tuple([sessionIdSchema]),
      rateLimit: DB_MUTATION_RATE_LIMIT,
    }
  );
}
