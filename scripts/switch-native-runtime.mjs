import { spawn } from "node:child_process";

const mode = process.argv[2];

const commandsByMode = {
  electron: {
    command: "bun",
    args: ["run", "rebuild:native"],
    description: "Electron ABI",
  },
  node: {
    command: "npm",
    args: ["rebuild", "better-sqlite3", "keytar"],
    description: "Node/Vitest ABI",
  },
};

if (!(mode in commandsByMode)) {
  console.error("Usage: bun run scripts/switch-native-runtime.mjs <node|electron>");
  process.exit(1);
}

const selected = commandsByMode[mode];

console.log(`[native-runtime] switching native modules to ${selected.description}`);

const child = spawn(selected.command, selected.args, {
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code, signal) => {
  if (signal !== null) {
    console.error(`[native-runtime] command interrupted by signal ${signal}`);
    process.exit(1);
  }

  if ((code ?? 1) !== 0) {
    process.exit(code ?? 1);
  }

  if (mode === "node") {
    console.log("[native-runtime] Node/Vitest native modules are ready");
    console.log("[native-runtime] next typical step: bun run test:integration");
    process.exit(0);
  }

  console.log("[native-runtime] Electron native modules are ready");
  console.log("[native-runtime] next typical step: bun run diag:electron");
  process.exit(0);
});
