import {
  collectAllMappedRequirementIds,
  collectRequirementTraceability,
  extractKnownRequirementIds,
} from "./requirement-traceability";

type CheckResult = {
  ok: boolean;
  unknownRequirementIds: ReadonlyArray<string>;
  unmappedSpecFiles: ReadonlyArray<string>;
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

  return {
    ok: unknownRequirementIds.length === 0 && unmappedSpecFiles.length === 0,
    unknownRequirementIds,
    unmappedSpecFiles,
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

    process.exit(1);
  }

  console.log("Requirement traceability verification passed.");
};

if (import.meta.main) {
  runCli();
}
