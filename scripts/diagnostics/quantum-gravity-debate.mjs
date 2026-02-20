#!/usr/bin/env node
/**
 * Quantum Gravity Physicist Debate - Automated Council Simulation
 *
 * This script creates four physicist agents with distinct personalities:
 * 1. Sabine Hossenfelder - Skeptical empiricist
 * 2. Michio Kaku - Visionary string theorist
 * 3. Brian Cox - Communicator and phenomenologist
 * 4. Garrett Lisi - Geometric theorist (E8)
 *
 * They debate quantum gravity with the goal of reaching a common definition.
 */

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

const BASE_URL = "http://localhost:5173";
const STARTUP_TIMEOUT_MS = 30_000;
const STEP_TIMEOUT_MS = 10_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runBun = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn("bun", args, {
      cwd: projectRoot,
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`bun ${args.join(" ")} failed with code ${String(code)}`));
    });
  });

const waitForDevServer = async (baseUrl, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, { method: "GET" });
      if (response.ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
};

// Generate unique names to avoid conflicts with existing agents
const timestamp = Date.now().toString(36).slice(-4);

const PHYSICIST_AGENTS = [
  {
    name: `Sabine Hossenfelder ${timestamp}`,
    systemPrompt:
      "You are Sabine Hossenfelder, a theoretical physicist known for skepticism toward untestable theories and hype in physics. You are direct, no-nonsense, and emphasize empirical evidence and mathematical rigor over speculation. You are critical of approaches that lack experimental validation. You prefer 4-8 medium-length sentences. Be collegial but firm. Focus on what we can actually measure and test. You often question whether beautiful mathematical structures correspond to physical reality.",
    temperature: 0.7,
    tags: ["physicist", "skeptic", "quantum-gravity"],
    color: "#ef4444",
  },
  {
    name: `Michio Kaku ${timestamp}`,
    systemPrompt:
      "You are Michio Kaku, a theoretical physicist and futurist known for enthusiasm about string theory and the multiverse. You are optimistic, visionary, and speak about the grand unification of forces and higher dimensions. You see beauty in mathematical elegance and believe deeper symmetries reveal nature. You prefer 4-8 medium-length sentences. Be warm and engaging while defending theoretical frameworks. You often reference the music of strings vibrating in higher dimensions. You believe mathematics is the language of the universe.",
    temperature: 0.8,
    tags: ["physicist", "string-theory", "visionary"],
    color: "#3b82f6",
  },
  {
    name: `Brian Cox ${timestamp}`,
    systemPrompt:
      "You are Brian Cox, a physicist and science communicator known for making complex concepts accessible. You focus on observable phenomena and the connection between theory and experiment. You are enthusiastic but grounded, emphasizing what we actually know versus what we speculate. You prefer 4-8 medium-length sentences. Be approachable and explain clearly. You often bridge the gap between abstract mathematics and physical reality, asking how we might test these ideas.",
    temperature: 0.6,
    tags: ["physicist", "communicator", "phenomenology"],
    color: "#10b981",
  },
  {
    name: `Garrett Lisi ${timestamp}`,
    systemPrompt:
      "You are Garrett Lisi, a theoretical physicist who proposed the E8 Theory of Everything based on an exceptional Lie group. You believe the universe has a deep geometric structure and that all forces and particles emerge from a single beautiful mathematical object. You prefer 4-8 medium-length sentences. Be thoughtful and geometric in your reasoning. You see connections between algebra, geometry, and physics, and believe simplicity and mathematical beauty point toward truth.",
    temperature: 0.7,
    tags: ["physicist", "geometry", "e8-theory"],
    color: "#8b5cf6",
  },
];

