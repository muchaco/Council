import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ScriptsDictionary = Record<string, string>;

const readPackageJson = (): {
  scripts?: ScriptsDictionary;
  build?: {
    linux?: {
      target?: ReadonlyArray<string>;
    };
  };
} => {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  const raw = readFileSync(packageJsonPath, "utf8");
  return JSON.parse(raw) as {
    scripts?: ScriptsDictionary;
    build?: {
      linux?: {
        target?: ReadonlyArray<string>;
      };
    };
  };
};

const readWorkflow = (): string => {
  const workflowPath = path.join(process.cwd(), ".github", "workflows", "release-linux.yml");
  return readFileSync(workflowPath, "utf8");
};

export const verifyPackagingPipeline = (): {
  ok: boolean;
  errors: ReadonlyArray<string>;
} => {
  const errors: Array<string> = [];
  const packageJson = readPackageJson();
  const scripts = packageJson.scripts ?? {};
  const packageLinuxScript = scripts["package:linux"];

  if (packageLinuxScript === undefined) {
    errors.push("Missing script: package:linux");
  } else {
    if (!packageLinuxScript.includes("rebuild:native")) {
      errors.push("package:linux must run rebuild:native");
    }
    if (!packageLinuxScript.includes("AppImage")) {
      errors.push("package:linux must target AppImage packaging");
    }
  }

  const linuxTargets = packageJson.build?.linux?.target ?? [];
  if (!linuxTargets.includes("AppImage")) {
    errors.push("electron-builder linux.target must include AppImage");
  }

  const workflowRaw = readWorkflow();
  const requiredWorkflowSnippets = [
    "runs-on: ubuntu-latest",
    "bun run rebuild:native",
    "bun run package:linux",
    "actions/upload-artifact@v4",
  ] as const;

  for (const snippet of requiredWorkflowSnippets) {
    if (!workflowRaw.includes(snippet)) {
      errors.push(`release-linux workflow missing: ${snippet}`);
    }
  }

  if (workflowRaw.includes("runs-on: windows") || workflowRaw.includes("runs-on: macos")) {
    errors.push("release-linux workflow must stay Linux-scoped");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
};

const runCli = (): void => {
  const result = verifyPackagingPipeline();
  if (!result.ok) {
    for (const error of result.errors) {
      console.error(error);
    }
    process.exit(1);
  }

  console.log("Packaging pipeline verification passed.");
};

const scriptPath = process.argv[1];
const currentFilePath = fileURLToPath(import.meta.url);
if (scriptPath !== undefined && path.resolve(scriptPath) === currentFilePath) {
  runCli();
}
