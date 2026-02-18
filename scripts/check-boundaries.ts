import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = process.cwd();
const SRC_ROOT = path.join(PROJECT_ROOT, "src");

const TS_FILE_EXTENSIONS = new Set([".ts", ".tsx"]);

const walkFiles = (directoryPath: string): ReadonlyArray<string> => {
  const entries = readdirSync(directoryPath, { withFileTypes: true });
  const files: Array<string> = [];

  for (const entry of entries) {
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(absolutePath));
      continue;
    }

    if (TS_FILE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(absolutePath);
    }
  }

  return files;
};

const IMPORT_REGEX = /(?:import|export)\s[^"']*["']([^"']+)["']/g;

const extractImports = (sourceText: string): ReadonlyArray<string> => {
  const imports: Array<string> = [];
  let match: RegExpExecArray | null = IMPORT_REGEX.exec(sourceText);
  while (match !== null) {
    const importValue = match[1];
    if (importValue !== undefined) {
      imports.push(importValue);
    }
    match = IMPORT_REGEX.exec(sourceText);
  }
  return imports;
};

const normalizePathForCheck = (absolutePath: string): string => absolutePath.replaceAll("\\", "/");

const resolveImportPath = (filePath: string, importValue: string): string | null => {
  if (!importValue.startsWith(".")) {
    return null;
  }

  const absoluteCandidate = path.resolve(path.dirname(filePath), importValue);
  return normalizePathForCheck(absoluteCandidate);
};

const detectBoundaryViolations = (): ReadonlyArray<string> => {
  const files = walkFiles(SRC_ROOT);
  const violations: Array<string> = [];

  for (const file of files) {
    const normalizedFile = normalizePathForCheck(file);
    const sourceText = readFileSync(file, "utf8");
    const imports = extractImports(sourceText);

    if (normalizedFile.includes("/src/renderer/")) {
      for (const importValue of imports) {
        const resolvedImport = resolveImportPath(file, importValue);
        if (resolvedImport === null) {
          continue;
        }

        if (resolvedImport.includes("/src/main/") || resolvedImport.includes("/src/preload/")) {
          violations.push(
            `Renderer file ${path.relative(PROJECT_ROOT, file)} imports forbidden module ${importValue}`,
          );
        }
      }
    }

    if (normalizedFile.includes("/src/shared/domain/")) {
      for (const importValue of imports) {
        if (
          importValue.startsWith("node:") ||
          importValue === "electron" ||
          importValue.includes("/main/") ||
          importValue.includes("/preload/")
        ) {
          violations.push(
            `Domain file ${path.relative(PROJECT_ROOT, file)} imports forbidden dependency ${importValue}`,
          );
        }
      }
    }
  }

  return violations;
};

export const runBoundaryCheck = (): { ok: boolean; violations: ReadonlyArray<string> } => {
  const violations = detectBoundaryViolations();
  return { ok: violations.length === 0, violations };
};

const runCli = (): void => {
  const result = runBoundaryCheck();
  if (!result.ok) {
    for (const violation of result.violations) {
      console.error(violation);
    }
    process.exit(1);
  }

  console.log("Boundary check passed.");
};

const scriptPath = process.argv[1];
const currentFilePath = fileURLToPath(import.meta.url);
if (scriptPath !== undefined && path.resolve(scriptPath) === currentFilePath) {
  runCli();
}
