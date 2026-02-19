import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  type TraceabilityEntry,
  collectAllMappedRequirementIds,
  collectRequirementTraceability,
} from "./requirement-traceability";

type TraceabilityDocument = {
  generatedAtUtc: string;
  summary: {
    specFilesTracked: number;
    testCasesTracked: number;
    perTestCases: number;
    legacyFileCases: number;
    mappedRequirementIds: number;
  };
  entries: ReadonlyArray<TraceabilityEntry>;
};

const outputDirectoryPath = path.join(process.cwd(), "docs/traceability");
const outputJsonPath = path.join(outputDirectoryPath, "requirements-traceability.generated.json");
const outputMarkdownPath = path.join(outputDirectoryPath, "requirements-traceability.generated.md");
const statusMarkdownPath = path.join(process.cwd(), "docs/status.md");

const statusBlockStart = "<!-- TRACEABILITY:BEGIN -->";
const statusBlockEnd = "<!-- TRACEABILITY:END -->";

const toMarkdown = (document: TraceabilityDocument): string => {
  const lines: Array<string> = [];
  lines.push("# Test-to-Requirement Index (Generated)");
  lines.push("");
  lines.push(`Generated at: ${document.generatedAtUtc}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Spec files tracked: ${document.summary.specFilesTracked}`);
  lines.push(`- Test cases tracked: ${document.summary.testCasesTracked}`);
  lines.push(`- Per-test mapped cases: ${document.summary.perTestCases}`);
  lines.push(`- Legacy file-level mapped cases: ${document.summary.legacyFileCases}`);
  lines.push(`- Unique mapped requirement IDs: ${document.summary.mappedRequirementIds}`);
  lines.push("");
  lines.push("## Index");
  lines.push("");

  for (const entry of document.entries) {
    lines.push(`- \`${entry.filePath}\``);
    for (const testCase of entry.cases) {
      if (testCase.name === "*") {
        lines.push(`  - [${testCase.source}] \`*\` -> ${testCase.requirementIds.join(", ")}`);
      } else {
        lines.push(
          `  - [${testCase.source}] \`${testCase.name}\` -> ${testCase.requirementIds.join(", ")}`,
        );
      }
    }
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
};

const updateStatusTraceabilityBlock = (document: TraceabilityDocument): void => {
  const statusMarkdown = readFileSync(statusMarkdownPath, "utf8");
  const blockPattern = new RegExp(`${statusBlockStart}[\\s\\S]*?${statusBlockEnd}`);

  if (!blockPattern.test(statusMarkdown)) {
    throw new Error(
      `Missing traceability markers in docs/status.md: ${statusBlockStart} ... ${statusBlockEnd}`,
    );
  }

  const replacementBlock = [
    statusBlockStart,
    "Generated source-of-truth files:",
    "- `docs/traceability/requirements-traceability.generated.json`",
    "- `docs/traceability/requirements-traceability.generated.md`",
    `Last generated: ${document.generatedAtUtc}`,
    `Coverage snapshot: ${document.summary.specFilesTracked} specs, ${document.summary.testCasesTracked} test entries, ${document.summary.mappedRequirementIds} mapped requirement IDs.`,
    statusBlockEnd,
  ].join("\n");

  const nextStatusMarkdown = statusMarkdown.replace(blockPattern, replacementBlock);
  writeFileSync(statusMarkdownPath, nextStatusMarkdown);
};

export const generateRequirementTraceability = (): TraceabilityDocument => {
  const generatedAtUtc = new Date().toISOString();
  const entries = collectRequirementTraceability();

  const testCases = entries.flatMap((entry) => entry.cases);
  const mappedRequirementIds = collectAllMappedRequirementIds(entries);

  const document: TraceabilityDocument = {
    generatedAtUtc,
    summary: {
      specFilesTracked: entries.length,
      testCasesTracked: testCases.length,
      perTestCases: testCases.filter((testCase) => testCase.source === "itReq").length,
      legacyFileCases: testCases.filter((testCase) => testCase.source === "legacy-file-map").length,
      mappedRequirementIds: mappedRequirementIds.length,
    },
    entries,
  };

  mkdirSync(outputDirectoryPath, { recursive: true });
  writeFileSync(outputJsonPath, `${JSON.stringify(document, null, 2)}\n`);
  writeFileSync(outputMarkdownPath, toMarkdown(document));
  updateStatusTraceabilityBlock(document);

  return document;
};

const runCli = (): void => {
  const document = generateRequirementTraceability();
  console.log(
    `Generated traceability for ${document.summary.specFilesTracked} specs (${document.summary.mappedRequirementIds} requirement IDs).`,
  );
};

if (import.meta.main) {
  runCli();
}