const main = async () => {
  console.log("[debate] Building main/preload...");
  await runBun(["run", "build:main"]);
  await runBun(["run", "build:preload"]);

  let renderer = null;
  try {
    await fetch(BASE_URL, { method: "GET" });
    console.log("[debate] renderer already running");
  } catch {
    console.log("[debate] starting renderer dev server");
    renderer = spawn("bun", ["run", "dev:renderer"], {
      cwd: projectRoot,
      stdio: "inherit",
      env: process.env,
    });
  }

  await waitForDevServer(BASE_URL, STARTUP_TIMEOUT_MS);

  console.log("[debate] launching electron");
  const app = await electron.launch({
    args: [".", "--disable-gpu", "--disable-software-rasterizer"],
    cwd: projectRoot,
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: BASE_URL,
    },
    timeout: STARTUP_TIMEOUT_MS,
  });

  const artifactsDir = path.resolve(projectRoot, "artifacts", "quantum-gravity-debate");
  await mkdir(artifactsDir, { recursive: true });

  try {
    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded", { timeout: STARTUP_TIMEOUT_MS });

    page.on("console", (msg) => {
      console.log(`[renderer:${msg.type()}] ${msg.text()}`);
    });

    console.log("[debate] waiting for app to load...");
    await page.getByText("Council").first().waitFor({ timeout: STEP_TIMEOUT_MS });

    // Configure Ollama provider for local testing
    console.log("[debate] configuring Ollama provider...");
    await page.locator("button:has-text('Settings')").first().click();
    await page.getByText("Settings").first().waitFor({ timeout: STEP_TIMEOUT_MS });

    // Test connection first to get a valid test token
    const testResult = await page.evaluate(async () => {
      return await window.api.providers.testConnection({
        provider: {
          providerId: "ollama",
          endpointUrl: "http://localhost:11434",
          apiKey: null,
        },
      });
    });

    if (testResult.ok) {
      console.log("[debate] Ollama connection test passed, saving config...");
      const saveResult = await page.evaluate(async (testToken) => {
        return await window.api.providers.saveConfig({
          provider: {
            providerId: "ollama",
            endpointUrl: "http://localhost:11434",
            apiKey: null,
          },
          testToken: testToken,
        });
      }, testResult.value.testToken);

      if (saveResult.ok) {
        console.log("[debate] Ollama provider configured successfully");
      } else {
        console.log(`[debate] Failed to save provider: ${JSON.stringify(saveResult.error)}`);
      }
    } else {
      console.log(`[debate] Ollama connection test failed: ${JSON.stringify(testResult.error)}`);
      console.log(
        "[debate] Continuing without provider - AI generation will fail but agents will be created",
      );
    }

    // Navigate to Agents
    console.log("[debate] navigating to Agents...");
    await page.locator("button:has-text('Agents')").first().click();
    await page.getByText("Agents").first().waitFor({ timeout: STEP_TIMEOUT_MS });

    // Create physicist agents
    const createdAgents = [];
    for (const physicist of PHYSICIST_AGENTS) {
      console.log(`[debate] creating agent: ${physicist.name}...`);
      const result = await page.evaluate(async (agentData) => {
        return await window.api.agents.save({
          viewKind: "agentEdit",
          id: null,
          name: agentData.name,
          systemPrompt: agentData.systemPrompt,
          verbosity: null,
          temperature: agentData.temperature,
          tags: agentData.tags,
          modelRefOrNull: null,
        });
      }, physicist);

      if (!result.ok) {
        throw new Error(
          `Failed to create agent ${physicist.name}: ${JSON.stringify(result.error)}`,
        );
      }

      createdAgents.push({
        ...physicist,
        id: result.value.agent.id,
      });
      console.log(`[debate] created agent ${physicist.name} with id ${result.value.agent.id}`);
      await sleep(500);
    }

    // Navigate to Councils
    console.log("[debate] navigating to Councils...");
    await page.locator("button:has-text('Councils')").first().click();
    await page.getByText("Councils").first().waitFor({ timeout: STEP_TIMEOUT_MS });

    // Create the council
    console.log("[debate] creating quantum gravity council...");
    const memberColors = {};
    const memberAgentIds = createdAgents.map((agent) => {
      memberColors[agent.id] = agent.color;
      return agent.id;
    });

    const councilResult = await page.evaluate(
      async ({ memberAgentIds, memberColors }) => {
        return await window.api.councils.save({
          viewKind: "councilCreate",
          id: null,
          title: "The Nature of Gravity: A Quantum Dialogue",
          topic:
            "Quantum Gravity: Understanding gravity at the quantum scale and seeking a common definitional foundation",
          goal: "Reach a shared, agreed-upon base definition of gravity that incorporates quantum principles and is acceptable to all physicists in this council, regardless of their theoretical framework preferences",
          mode: "autopilot",
          tags: ["physics", "quantum-gravity", "debate"],
          memberAgentIds: memberAgentIds,
          memberColorsByAgentId: memberColors,
          conductorModelRefOrNull: null,
        });
      },
      { memberAgentIds, memberColors },
    );

    if (!councilResult.ok) {
      throw new Error(`Failed to create council: ${JSON.stringify(councilResult.error)}`);
    }

    const councilId = councilResult.value.council.id;
    console.log(`[debate] created council with id ${councilId}`);

    // Start the council
    console.log("[debate] starting council autopilot...");
    const startResult = await page.evaluate(async (id) => {
      return await window.api.councils.start({
        viewKind: "councilView",
        id: id,
        maxTurns: 20,
      });
    }, councilId);

    if (!startResult.ok) {
      throw new Error(`Failed to start council: ${JSON.stringify(startResult.error)}`);
    }

    console.log("[debate] council started successfully");
    await sleep(3000);

    // Take initial screenshot
    await page.screenshot({
      path: path.join(artifactsDir, "debate-initial.png"),
      fullPage: true,
    });
    console.log("[debate] saved initial screenshot");

    // Run conversation turns
    const conversationLog = [];
    const numberOfTurns = 12;

    for (let turn = 1; turn <= numberOfTurns; turn++) {
      console.log(`[debate] running turn ${turn}/${numberOfTurns}...`);

      const turnResult = await page.evaluate(async (id) => {
        return await window.api.councils.advanceAutopilotTurn({
          viewKind: "councilView",
          id: id,
        });
      }, councilId);

      if (turnResult.ok) {
        const message = turnResult.value.message;
        conversationLog.push({
          turn,
          sequenceNumber: message.sequenceNumber,
          sender: message.senderName,
          content: message.content,
        });
        console.log(
          `[debate] turn ${turn}: ${message.senderName} spoke (${message.content.substring(0, 80)}...)`,
        );
      } else {
        console.log(
          `[debate] turn ${turn} failed or completed: ${JSON.stringify(turnResult.error)}`,
        );
        break;
      }

      await sleep(4000);

      // Take midpoint screenshot
      if (turn === Math.floor(numberOfTurns / 2)) {
        await page.screenshot({
          path: path.join(artifactsDir, "debate-midpoint.png"),
          fullPage: true,
        });
        console.log("[debate] saved midpoint screenshot");
      }
    }

    // Get final view with all messages
    const finalView = await page.evaluate(async (id) => {
      return await window.api.councils.getCouncilView({
        viewKind: "councilView",
        id: id,
      });
    }, councilId);

    if (finalView.ok) {
      const allMessages = finalView.value.messages;
      const transcriptParts = [
        "# Quantum Gravity Debate: The Nature of Gravity - A Quantum Dialogue",
        "",
        "## Council Information",
        `- Title: ${finalView.value.council.title}`,
        `- Topic: ${finalView.value.council.topic}`,
        `- Goal: ${finalView.value.council.goal}`,
        `- Mode: ${finalView.value.council.mode}`,
        `- Total Messages: ${String(allMessages.length)}`,
        "",
        "## Participants",
      ];

      for (const a of createdAgents) {
        transcriptParts.push(`- ${a.name} (${a.tags.join(", ")})`);
      }

      transcriptParts.push("");
      transcriptParts.push("## Conversation Transcript");
      transcriptParts.push("");

      for (const m of allMessages) {
        transcriptParts.push(`### ${String(m.sequenceNumber)}. ${m.senderName} [${m.senderKind}]`);
        transcriptParts.push(m.content);
        transcriptParts.push("");
      }

      transcriptParts.push("---");
      transcriptParts.push("Debate conducted automatically using Council3 autopilot system.");

      const transcript = transcriptParts.join("\n");

      await writeFile(path.join(artifactsDir, "debate-transcript.md"), transcript, "utf8");
      console.log("[debate] saved transcript");
    }

    // Export transcript via API
    const exportResult = await page.evaluate(async (id) => {
      return await window.api.councils.exportTranscript({
        viewKind: "councilView",
        id: id,
      });
    }, councilId);

    if (exportResult.ok && exportResult.value.status === "exported") {
      console.log(`[debate] exported transcript to: ${exportResult.value.filePath}`);
    }

    // Final screenshot
    await page.screenshot({
      path: path.join(artifactsDir, "debate-final.png"),
      fullPage: true,
    });
    console.log("[debate] saved final screenshot");

    // Save state summary
    const stateSummary = {
      scenario: "quantum-gravity-debate",
      timestamp: new Date().toISOString(),
      agents: createdAgents.map((a) => ({
        name: a.name,
        id: a.id,
        tags: a.tags,
        color: a.color,
      })),
      council: {
        id: councilId,
        title: finalView.ok ? finalView.value.council.title : "N/A",
        totalMessages: finalView.ok ? finalView.value.messages.length : 0,
        turnsCompleted: finalView.ok ? finalView.value.council.autopilotTurnsCompleted : 0,
      },
      conversation: conversationLog,
    };

    await writeFile(
      path.join(artifactsDir, "debate-state.json"),
      JSON.stringify(stateSummary, null, 2),
      "utf8",
    );
    console.log("[debate] saved state summary");

    console.log("[debate] SUCCESS - Quantum gravity debate completed!");
    console.log(`[debate] Artifacts saved to: ${artifactsDir}`);
  } finally {
    await app.close().catch(() => {});
    if (renderer && !renderer.killed) {
      renderer.kill("SIGTERM");
    }
  }
};

main().catch((error) => {
  console.error("[debate] FAIL", error);
  process.exit(1);
});
