import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

const DEFAULT_BASE_URL = "http://localhost:5173";
const DEFAULT_STARTUP_TIMEOUT_MS = 30_000;
const DEFAULT_STEP_TIMEOUT_MS = 10_000;

const defaultScenario = {
  name: "default-smoke",
  steps: [
    { action: "waitForText", text: "Settings" },
    { action: "waitForText", text: "Providers" },
    {
      action: "evaluate",
      expression:
        "() => ({ apiType: typeof window.api, hasSettingsGetView: typeof window.api?.settings?.getView === 'function' })",
    },
    {
      action: "screenshot",
      file: "default-smoke.png",
      fullPage: true,
    },
  ],
};

const parseArgs = (argv) => {
  const options = {
    scenarioPath: null,
    baseUrl: DEFAULT_BASE_URL,
    artifactsDir: path.resolve(projectRoot, "artifacts", "electron-tool"),
    startupTimeoutMs: DEFAULT_STARTUP_TIMEOUT_MS,
    stepTimeoutMs: DEFAULT_STEP_TIMEOUT_MS,
    skipBuild: false,
    skipRenderer: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--scenario" && next !== undefined) {
      options.scenarioPath = path.resolve(projectRoot, next);
      index += 1;
      continue;
    }
    if (arg === "--base-url" && next !== undefined) {
      options.baseUrl = next;
      index += 1;
      continue;
    }
    if (arg === "--artifacts-dir" && next !== undefined) {
      options.artifactsDir = path.resolve(projectRoot, next);
      index += 1;
      continue;
    }
    if (arg === "--startup-timeout-ms" && next !== undefined) {
      options.startupTimeoutMs = Number.parseInt(next, 10);
      index += 1;
      continue;
    }
    if (arg === "--step-timeout-ms" && next !== undefined) {
      options.stepTimeoutMs = Number.parseInt(next, 10);
      index += 1;
      continue;
    }
    if (arg === "--skip-build") {
      options.skipBuild = true;
      continue;
    }
    if (arg === "--skip-renderer") {
      options.skipRenderer = true;
    }
  }

  return options;
};

const runBun = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn("bun", args, {
      cwd: projectRoot,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`bun ${args.join(" ")} failed with code ${String(code)}`));
    });
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const terminateChildProcess = async (child, timeoutMs = 5_000) => {
  if (child === null) {
    return;
  }

  if (child.killed) {
    return;
  }

  await new Promise((resolve) => {
    let finished = false;

    const done = () => {
      if (finished) {
        return;
      }
      finished = true;
      resolve();
    };

    child.once("exit", done);
    child.kill("SIGTERM");

    setTimeout(() => {
      if (!finished) {
        child.kill("SIGKILL");
      }
    }, timeoutMs);

    setTimeout(done, timeoutMs + 500);
  });
};

const isDevServerReady = async (baseUrl) => {
  try {
    const response = await fetch(baseUrl, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
};

const waitForDevServer = async (baseUrl, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, { method: "GET" });
      if (response.ok) {
        return;
      }
    } catch {
      // noop
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
};

const loadScenario = async (scenarioPath) => {
  if (scenarioPath === null) {
    return defaultScenario;
  }

  const raw = await readFile(scenarioPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed?.steps)) {
    throw new Error(`Scenario at ${scenarioPath} must include a steps array.`);
  }

  return parsed;
};

