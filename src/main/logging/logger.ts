import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { app } from "electron";

export type LogLevel = "info" | "error";

export type LogEntry = {
  timestamp: string;
  level: LogLevel;
  component: string;
  operation: string;
  requestId?: string;
  durationMs?: number;
  outcome?: "success" | "error";
  error?: {
    kind: string;
    message: string;
  };
} & Record<string, unknown>;

export type Logger = {
  info: (component: string, operation: string, context?: Record<string, unknown>) => void;
  error: (
    component: string,
    operation: string,
    error: Error | string,
    context?: Record<string, unknown>,
  ) => void;
  logWideEvent: (entry: LogEntry) => void;
};

const getLogsDirectory = (): string => {
  // Use XDG_DATA_HOME on Linux, fallback to ~/.local/share
  const xdgDataHome = process.env.XDG_DATA_HOME;
  if (xdgDataHome) {
    return path.join(xdgDataHome, "council3", "logs");
  }

  // Fallback to home directory
  const homeDir = os.homedir();
  return path.join(homeDir, ".local", "share", "council3", "logs");
};

const getCurrentLogFile = (logsDir: string): string => {
  const date = new Date().toISOString().split("T")[0];
  return path.join(logsDir, `app-${date}.log`);
};

const ensureLogDirectory = (logsDir: string): void => {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
};

const writeLogEntry = (logsDir: string, entry: LogEntry): void => {
  ensureLogDirectory(logsDir);
  const logFile = getCurrentLogFile(logsDir);
  const line = `${JSON.stringify(entry)}\n`;
  fs.appendFileSync(logFile, line, { encoding: "utf-8" });
};

const generateRequestId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const createFileLogger = (): Logger => {
  const logsDir = getLogsDirectory();

  return {
    info: (component: string, operation: string, context?: Record<string, unknown>) => {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: "info",
        component,
        operation,
        requestId: generateRequestId(),
        outcome: "success",
        ...context,
      };
      writeLogEntry(logsDir, entry);
    },

    error: (
      component: string,
      operation: string,
      error: Error | string,
      context?: Record<string, unknown>,
    ) => {
      const errorMessage = error instanceof Error ? error.message : error;
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: "error",
        component,
        operation,
        requestId: generateRequestId(),
        outcome: "error",
        error: {
          kind: error instanceof Error ? error.name : "UnknownError",
          message: errorMessage,
        },
        ...context,
      };
      writeLogEntry(logsDir, entry);
    },

    logWideEvent: (entry: LogEntry) => {
      writeLogEntry(logsDir, entry);
    },
  };
};

// Also export a console logger for development fallback
export const createConsoleLogger = (): Logger => ({
  info: (component: string, operation: string, context?: Record<string, unknown>) => {
    console.log(`[${component}] ${operation}`, context);
  },
  error: (
    component: string,
    operation: string,
    error: Error | string,
    context?: Record<string, unknown>,
  ) => {
    console.error(`[${component}] ${operation} failed:`, error, context);
  },
  logWideEvent: (entry: LogEntry) => {
    console.log("[WIDE EVENT]", entry);
  },
});

// Create the appropriate logger based on environment
export const createLogger = (): Logger => {
  // In development, also log to console for immediate visibility
  const fileLogger = createFileLogger();
  const consoleLogger = createConsoleLogger();

  return {
    info: (component: string, operation: string, context?: Record<string, unknown>) => {
      fileLogger.info(component, operation, context);
      consoleLogger.info(component, operation, context);
    },
    error: (
      component: string,
      operation: string,
      error: Error | string,
      context?: Record<string, unknown>,
    ) => {
      fileLogger.error(component, operation, error, context);
      consoleLogger.error(component, operation, error, context);
    },
    logWideEvent: (entry: LogEntry) => {
      fileLogger.logWideEvent(entry);
      consoleLogger.logWideEvent(entry);
    },
  };
};
