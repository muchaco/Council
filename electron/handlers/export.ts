import { ipcMain as electronIpcMain, dialog } from 'electron';
import { promises as fs } from 'fs';
import { z } from 'zod';
import { getSessionForExport, formatSessionAsMarkdown } from '../lib/export.js';
import {
  registerPrivilegedIpcHandle,
  type PrivilegedIpcHandleOptions,
} from '../lib/security/privileged-ipc.js';

const EXPORT_OPERATION_PUBLIC_ERROR = 'Failed to export session';
const sessionIdSchema = z.string().min(1);

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
  ipcMain.handle('export:sessionToMarkdown', async (_, sessionId: string) => {
    try {
      console.log('Exporting session to markdown:', sessionId);

      // Get session data
      const sessionData = await getSessionForExport(sessionId);
      
      // Format as markdown
      const markdown = formatSessionAsMarkdown(sessionData);
      
      // Generate default filename
      const sanitizedTitle = sessionData.session.title
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
      await fs.writeFile(filePath, markdown, 'utf-8');
      
      console.log('Session exported successfully to:', filePath);
      return { 
        success: true, 
        filePath,
        messageCount: sessionData.messages.length,
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
  });
}
