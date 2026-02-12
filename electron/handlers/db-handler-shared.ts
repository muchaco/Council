import { ipcMain as electronIpcMain } from 'electron';
import { z } from 'zod';

import { logDiagnosticsError } from '../lib/diagnostics/logger.js';
import {
  registerPrivilegedIpcHandle,
  type PrivilegedIpcHandleOptions,
} from '../lib/security/privileged-ipc.js';

const DATABASE_OPERATION_PUBLIC_ERROR = 'Database operation failed';

export const DB_MUTATION_RATE_LIMIT = {
  maxRequests: 120,
  windowMs: 60_000,
} as const;

export const sessionIdSchema = z.string().min(1);
export const personaIdSchema = z.string().min(1);
export const tagIdSchema = z.number().int().positive();
export const hushTurnsSchema = z.number().int().nonnegative();
export const tagNameSchema = z.string().trim().min(1).max(64);

export const personaInputSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  systemPrompt: z.string().min(1),
  geminiModel: z.string().min(1),
  temperature: z.number(),
  color: z.string().min(1),
  hiddenAgenda: z.string().optional(),
  verbosity: z.string().optional(),
});


export const messageMetadataSchema = z
  .object({
    isIntervention: z.boolean().optional(),
    driftDetected: z.boolean().optional(),
    selectorReasoning: z.string().optional(),
    isConductorMessage: z.boolean().optional(),
  })
  .strict();

export const messageInputSchema = z
  .object({
    sessionId: sessionIdSchema,
    personaId: z.string().min(1).nullable(),
    source: z.enum(['user', 'persona', 'conductor']).optional(),
    content: z.string().min(1),
    turnNumber: z.number().int().nonnegative(),
    tokenCount: z.number().int().nonnegative().optional(),
    metadata: messageMetadataSchema.optional(),
  })
  .strict();

export const dbIpcMain = {
  handle: (
    channelName: string,
    handler: (...args: any[]) => unknown,
    options?: PrivilegedIpcHandleOptions
  ): void => {
    registerPrivilegedIpcHandle(electronIpcMain, channelName, handler as any, options);
  },
};

export const mapDatabaseFailure = (
  operationName: string,
  error: unknown
): { success: false; error: string } => {
  logDiagnosticsError('database.operation.failed', error, {
    operation: operationName,
  });
  return { success: false, error: DATABASE_OPERATION_PUBLIC_ERROR };
};
