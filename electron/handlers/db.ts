import { ipcMain as electronIpcMain } from 'electron';
import { z } from 'zod';

import * as queries from '../lib/queries.js';
import {
  registerPrivilegedIpcHandle,
  type PrivilegedIpcHandleOptions,
} from '../lib/security/privileged-ipc.js';

const DATABASE_OPERATION_PUBLIC_ERROR = 'Database operation failed';

const sessionIdSchema = z.string().min(1);
const personaIdSchema = z.string().min(1);
const tagIdSchema = z.number().int().positive();

const blackboardSchema = z.object({
  consensus: z.string(),
  conflicts: z.string(),
  nextStep: z.string(),
  facts: z.string(),
});

const personaInputSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  systemPrompt: z.string().min(1),
  geminiModel: z.string().min(1),
  temperature: z.number(),
  color: z.string().min(1),
  hiddenAgenda: z.string().optional(),
  verbosity: z.string().optional(),
});

const sessionCreateInputSchema = z.object({
  title: z.string().min(1),
  problemDescription: z.string().min(1),
  outputGoal: z.string().optional().default(''),
  conductorConfig: z
    .object({
      enabled: z.boolean(),
      mode: z.enum(['automatic', 'manual']).optional(),
    })
    .optional(),
});

const sessionUpdateInputSchema = z
  .object({
    title: z.string().min(1).optional(),
    problemDescription: z.string().min(1).optional(),
    outputGoal: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
    tokenCount: z.number().optional(),
    costEstimate: z.number().optional(),
    conductorEnabled: z.boolean().optional(),
    conductorMode: z.enum(['automatic', 'manual']).optional(),
    blackboard: blackboardSchema.nullable().optional(),
    autoReplyCount: z.number().int().optional(),
    tokenBudget: z.number().int().optional(),
    summary: z.string().nullable().optional(),
  })
  .strict();

const messageMetadataSchema = z
  .object({
    isIntervention: z.boolean().optional(),
    driftDetected: z.boolean().optional(),
    selectorReasoning: z.string().optional(),
    isConductorMessage: z.boolean().optional(),
  })
  .strict();

const messageInputSchema = z
  .object({
    sessionId: sessionIdSchema,
    personaId: z.string().min(1).nullable(),
    content: z.string().min(1),
    turnNumber: z.number().int().nonnegative(),
    tokenCount: z.number().int().nonnegative().optional(),
    metadata: messageMetadataSchema.optional(),
  })
  .strict();

const tagNameSchema = z.string().trim().min(1).max(64);
const hushTurnsSchema = z.number().int().nonnegative();

const DB_MUTATION_RATE_LIMIT = {
  maxRequests: 120,
  windowMs: 60_000,
} as const;

const ipcMain = {
  handle: (
    channelName: string,
    handler: (...args: any[]) => unknown,
    options?: PrivilegedIpcHandleOptions
  ): void => {
    registerPrivilegedIpcHandle(electronIpcMain, channelName, handler as any, options);
  },
};

const mapDatabaseFailure = (operationName: string, error: unknown): { success: false; error: string } => {
  console.error(`Error during ${operationName}:`, error);
  return { success: false, error: DATABASE_OPERATION_PUBLIC_ERROR };
};

export function setupDatabaseHandlers(): void {
  ipcMain.handle(
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

  ipcMain.handle('db:persona:getAll', async () => {
    try {
      const result = await queries.getPersonas();
      return { success: true, data: result };
    } catch (error) {
      return mapDatabaseFailure('persona listing', error);
    }
  }, { argsSchema: z.tuple([]) });

  ipcMain.handle(
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

  ipcMain.handle(
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

  ipcMain.handle(
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

  ipcMain.handle(
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

  ipcMain.handle('db:session:getAll', async () => {
    try {
      const result = await queries.getSessions();
      return { success: true, data: result };
    } catch (error) {
      return mapDatabaseFailure('session listing', error);
    }
  }, { argsSchema: z.tuple([]) });

  ipcMain.handle(
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

  ipcMain.handle(
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

  ipcMain.handle(
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

  ipcMain.handle(
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

  ipcMain.handle(
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

  ipcMain.handle(
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

  ipcMain.handle(
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

  ipcMain.handle(
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

  ipcMain.handle(
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

  ipcMain.handle(
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

  ipcMain.handle(
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

  ipcMain.handle(
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

  ipcMain.handle(
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

  ipcMain.handle('db:tag:getAll', async () => {
    try {
      const result = await queries.getAllTags();
      return { success: true, data: result };
    } catch (error) {
      return mapDatabaseFailure('tag listing', error);
    }
  }, { argsSchema: z.tuple([]) });

  ipcMain.handle(
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

  ipcMain.handle(
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

  ipcMain.handle(
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

  ipcMain.handle(
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

  ipcMain.handle(
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

  ipcMain.handle('db:tag:cleanupOrphaned', async () => {
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
