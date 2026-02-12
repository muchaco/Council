import { z } from 'zod';

import * as queries from '../lib/queries.js';
import {
  DB_MUTATION_RATE_LIMIT,
  dbIpcMain,
  mapDatabaseFailure,
  sessionIdSchema,
  tagIdSchema,
  tagNameSchema,
} from './db-handler-shared.js';

export function setupSessionTagsHandlers(): void {
  dbIpcMain.handle(
    'db:tag:create',
    async (_, name: string) => {
      try {
        const result = await queries.createTag({ name });
        return { success: true, data: result };
      } catch (error) {
        return mapDatabaseFailure('tag creation', error);
      }
    },
    {
      argsSchema: z.tuple([tagNameSchema]),
      rateLimit: DB_MUTATION_RATE_LIMIT,
    }
  );

  dbIpcMain.handle('db:tag:getAll', async () => {
    try {
      const result = await queries.getAllTags();
      return { success: true, data: result };
    } catch (error) {
      return mapDatabaseFailure('tag listing', error);
    }
  }, { argsSchema: z.tuple([]) });

  dbIpcMain.handle(
    'db:tag:getByName',
    async (_, name: string) => {
      try {
        const result = await queries.getTagByName(name);
        return { success: true, data: result };
      } catch (error) {
        return mapDatabaseFailure('tag lookup', error);
      }
    },
    { argsSchema: z.tuple([tagNameSchema]) }
  );

  dbIpcMain.handle(
    'db:tag:delete',
    async (_, id: number) => {
      try {
        await queries.deleteTag(id);
        return { success: true };
      } catch (error) {
        return mapDatabaseFailure('tag deletion', error);
      }
    },
    {
      argsSchema: z.tuple([tagIdSchema]),
      rateLimit: DB_MUTATION_RATE_LIMIT,
    }
  );

  dbIpcMain.handle(
    'db:sessionTag:add',
    async (_, sessionId: string, tagId: number) => {
      try {
        await queries.addTagToSession(sessionId, tagId);
        return { success: true };
      } catch (error) {
        return mapDatabaseFailure('session tag add', error);
      }
    },
    {
      argsSchema: z.tuple([sessionIdSchema, tagIdSchema]),
      rateLimit: DB_MUTATION_RATE_LIMIT,
    }
  );

  dbIpcMain.handle(
    'db:sessionTag:remove',
    async (_, sessionId: string, tagId: number) => {
      try {
        await queries.removeTagFromSession(sessionId, tagId);
        return { success: true };
      } catch (error) {
        return mapDatabaseFailure('session tag removal', error);
      }
    },
    {
      argsSchema: z.tuple([sessionIdSchema, tagIdSchema]),
      rateLimit: DB_MUTATION_RATE_LIMIT,
    }
  );

  dbIpcMain.handle(
    'db:sessionTag:getBySession',
    async (_, sessionId: string) => {
      try {
        const result = await queries.getTagsBySession(sessionId);
        return { success: true, data: result };
      } catch (error) {
        return mapDatabaseFailure('session tag listing', error);
      }
    },
    { argsSchema: z.tuple([sessionIdSchema]) }
  );

  dbIpcMain.handle('db:tag:cleanupOrphaned', async () => {
    try {
      await queries.cleanupOrphanedTags();
      return { success: true };
    } catch (error) {
      return mapDatabaseFailure('orphaned tag cleanup', error);
    }
  }, {
    argsSchema: z.tuple([]),
    rateLimit: DB_MUTATION_RATE_LIMIT,
  });
}
