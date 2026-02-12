import { app } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

type DiagnosticsLevel = 'info' | 'error';

type DiagnosticsEvent = {
  readonly event_name: string;
  readonly level?: DiagnosticsLevel;
  readonly context?: Readonly<Record<string, unknown>>;
};

type DiagnosticsRecord = {
  readonly timestamp: string;
  readonly level: DiagnosticsLevel;
  readonly event_name: string;
  readonly session_id: string;
  readonly app_version: string;
  readonly node_env: string;
  readonly process_type: 'electron-main';
  readonly pid: number;
  readonly platform: NodeJS.Platform;
  readonly context: Readonly<Record<string, unknown>>;
};

export type DiagnosticsStatusSnapshot = {
  readonly sessionId: string;
  readonly logDirectoryPath: string;
  readonly logFilePath: string;
};

const LOG_DIRECTORY_NAME = 'logs';
const LOG_FILE_NAME = 'diagnostics.ndjson';
const PROCESS_TYPE = 'electron-main' as const;
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const IS_DEVELOPMENT = NODE_ENV === 'development';
const SESSION_ID = crypto.randomUUID();

let resolvedLogDirectoryPath: string | null = null;

const isElectronAppReady = (): boolean => {
  try {
    return typeof app.isReady === 'function' ? app.isReady() : false;
  } catch {
    return false;
  }
};

const getElectronAppVersion = (): string => {
  try {
    return typeof app.getVersion === 'function' ? app.getVersion() : '0.0.0';
  } catch {
    return '0.0.0';
  }
};

const getElectronUserDataPath = (): string | null => {
  try {
    return typeof app.getPath === 'function' ? app.getPath('userData') : null;
  } catch {
    return null;
  }
};

const asSerializable = (value: unknown): unknown => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'function') {
    return value.name.length > 0 ? `[Function:${value.name}]` : '[Function]';
  }

  if (Array.isArray(value)) {
    return value.map((entry) => asSerializable(entry));
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        asSerializable(nestedValue),
      ])
    );
  }

  return value;
};

const resolveLogDirectoryPath = (): string => {
  if (resolvedLogDirectoryPath !== null) {
    return resolvedLogDirectoryPath;
  }

  const baseDirectoryPath = isElectronAppReady()
    ? (getElectronUserDataPath() ?? path.join(os.homedir(), '.config', 'Council'))
    : path.join(os.homedir(), '.config', 'Council');

  resolvedLogDirectoryPath = path.join(baseDirectoryPath, LOG_DIRECTORY_NAME);
  return resolvedLogDirectoryPath;
};

const getLogFilePath = (): string => {
  return path.join(resolveLogDirectoryPath(), LOG_FILE_NAME);
};

const ensureLogDirectoryExists = (): void => {
  fs.mkdirSync(resolveLogDirectoryPath(), { recursive: true, mode: 0o700 });
};

const createRecord = ({
  event_name,
  level = 'info',
  context = {},
}: DiagnosticsEvent): DiagnosticsRecord => {
  const applicationVersion = isElectronAppReady() ? getElectronAppVersion() : '0.0.0';

  return {
    timestamp: new Date().toISOString(),
    level,
    event_name,
    session_id: SESSION_ID,
    app_version: applicationVersion,
    node_env: NODE_ENV,
    process_type: PROCESS_TYPE,
    pid: process.pid,
    platform: process.platform,
    context,
  };
};

const formatRecordForConsole = (record: DiagnosticsRecord): string => {
  return [
    '[diagnostics]',
    record.level.toUpperCase(),
    record.event_name,
    JSON.stringify(record.context),
  ].join(' ');
};

const writeRecord = (record: DiagnosticsRecord): void => {
  ensureLogDirectoryExists();
  fs.appendFileSync(getLogFilePath(), `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 });

  if (IS_DEVELOPMENT) {
    const formatted = formatRecordForConsole(record);
    if (record.level === 'error') {
      console.error(formatted);
      return;
    }

    console.log(formatted);
  }
};

const withFallback = (fn: () => void): void => {
  try {
    fn();
  } catch (error) {
    const fallbackMessage = '[diagnostics] failed to write record';
    const fallbackPayload = asSerializable(error);
    console.error(fallbackMessage, fallbackPayload);
  }
};

export const logDiagnosticsEvent = ({ event_name, level, context }: DiagnosticsEvent): void => {
  withFallback(() => {
    const record = createRecord({
      event_name,
      level,
      context: (asSerializable(context) ?? {}) as Record<string, unknown>,
    });
    writeRecord(record);
  });
};

export const logDiagnosticsError = (
  eventName: string,
  error: unknown,
  context: Readonly<Record<string, unknown>> = {}
): void => {
  logDiagnosticsEvent({
    event_name: eventName,
    level: 'error',
    context: {
      ...context,
      error: asSerializable(error),
    },
  });
};

export const getDiagnosticsStatusSnapshot = (): DiagnosticsStatusSnapshot => {
  const logDirectoryPath = resolveLogDirectoryPath();
  return {
    sessionId: SESSION_ID,
    logDirectoryPath,
    logFilePath: path.join(logDirectoryPath, LOG_FILE_NAME),
  };
};
