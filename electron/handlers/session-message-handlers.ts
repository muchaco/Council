import { z } from 'zod';

import * as queries from '../lib/queries.js';
import {
  DB_MUTATION_RATE_LIMIT,
  dbIpcMain,
  mapDatabaseFailure,
  messageInputSchema,
  sessionIdSchema,
} from './db-handler-shared.js';

export function setupSessionMessageHandlers(): void {
  dbIpcMain.handle(
    'db:message:create',
    async (_, data) => {
      try {
        const result = await queries.createMessage(data);
        return { success: true, data: result };
      } catch (error) {
        return mapDatabaseFailure('message creation', error);
      }
    },
    {
      argsSchema: z.tuple([messageInputSchema]),
      rateLimit: DB_MUTATION_RATE_LIMIT,
    }
  );

  dbIpcMain.handle(
    'db:message:getBySession',
    async (_, sessionId: string) => {
      try {
        const result = await queries.getMessagesBySession(sessionId);
        return { success: true, data: result };
      } catch (error) {
        return mapDatabaseFailure('session message lookup', error);
      }
    },
    { argsSchema: z.tuple([sessionIdSchema]) }
  );

  dbIpcMain.handle(
    'db:message:getNextTurnNumber',
    async (_, sessionId: string) => {
      try {
        const turnNumber = await queries.getNextTurnNumber(sessionId);
        return { success: true, data: turnNumber };
      } catch (error) {
        return mapDatabaseFailure('next turn lookup', error);
      }
    },
    { argsSchema: z.tuple([sessionIdSchema]) }
  );
}