const runStep = async ({ page, step, defaultTimeoutMs, artifactsDir, state }) => {
  const timeout = typeof step.timeoutMs === "number" ? step.timeoutMs : defaultTimeoutMs;
  const action = step.action;
  console.log(`[tool] step: ${action}`);

  if (action === "waitForText") {
    await page.getByText(String(step.text)).first().waitFor({ timeout });
    return;
  }

  if (action === "waitForSelector") {
    await page.waitForSelector(String(step.selector), {
      state: step.state ?? "visible",
      timeout,
    });
    return;
  }

  if (action === "click") {
    await page.locator(String(step.selector)).first().click({ timeout });
    return;
  }

  if (action === "fill") {
    await page.locator(String(step.selector)).first().fill(String(step.value), { timeout });
    return;
  }

  if (action === "press") {
    await page.keyboard.press(String(step.key));
    return;
  }

  if (action === "selectOption") {
    await page.locator(String(step.selector)).first().selectOption(String(step.value), { timeout });
    return;
  }

  if (action === "expectVisible") {
    await page.locator(String(step.selector)).first().waitFor({ state: "visible", timeout });
    return;
  }

  if (action === "expectText") {
    const text = await page.locator(String(step.selector)).first().innerText({ timeout });
    if (!text.includes(String(step.text))) {
      throw new Error(
        `expectText failed for selector ${String(step.selector)}. Did not find ${String(step.text)}.`,
      );
    }
    return;
  }

  if (action === "evaluate") {
    const evaluated = await page.evaluate(`(${String(step.expression)})()`);
    if (step.saveAs !== undefined) {
      state[step.saveAs] = evaluated;
    }
    console.log("[tool] evaluate result", JSON.stringify(evaluated));
    return;
  }

  if (action === "assertSaved") {
    const value = state[step.key];
    if (value === undefined) {
      throw new Error(`assertSaved failed. Missing state key ${String(step.key)}.`);
    }
    if (step.equals !== undefined) {
      const expected = step.equals;
      if (JSON.stringify(value) !== JSON.stringify(expected)) {
        throw new Error(`assertSaved equals failed for ${String(step.key)}.`);
      }
    }
    if (step.hasPath !== undefined) {
      const segments = String(step.hasPath)
        .split(".")
        .filter((segment) => segment.length > 0);
      let current = value;
      for (const segment of segments) {
        if (typeof current !== "object" || current === null || !(segment in current)) {
          throw new Error(
            `assertSaved hasPath failed for ${String(step.key)}.${segments.join(".")}.`,
          );
        }
        current = current[segment];
      }
    }
    return;
  }

  if (action === "screenshot") {
    const relativeFile = step.file ? String(step.file) : `step-${Date.now()}.png`;
    const filePath = path.resolve(artifactsDir, relativeFile);
    await mkdir(path.dirname(filePath), { recursive: true });
    await page.screenshot({ path: filePath, fullPage: Boolean(step.fullPage) });
    console.log(`[tool] screenshot saved: ${filePath}`);
    return;
  }

  throw new Error(`Unsupported action: ${String(action)}`);
};

const run = async () => {
  const options = parseArgs(process.argv.slice(2));
  const scenario = await loadScenario(options.scenarioPath);
  await mkdir(options.artifactsDir, { recursive: true });

  console.log(`[tool] scenario: ${scenario.name ?? "unnamed"}`);
  console.log(`[tool] artifacts: ${options.artifactsDir}`);

  if (!options.skipBuild) {
    console.log("[tool] building main/preload");
    await runBun(["run", "build:main"]);
    await runBun(["run", "build:preload"]);
  }

  let renderer = null;
  if (!options.skipRenderer && !(await isDevServerReady(options.baseUrl))) {
    console.log("[tool] starting renderer dev server");
    renderer = spawn("bun", ["run", "dev:renderer"], {
      cwd: projectRoot,
      stdio: "inherit",
      env: process.env,
    });
  } else if (!options.skipRenderer) {
    console.log("[tool] renderer already running; reusing existing dev server");
  }

  let app;
  try {
    await waitForDevServer(options.baseUrl, options.startupTimeoutMs);

    console.log("[tool] launching electron");
    app = await electron.launch({
      args: [".", "--disable-gpu", "--disable-software-rasterizer"],
      cwd: projectRoot,
      env: {
        ...process.env,
        VITE_DEV_SERVER_URL: options.baseUrl,
      },
      timeout: options.startupTimeoutMs,
    });

    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded", { timeout: options.startupTimeoutMs });
    page.on("dialog", (dialog) => {
      void dialog.dismiss().catch(() => {
        // noop
      });
    });
    page.on("console", (message) => {
      console.log(`[renderer:${message.type()}] ${message.text()}`);
    });

    const state = {};
    for (const step of scenario.steps) {
      await runStep({
        page,
        step,
        defaultTimeoutMs: options.stepTimeoutMs,
        artifactsDir: options.artifactsDir,
        state,
      });
    }

    const statePath = path.resolve(
      options.artifactsDir,
      `${scenario.name ?? "scenario"}.state.json`,
    );
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    console.log(`[tool] state saved: ${statePath}`);
    console.log("[tool] PASS");
  } finally {
    if (app !== undefined) {
      await app.close().catch(() => {
        // noop
      });
    }
    await terminateChildProcess(renderer);
  }
};

run().catch((error) => {
  console.error("[tool] FAIL", error);
  process.exitCode = 1;
});
