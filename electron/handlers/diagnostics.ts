import { ipcMain as electronIpcMain, shell, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { z } from 'zod';

import {
  getDiagnosticsStatusSnapshot,
  logDiagnosticsError,
  logDiagnosticsEvent,
} from '../lib/diagnostics/logger.js';
import {
  registerPrivilegedIpcHandle,
  type PrivilegedIpcHandleOptions,
} from '../lib/security/privileged-ipc.js';

const MAX_SUMMARY_LINE_COUNT = 80;

const ipcMain = {
  handle: (
    channelName: string,
    handler: (...args: any[]) => unknown,
    options?: PrivilegedIpcHandleOptions
  ): void => {
    registerPrivilegedIpcHandle(electronIpcMain, channelName, handler as any, options);
  },
};

type DiagnosticsEventRecord = {
  readonly timestamp?: string;
  readonly level?: string;
  readonly event_name?: string;
  readonly context?: Record<string, unknown>;
};

const readTailLines = (filePath: string, maxLines: number): readonly string[] => {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.slice(Math.max(0, lines.length - maxLines));
};

const tryParseEventRecord = (line: string): DiagnosticsEventRecord | null => {
  try {
    return JSON.parse(line) as DiagnosticsEventRecord;
  } catch {
    return null;
  }
};

const formatSummaryLine = (eventRecord: DiagnosticsEventRecord): string => {
  const timestamp = eventRecord.timestamp ?? 'unknown-time';
  const level = eventRecord.level ?? 'info';
  const eventName = eventRecord.event_name ?? 'unknown-event';
  const context = eventRecord.context ?? {};
  const compactContext = JSON.stringify(context);
  return `${timestamp} ${level.toUpperCase()} ${eventName} ${compactContext}`;
};

const createDiagnosticsSummary = (): string => {
  const status = getDiagnosticsStatusSnapshot();
  const recentLines = readTailLines(status.logFilePath, MAX_SUMMARY_LINE_COUNT);
  const summaryLines = recentLines
    .map((line) => tryParseEventRecord(line))
    .filter((eventRecord): eventRecord is DiagnosticsEventRecord => eventRecord !== null)
    .map((eventRecord) => formatSummaryLine(eventRecord));

  const headerLines = [
    '# Council Diagnostics Summary',
    `session_id: ${status.sessionId}`,
    `log_directory: ${status.logDirectoryPath}`,
    `log_file: ${status.logFilePath}`,
    `platform: ${process.platform}`,
    `hostname: ${os.hostname()}`,
    `pid: ${process.pid}`,
    `node_env: ${process.env.NODE_ENV ?? 'development'}`,
    '',
    '## Recent Events',
  ];

  if (summaryLines.length === 0) {
    return [...headerLines, 'No diagnostics events available yet.'].join('\n');
  }

  return [...headerLines, ...summaryLines].join('\n');
};

export function setupDiagnosticsHandlers(): void {
  ipcMain.handle('diagnostics:getStatus', () => {
    const status = getDiagnosticsStatusSnapshot();
    return {
      success: true,
      data: status,
    };
  }, {
    argsSchema: z.tuple([]),
  });

  ipcMain.handle('diagnostics:openLogsDirectory', async () => {
    try {
      const status = getDiagnosticsStatusSnapshot();
      fs.mkdirSync(status.logDirectoryPath, { recursive: true, mode: 0o700 });
      await shell.openPath(status.logDirectoryPath);
      return { success: true };
    } catch (error) {
      logDiagnosticsError('diagnostics.open_logs_directory.failed', error);
      return { success: false, error: 'Unable to open logs directory' };
    }
  }, {
    argsSchema: z.tuple([]),
    rateLimit: {
      maxRequests: 20,
      windowMs: 60_000,
    },
  });

  ipcMain.handle('diagnostics:getSummary', () => {
    try {
      const summary = createDiagnosticsSummary();
      return {
        success: true,
        data: {
          summary,
        },
      };
    } catch (error) {
      logDiagnosticsError('diagnostics.get_summary.failed', error);
      return {
        success: false,
        error: 'Unable to build diagnostics summary',
      };
    }
  }, {
    argsSchema: z.tuple([]),
    rateLimit: {
      maxRequests: 40,
      windowMs: 60_000,
    },
  });

  ipcMain.handle('diagnostics:exportBundle', async () => {
    try {
      const status = getDiagnosticsStatusSnapshot();
      const diagnosticsSummary = createDiagnosticsSummary();
      const dateStamp = new Date().toISOString().replace(/[:.]/g, '-');
      const defaultFileName = `council-diagnostics-${dateStamp}.txt`;

      const saveDialogResult = await dialog.showSaveDialog({
        title: 'Export Diagnostics Bundle',
        defaultPath: defaultFileName,
        filters: [
          { name: 'Text files', extensions: ['txt'] },
          { name: 'All files', extensions: ['*'] },
        ],
      });

      if (saveDialogResult.canceled || !saveDialogResult.filePath) {
        return { success: true, cancelled: true };
      }

      const rawTailLines = readTailLines(status.logFilePath, 200);
      const bundleContent = [
        diagnosticsSummary,
        '',
        '## Raw Log Tail (200 lines max)',
        ...rawTailLines,
      ].join('\n');

      fs.writeFileSync(saveDialogResult.filePath, bundleContent, 'utf8');

      logDiagnosticsEvent({
        event_name: 'diagnostics.bundle.exported',
        context: {
          file_path: saveDialogResult.filePath,
          line_count: rawTailLines.length,
        },
      });

      return {
        success: true,
        filePath: saveDialogResult.filePath,
      };
    } catch (error) {
      logDiagnosticsError('diagnostics.export_bundle.failed', error);
      return {
        success: false,
        error: 'Unable to export diagnostics bundle',
      };
    }
  }, {
    argsSchema: z.tuple([]),
    rateLimit: {
      maxRequests: 20,
      windowMs: 60_000,
    },
  });
}
