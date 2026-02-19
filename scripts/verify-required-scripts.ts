import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_SCRIPTS = [
  "format:check",
  "lint",
  "typecheck",
  "build",
  "package:linux",
  "test:unit",
  "test:integration",
  "test:coverage",
  "check:coverage-guardrails",
  "check:boundaries",
  "check:packaging-pipeline",
  "check:traceability",
  "db:migrate:verify",
] as const;

type ScriptsDictionary = Record<string, string>;

const readPackageJson = (): { scripts?: ScriptsDictionary } => {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  const raw = readFileSync(packageJsonPath, "utf8");
  return JSON.parse(raw) as { scripts?: ScriptsDictionary };
};

export const verifyRequiredScripts = (): {
  ok: boolean;
  missing: ReadonlyArray<string>;
} => {
  const scripts = readPackageJson().scripts ?? {};
  const missing = REQUIRED_SCRIPTS.filter((scriptName) => scripts[scriptName] === undefined);
  return { ok: missing.length === 0, missing };
};

const runCli = (): void => {
  const result = verifyRequiredScripts();
  if (!result.ok) {
    for (const missingScript of result.missing) {
      console.error(`Missing script: ${missingScript}`);
    }
    process.exit(1);
  }

  console.log("Required scripts verification passed.");
};

const scriptPath = process.argv[1];
const currentFilePath = fileURLToPath(import.meta.url);
if (scriptPath !== undefined && path.resolve(scriptPath) === currentFilePath) {
  runCli();
}
