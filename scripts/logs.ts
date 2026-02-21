#!/usr/bin/env node
/**
 * Log viewer script for Council3
 *
 * Usage:
 *   bun run logs:tail              # Show last 50 log entries
 *   bun run logs:tail --lines 100  # Show last 100 log entries
 *   bun run logs:search "error"    # Search for pattern in logs
 *   bun run logs:filter --level error --component autopilot
 */

import {
  getLogFilePath,
  listLogFiles,
  readLogs,
  searchLogs,
  tailLogs,
} from "../src/main/logging/log-reader.js";

const args = process.argv.slice(2);
const command = args[0] || "tail";

const parseArg = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : undefined;
};

const hasFlag = (flag: string): boolean => args.includes(flag);

const formatEntry = (entry: import("../src/main/logging/logger.js").LogEntry): string => {
  const timestamp = new Date(entry.timestamp).toLocaleTimeString();
  const level = entry.level.toUpperCase().padEnd(5);
  const component = entry.component.padEnd(12);
  const operation = entry.operation.padEnd(20);
  const context = Object.keys(entry)
    .filter(
      (key) =>
        !["timestamp", "level", "component", "operation", "requestId", "outcome", "error"].includes(
          key,
        ),
    )
    .map((key) => `${key}=${JSON.stringify((entry as Record<string, unknown>)[key])}`)
    .join(" ");

  let result = `[${timestamp}] ${level} ${component} ${operation}`;
  if (context) {
    result += ` ${context}`;
  }
  if (entry.error) {
    result += ` ERROR: ${entry.error.kind} - ${entry.error.message}`;
  }
  return result;
};

const printEntries = (entries: import("../src/main/logging/logger.js").LogEntry[]): void => {
  if (entries.length === 0) {
    console.log("No log entries found.");
    return;
  }

  console.log(`\nFound ${entries.length} log entries:\n`);
  for (const entry of entries) {
    console.log(formatEntry(entry));
  }
  console.log();
};

const main = (): void => {
  switch (command) {
    case "tail": {
      const lines = Number.parseInt(parseArg("--lines") || "50", 10);
      const entries = tailLogs({ lines });
      console.log(`\n📋 Council3 Logs (last ${entries.length} entries)`);
      console.log(`📁 Log file: ${getLogFilePath()}`);
      printEntries(entries);
      break;
    }

    case "search": {
      const pattern = args[1];
      if (!pattern) {
        console.error("Usage: bun run logs:search <pattern>");
        process.exit(1);
      }
      const entries = searchLogs(pattern);
      console.log(`\n🔍 Search results for "${pattern}" (${entries.length} matches)`);
      console.log(`📁 Log file: ${getLogFilePath()}`);
      printEntries(entries);
      break;
    }

    case "filter": {
      const level = parseArg("--level") as "info" | "error" | undefined;
      const component = parseArg("--component");
      const operation = parseArg("--operation");
      const lines = Number.parseInt(parseArg("--lines") || "100", 10);

      const entries = readLogs({
        lines,
        filter: {
          level,
          component,
          operation,
        },
      });

      console.log(`\n🔍 Filtered logs (${entries.length} matches)`);
      console.log(`📁 Log file: ${getLogFilePath()}`);
      if (level) console.log(`   Level: ${level}`);
      if (component) console.log(`   Component: ${component}`);
      if (operation) console.log(`   Operation: ${operation}`);
      printEntries(entries);
      break;
    }

    case "files": {
      const files = listLogFiles();
      console.log("\n📁 Available log files:");
      for (const file of files) {
        console.log(`   - ${file}`);
      }
      console.log(`\nCurrent log: ${getLogFilePath()}`);
      break;
    }

    case "path": {
      console.log(getLogFilePath());
      break;
    }

    default: {
      console.log(`
Council3 Log Viewer

Usage:
  bun run logs:tail [--lines N]     Show last N log entries (default: 50)
  bun run logs:search <pattern>     Search for pattern in logs
  bun run logs:filter [options]     Filter logs by criteria
  bun run logs:files                List available log files
  bun run logs:path                 Show current log file path

Filter options:
  --level info|error                Filter by log level
  --component <name>                Filter by component (e.g., autopilot)
  --operation <name>                Filter by operation (e.g., advanceTurn)
  --lines N                         Limit to N entries

Examples:
  bun run logs:tail --lines 100
  bun run logs:search "error"
  bun run logs:filter --level error --component autopilot
  bun run logs:filter --operation advanceTurnSuccess
`);
    }
  }
};

main();
