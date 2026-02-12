import { ipcMain as electronIpcMain, dialog } from 'electron';
import { promises as fs } from 'fs';
import { Effect, Either } from 'effect';
import { z } from 'zod';
import { makeElectronSqlQueryExecutor } from '../lib/sql-query-executor.js';
import { executeExportSessionMarkdown } from '../../lib/application/use-cases/council-transcript/index.js';
import { QueryLayerRepository } from '../../lib/application/use-cases/query-layer/index.js';
import { SessionParticipationRepository } from '../../lib/application/use-cases/session-participation/index.js';
import { CouncilTranscriptRepository } from '../../lib/application/use-cases/council-transcript/index.js';
import {
  makeCouncilTranscriptRepositoryFromSqlExecutor,
  makeQueryLayerRepositoryFromSqlExecutor,
  makeSessionParticipationRepositoryFromSqlExecutor,
} from '../../lib/infrastructure/db/index.js';
import {
  registerPrivilegedIpcHandle,
  type PrivilegedIpcHandleOptions,
} from '../lib/security/privileged-ipc.js';

const EXPORT_OPERATION_PUBLIC_ERROR = 'Failed to export session';
const sessionIdSchema = z.string().min(1);
const EXPORT_OPERATION_RATE_LIMIT = {
  maxRequests: 20,
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

export function setupExportHandlers(): void {
  const sqlExecutor = makeElectronSqlQueryExecutor();
  const queryLayerRepository = makeQueryLayerRepositoryFromSqlExecutor(sqlExecutor);
  const councilTranscriptRepository = makeCouncilTranscriptRepositoryFromSqlExecutor(sqlExecutor);
  const sessionParticipationRepository = makeSessionParticipationRepositoryFromSqlExecutor(sqlExecutor);

  ipcMain.handle('export:sessionToMarkdown', async (_, sessionId: string) => {
    try {
      console.log('Exporting session to markdown:', sessionId);

      const exportOutcome = await Effect.runPromise(
        executeExportSessionMarkdown(sessionId).pipe(
          Effect.provideService(QueryLayerRepository, queryLayerRepository),
          Effect.provideService(CouncilTranscriptRepository, councilTranscriptRepository),
          Effect.provideService(SessionParticipationRepository, sessionParticipationRepository),
          Effect.either
        )
      );

      if (Either.isLeft(exportOutcome)) {
        return {
          success: false,
          error: EXPORT_OPERATION_PUBLIC_ERROR,
        };
      }

      // Generate default filename
      const sanitizedTitle = exportOutcome.right.sessionTitle
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase()
        .substring(0, 50);
      const dateStr = new Date().toISOString().split('T')[0];
      const defaultFilename = `${sanitizedTitle}-${dateStr}.md`;

      // Show save dialog
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Export Session to Markdown',
        defaultPath: defaultFilename,
        filters: [
          { name: 'Markdown files', extensions: ['md'] },
          { name: 'All files', extensions: ['*'] },
        ],
      });

      if (canceled || !filePath) {
        console.log('Export cancelled by user');
        return { success: true, cancelled: true };
      }

      // Write file
      await fs.writeFile(filePath, exportOutcome.right.markdown, 'utf-8');
      
      console.log('Session exported successfully to:', filePath);
      return { 
        success: true, 
        filePath,
        messageCount: exportOutcome.right.messageCount,
      };
    } catch (error) {
      console.error('Error exporting session:', error);
      return { 
        success: false, 
        error: EXPORT_OPERATION_PUBLIC_ERROR,
      };
    }
  }, {
    argsSchema: z.tuple([sessionIdSchema]),
    rateLimit: EXPORT_OPERATION_RATE_LIMIT,
  });
}
