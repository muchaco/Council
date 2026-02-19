import {
  collectAllMappedRequirementIds,
  collectRequirementTraceability,
  extractKnownRequirementIds,
} from "./requirement-traceability";

type CheckResult = {
  ok: boolean;
  unknownRequirementIds: ReadonlyArray<string>;
  unmappedSpecFiles: ReadonlyArray<string>;
  filesWithUnannotatedTests: ReadonlyArray<string>;
  filesUsingPlainIt: ReadonlyArray<string>;
};

export const checkRequirementTraceability = (): CheckResult => {
  const entries = collectRequirementTraceability();
  const knownRequirementIds = extractKnownRequirementIds();
  const mappedRequirementIds = collectAllMappedRequirementIds(entries);

  const unknownRequirementIds = mappedRequirementIds.filter(
    (requirementId) => !knownRequirementIds.has(requirementId),
  );

  const unmappedSpecFiles = entries
    .filter((entry) => entry.cases.length === 0)
    .map((entry) => entry.filePath)
    .sort((left, right) => left.localeCompare(right));

  const filesWithUnannotatedTests = entries
    .filter((entry) => entry.itReqInvocationCount !== entry.cases.length)
    .map(
      (entry) =>
        `${entry.filePath} (${entry.cases.length}/${entry.itReqInvocationCount} mapped itReq calls)`,
    )
    .sort((left, right) => left.localeCompare(right));

  const filesUsingPlainIt = entries
    .filter((entry) => entry.plainItCount > 0)
    .map((entry) => `${entry.filePath} (${entry.plainItCount} plain it calls)`)
    .sort((left, right) => left.localeCompare(right));

  return {
    ok:
      unknownRequirementIds.length === 0 &&
      unmappedSpecFiles.length === 0 &&
      filesWithUnannotatedTests.length === 0 &&
      filesUsingPlainIt.length === 0,
    unknownRequirementIds,
    unmappedSpecFiles,
    filesWithUnannotatedTests,
    filesUsingPlainIt,
  };
};

const runCli = (): void => {
  const result = checkRequirementTraceability();

  if (!result.ok) {
    for (const requirementId of result.unknownRequirementIds) {
      console.error(`Unknown requirement ID in traceability mapping: ${requirementId}`);
    }

    for (const filePath of result.unmappedSpecFiles) {
      console.error(`Spec file has no requirement mapping: ${filePath}`);
    }

    for (const filePath of result.filesWithUnannotatedTests) {
      console.error(`Spec file has unannotated tests: ${filePath}`);
    }

    for (const filePath of result.filesUsingPlainIt) {
      console.error(`Spec file still uses plain it(...) instead of itReq(...): ${filePath}`);
    }

    process.exit(1);
  }

  console.log("Requirement traceability verification passed.");
};

if (import.meta.main) {
  runCli();
}
