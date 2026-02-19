import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { LEGACY_FILE_REQUIREMENT_MAP } from "../tests/requirements-file-map";

const REQUIREMENT_ID_PATTERN = /\b(?:R\d+\.\d+|U\d+\.\d+|[A-I]\d+|IMPL-\d+)\b/g;

export type TraceSource = "itReq" | "legacy-file-map";

export type TraceabilityCase = {
  name: string;
  requirementIds: ReadonlyArray<string>;
  source: TraceSource;
};

export type TraceabilityEntry = {
  filePath: string;
  cases: ReadonlyArray<TraceabilityCase>;
};

const listSpecFiles = (directoryPath: string): ReadonlyArray<string> => {
  const entries = readdirSync(directoryPath, { withFileTypes: true });
  const filePaths: Array<string> = [];

  for (const entry of entries) {
    const resolvedPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      filePaths.push(...listSpecFiles(resolvedPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".spec.ts")) {
      filePaths.push(resolvedPath);
    }
  }

  return filePaths;
};

const asRepoRelativePath = (absoluteFilePath: string): string => {
  return path.relative(process.cwd(), absoluteFilePath).split(path.sep).join("/");
};

const normalizeIds = (ids: ReadonlyArray<string>): ReadonlyArray<string> => {
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right));
};

const parseIdsFromArrayLiteral = (arrayLiteral: string): ReadonlyArray<string> => {
  const matches = arrayLiteral.match(REQUIREMENT_ID_PATTERN) ?? [];
  return normalizeIds(matches);
};

const parseItReqCases = (sourceText: string): ReadonlyArray<TraceabilityCase> => {
  const itReqPattern = /itReq\s*\(\s*\[([\s\S]*?)\]\s*,\s*(["'`])([\s\S]*?)\2\s*,/g;
  const cases: Array<TraceabilityCase> = [];
  let match: RegExpExecArray | null = itReqPattern.exec(sourceText);

  while (match !== null) {
    const ids = parseIdsFromArrayLiteral(match[1] ?? "");
    const name = (match[3] ?? "").replace(/\s+/g, " ").trim();
    if (ids.length > 0 && name.length > 0) {
      cases.push({ name, requirementIds: ids, source: "itReq" });
    }

    match = itReqPattern.exec(sourceText);
  }

  return cases;
};

export const collectRequirementTraceability = (): ReadonlyArray<TraceabilityEntry> => {
  const testsRoot = path.join(process.cwd(), "tests");
  const files = listSpecFiles(testsRoot)
    .map((absolutePath) => asRepoRelativePath(absolutePath))
    .sort((left, right) => left.localeCompare(right));

  const entries: Array<TraceabilityEntry> = [];

  for (const relativeFilePath of files) {
    const sourceText = readFileSync(path.join(process.cwd(), relativeFilePath), "utf8");
    const perTestCases = parseItReqCases(sourceText);
    if (perTestCases.length > 0) {
      entries.push({ filePath: relativeFilePath, cases: perTestCases });
      continue;
    }

    const legacyIds =
      LEGACY_FILE_REQUIREMENT_MAP[relativeFilePath as keyof typeof LEGACY_FILE_REQUIREMENT_MAP] ??
      [];
    if (legacyIds.length > 0) {
      entries.push({
        filePath: relativeFilePath,
        cases: [
          {
            name: "*",
            requirementIds: normalizeIds([...legacyIds]),
            source: "legacy-file-map",
          },
        ],
      });
      continue;
    }

    entries.push({ filePath: relativeFilePath, cases: [] });
  }

  return entries;
};

export const collectAllMappedRequirementIds = (
  entries: ReadonlyArray<TraceabilityEntry>,
): ReadonlyArray<string> => {
  const ids = entries.flatMap((entry) =>
    entry.cases.flatMap((testCase) => testCase.requirementIds),
  );
  return normalizeIds(ids);
};

export const extractKnownRequirementIds = (): ReadonlySet<string> => {
  const sources = [
    readFileSync(path.join(process.cwd(), "docs/requirements.md"), "utf8"),
    readFileSync(path.join(process.cwd(), "docs/ux-requirements.md"), "utf8"),
    readFileSync(path.join(process.cwd(), "docs/status.md"), "utf8"),
  ];

  const ids = sources.flatMap((sourceText) => sourceText.match(REQUIREMENT_ID_PATTERN) ?? []);
  return new Set(ids);
};

export const extractTableInProgressRequirementIds = (): ReadonlySet<string> => {
  const statusMarkdown = readFileSync(path.join(process.cwd(), "docs/status.md"), "utf8");
  const lines = statusMarkdown.split(/\r?\n/);
  const ids = new Set<string>();

  for (const line of lines) {
    if (!line.startsWith("|")) {
      continue;
    }

    const columns = line.split("|").map((column) => column.trim());
    if (columns.length < 4) {
      continue;
    }

    const requirementCell = columns[1] ?? "";
    const statusCell = columns[2] ?? "";
    if (statusCell !== "In progress") {
      continue;
    }

    const rowIds = requirementCell.match(REQUIREMENT_ID_PATTERN) ?? [];
    for (const id of rowIds) {
      ids.add(id);
    }
  }

  return ids;
};
