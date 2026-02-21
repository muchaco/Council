import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { LogEntry, LogLevel } from "./logger.js";

export type LogFilter = {
  level?: LogLevel;
  component?: string;
  operation?: string;
  pattern?: string;
  since?: Date;
  until?: Date;
};

const getLogsDirectory = (): string => {
  const xdgDataHome = process.env.XDG_DATA_HOME;
  if (xdgDataHome) {
    return path.join(xdgDataHome, "council3", "logs");
  }
  const homeDir = os.homedir();
  return path.join(homeDir, ".local", "share", "council3", "logs");
};

const getCurrentLogFile = (logsDir: string): string => {
  const date = new Date().toISOString().split("T")[0];
  return path.join(logsDir, `app-${date}.log`);
};

const parseLogLine = (line: string): LogEntry | null => {
  try {
    return JSON.parse(line) as LogEntry;
  } catch {
    return null;
  }
};

const matchesFilter = (entry: LogEntry, filter: LogFilter): boolean => {
  if (filter.level && entry.level !== filter.level) {
    return false;
  }
  if (filter.component && entry.component !== filter.component) {
    return false;
  }
  if (filter.operation && entry.operation !== filter.operation) {
    return false;
  }
  if (filter.pattern) {
    const pattern = filter.pattern.toLowerCase();
    const text = JSON.stringify(entry).toLowerCase();
    if (!text.includes(pattern)) {
      return false;
    }
  }
  if (filter.since) {
    const entryTime = new Date(entry.timestamp).getTime();
    if (entryTime < filter.since.getTime()) {
      return false;
    }
  }
  if (filter.until) {
    const entryTime = new Date(entry.timestamp).getTime();
    if (entryTime > filter.until.getTime()) {
      return false;
    }
  }
  return true;
};

export const readLogs = (
  options: {
    lines?: number;
    filter?: LogFilter;
    logFile?: string;
  } = {},
): LogEntry[] => {
  const logsDir = getLogsDirectory();
  const logFile = options.logFile || getCurrentLogFile(logsDir);

  if (!fs.existsSync(logFile)) {
    return [];
  }

  const content = fs.readFileSync(logFile, { encoding: "utf-8" });
  const lines = content
    .trim()
    .split("\n")
    .filter((line) => line.length > 0);

  // Parse all entries
  const entries = lines.map(parseLogLine).filter((entry): entry is LogEntry => entry !== null);

  // Apply filter
  const filter = options.filter;
  const filtered = filter ? entries.filter((entry) => matchesFilter(entry, filter)) : entries;

  // Return last N lines if specified
  if (options.lines && options.lines > 0) {
    return filtered.slice(-options.lines);
  }

  return filtered;
};

export const tailLogs = (
  options: {
    lines?: number;
    filter?: LogFilter;
  } = {},
): LogEntry[] => {
  return readLogs({ ...options, lines: options.lines || 50 });
};

export const searchLogs = (pattern: string, options: { lines?: number } = {}): LogEntry[] => {
  return readLogs({
    filter: { pattern },
    lines: options.lines,
  });
};

export const getLogFilePath = (): string => {
  const logsDir = getLogsDirectory();
  return getCurrentLogFile(logsDir);
};

export const listLogFiles = (): string[] => {
  const logsDir = getLogsDirectory();
  if (!fs.existsSync(logsDir)) {
    return [];
  }
  return fs
    .readdirSync(logsDir)
    .filter((file) => file.startsWith("app-") && file.endsWith(".log"))
    .sort()
    .reverse();
};
