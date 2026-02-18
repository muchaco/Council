import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATIONS_DIR = path.join(process.cwd(), "src", "main", "services", "db", "migrations");
const MIGRATION_NAME_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/;

export const verifyMigrations = (): { ok: boolean; errors: ReadonlyArray<string> } => {
  const errors: Array<string> = [];

  if (!existsSync(MIGRATIONS_DIR)) {
    errors.push("Missing migrations directory at src/main/services/db/migrations");
    return { ok: false, errors };
  }

  const migrationFiles = readdirSync(MIGRATIONS_DIR)
    .filter((entry) => entry.endsWith(".sql"))
    .sort();

  if (migrationFiles.length === 0) {
    errors.push("At least one migration file is required.");
    return { ok: false, errors };
  }

  let lastSequence = 0;
  for (const fileName of migrationFiles) {
    if (!MIGRATION_NAME_PATTERN.test(fileName)) {
      errors.push(`Invalid migration filename '${fileName}'. Use NNNN_name.sql`);
      continue;
    }

    const sequence = Number.parseInt(fileName.slice(0, 4), 10);
    if (sequence <= lastSequence) {
      errors.push(`Migration sequence is not strictly increasing at '${fileName}'.`);
    }
    lastSequence = sequence;
  }

  return { ok: errors.length === 0, errors };
};

const runCli = (): void => {
  const result = verifyMigrations();
  if (!result.ok) {
    for (const error of result.errors) {
      console.error(error);
    }
    process.exit(1);
  }

  console.log("Migration verification passed.");
};

const scriptPath = process.argv[1];
const currentFilePath = fileURLToPath(import.meta.url);
if (scriptPath !== undefined && path.resolve(scriptPath) === currentFilePath) {
  runCli();
}
