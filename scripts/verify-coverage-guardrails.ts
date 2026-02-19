import path from "node:path";
import { fileURLToPath } from "node:url";

import integrationConfig from "../vitest.integration.config";
import unitConfig from "../vitest.unit.config";

type CoverageConfigLike = {
  include?: ReadonlyArray<string>;
};

type VitestConfigLike = {
  test?: {
    coverage?: CoverageConfigLike;
  };
};

const REQUIRED_UNIT_GLOBS = [
  "src/shared/domain/**/*.ts",
  "src/shared/ipc/validators.ts",
  "src/shared/council-runtime-conductor.ts",
  "src/shared/council-runtime-context-window.ts",
  "src/shared/council-view-runtime-guards.ts",
] as const;

const REQUIRED_INTEGRATION_GLOBS = [
  "src/main/features/**/*.ts",
  "src/main/ipc/**/*.ts",
  "src/main/services/**/*.ts",
  "scripts/**/*.ts",
] as const;

type GuardrailResult = {
  ok: boolean;
  errors: ReadonlyArray<string>;
};

const readCoverageIncludes = (config: unknown): ReadonlyArray<string> => {
  const typedConfig = config as VitestConfigLike;
  const includes = typedConfig.test?.coverage?.include;
  if (includes === undefined) {
    return [];
  }
  return includes;
};

const findMissingGlobs = (
  actualIncludes: ReadonlyArray<string>,
  requiredIncludes: ReadonlyArray<string>,
  label: string,
): ReadonlyArray<string> => {
  const includeSet = new Set(actualIncludes);
  return requiredIncludes
    .filter((required) => !includeSet.has(required))
    .map((required) => `${label} missing coverage include glob: ${required}`);
};

export const verifyCoverageGuardrails = (): GuardrailResult => {
  const unitIncludes = readCoverageIncludes(unitConfig);
  const integrationIncludes = readCoverageIncludes(integrationConfig);

  const errors = [
    ...findMissingGlobs(unitIncludes, REQUIRED_UNIT_GLOBS, "unit"),
    ...findMissingGlobs(integrationIncludes, REQUIRED_INTEGRATION_GLOBS, "integration"),
  ];

  return {
    ok: errors.length === 0,
    errors,
  };
};

const runCli = (): void => {
  const result = verifyCoverageGuardrails();
  if (!result.ok) {
    for (const error of result.errors) {
      console.error(error);
    }
    process.exit(1);
  }

  console.log("Coverage guardrail verification passed.");
};

const scriptPath = process.argv[1];
const currentFilePath = fileURLToPath(import.meta.url);
if (scriptPath !== undefined && path.resolve(scriptPath) === currentFilePath) {
  runCli();
}
