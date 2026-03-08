import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect } from "vitest";
import { createSqlitePersistenceService } from "../../src/main/services/db/sqlite-persistence-service";
import { itReq } from "../helpers/requirement-trace";

const FILE_REQUIREMENT_IDS = [
  "B1",
  "B2",
  "B3",
  "R4.22",
  "R7.1",
  "R2.1",
  "R3.3",
  "R3.7",
  "R3.8",
  "R3.23",
] as const;

const createTempPersistence = () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "council3-db-"));
  const dbFilePath = path.join(tempDir, "council3.sqlite3");
  const migrationsDirPath = path.join(process.cwd(), "src", "main", "services", "db", "migrations");
  const persistence = createSqlitePersistenceService({
    dbFilePath,
    migrationsDirPath,
  });

  return {
    tempDir,
    persistence,
  };
};

describe("sqlite persistence service", () => {
  itReq(FILE_REQUIREMENT_IDS, "persists settings and providers across re-open", () => {
    const { tempDir, persistence } = createTempPersistence();

    const init = persistence.initialize();
    expect(init.isOk()).toBe(true);

    const saveProvider = persistence.saveProviderConfig({
      providerId: "gemini",
      endpointUrl: null,
      credentialRef: "provider/gemini",
      lastSavedAtUtc: "2026-02-18T10:00:00.000Z",
      models: ["gemini-1.5-flash"],
    });
    expect(saveProvider.isOk()).toBe(true);

    const saveGlobal = persistence.saveGlobalDefaultModel(
      {
        providerId: "gemini",
        modelId: "gemini-1.5-flash",
      },
      "2026-02-18T10:00:01.000Z",
    );
    expect(saveGlobal.isOk()).toBe(true);

    const saveContext = persistence.saveContextLastN(14, "2026-02-18T10:00:02.000Z");
    expect(saveContext.isOk()).toBe(true);

    const reloaded = createSqlitePersistenceService({
      dbFilePath: path.join(tempDir, "council3.sqlite3"),
      migrationsDirPath: path.join(process.cwd(), "src", "main", "services", "db", "migrations"),
    });
    expect(reloaded.initialize().isOk()).toBe(true);

    const loaded = reloaded.loadSettingsState();
    expect(loaded.isOk()).toBe(true);
    if (loaded.isErr()) {
      rmSync(tempDir, { recursive: true, force: true });
      return;
    }

    expect(loaded.value.globalDefaultModelRef).toEqual({
      providerId: "gemini",
      modelId: "gemini-1.5-flash",
    });
    expect(loaded.value.contextLastN).toBe(14);
    expect(loaded.value.providerConfigs).toHaveLength(1);
    expect(loaded.value.providerConfigs[0]?.providerId).toBe("gemini");

    rmSync(tempDir, { recursive: true, force: true });
  });

  itReq(FILE_REQUIREMENT_IDS, "deletes persisted provider configs", () => {
    const { tempDir, persistence } = createTempPersistence();

    expect(persistence.initialize().isOk()).toBe(true);
    expect(
      persistence
        .saveProviderConfig({
          providerId: "gemini",
          endpointUrl: null,
          credentialRef: "provider/gemini",
          lastSavedAtUtc: "2026-02-18T10:00:00.000Z",
          models: ["gemini-1.5-flash"],
        })
        .isOk(),
    ).toBe(true);

    expect(persistence.deleteProviderConfig("gemini").isOk()).toBe(true);

    const loaded = persistence.loadSettingsState();
    expect(loaded.isOk()).toBe(true);
    if (loaded.isOk()) {
      expect(loaded.value.providerConfigs).toHaveLength(0);
    }

    rmSync(tempDir, { recursive: true, force: true });
  });

  itReq(FILE_REQUIREMENT_IDS, "persists agents across re-open and supports delete", () => {
    const { tempDir, persistence } = createTempPersistence();
    expect(persistence.initialize().isOk()).toBe(true);

    const saveAgent = persistence.saveAgent({
      id: "00000000-0000-4000-8000-000000000001",
      name: "Planner",
      systemPrompt: "Create good plans",
      verbosity: null,
      temperature: 0.5,
      tags: ["plan", "ops"],
      modelRefOrNull: {
        providerId: "gemini",
        modelId: "gemini-1.5-flash",
      },
      archivedAtUtc: null,
      createdAtUtc: "2026-02-18T10:00:00.000Z",
      updatedAtUtc: "2026-02-18T10:00:00.000Z",
    });
    expect(saveAgent.isOk()).toBe(true);

    const loaded = persistence.loadAgents();
    expect(loaded.isOk()).toBe(true);
    if (loaded.isErr()) {
      rmSync(tempDir, { recursive: true, force: true });
      return;
    }

    expect(loaded.value).toHaveLength(1);
    expect(loaded.value[0]?.name).toBe("Planner");

    const deleted = persistence.deleteAgent("00000000-0000-4000-8000-000000000001");
    expect(deleted.isOk()).toBe(true);

    const loadedAfterDelete = persistence.loadAgents();
    expect(loadedAfterDelete.isOk()).toBe(true);
    if (loadedAfterDelete.isOk()) {
      expect(loadedAfterDelete.value).toHaveLength(0);
    }

    rmSync(tempDir, { recursive: true, force: true });
  });

  itReq(FILE_REQUIREMENT_IDS, "persists councils and member references", () => {
    const { tempDir, persistence } = createTempPersistence();
    expect(persistence.initialize().isOk()).toBe(true);

    expect(
      persistence
        .saveAgent({
          id: "00000000-0000-4000-8000-000000000101",
          name: "Planner",
          systemPrompt: "Plan",
          verbosity: null,
          temperature: null,
          tags: [],
          modelRefOrNull: null,
          archivedAtUtc: null,
          createdAtUtc: "2026-02-18T10:00:00.000Z",
          updatedAtUtc: "2026-02-18T10:00:00.000Z",
        })
        .isOk(),
    ).toBe(true);

    expect(
      persistence
        .saveCouncil({
          id: "00000000-0000-4000-8000-000000009001",
          title: "Ops Council",
          topic: "Incident reduction",
          goal: null,
          mode: "manual",
          tags: ["ops"],
          memberAgentIds: ["00000000-0000-4000-8000-000000000101"],
          memberColorsByAgentId: {
            "00000000-0000-4000-8000-000000000101": "#2d6cdf",
          },
          conductorModelRefOrNull: null,
          archivedAtUtc: null,
          startedAtUtc: "2026-02-18T10:02:00.000Z",
          autopilotPaused: false,
          autopilotMaxTurns: null,
          autopilotTurnsCompleted: 0,
          turnCount: 3,
          createdAtUtc: "2026-02-18T10:00:01.000Z",
          updatedAtUtc: "2026-02-18T10:00:01.000Z",
        })
        .isOk(),
    ).toBe(true);

    const loaded = persistence.loadCouncils();
    expect(loaded.isOk()).toBe(true);
    if (loaded.isErr()) {
      rmSync(tempDir, { recursive: true, force: true });
      return;
    }

    expect(loaded.value).toHaveLength(1);
    expect(loaded.value[0]?.title).toBe("Ops Council");
    expect(loaded.value[0]?.memberAgentIds).toEqual(["00000000-0000-4000-8000-000000000101"]);
    expect(loaded.value[0]?.startedAtUtc).toBe("2026-02-18T10:02:00.000Z");
    expect(loaded.value[0]?.autopilotPaused).toBe(false);
    expect(loaded.value[0]?.autopilotMaxTurns).toBeNull();
    expect(loaded.value[0]?.autopilotTurnsCompleted).toBe(0);
    expect(loaded.value[0]?.turnCount).toBe(3);

    const count = persistence.countCouncilsUsingAgent("00000000-0000-4000-8000-000000000101");
    expect(count.isOk()).toBe(true);
    if (count.isOk()) {
      expect(count.value).toBe(1);
    }

    rmSync(tempDir, { recursive: true, force: true });
  });

  itReq(FILE_REQUIREMENT_IDS, "persists council transcript messages and runtime briefing", () => {
    const { tempDir, persistence } = createTempPersistence();
    expect(persistence.initialize().isOk()).toBe(true);

    expect(
      persistence
        .saveAgent({
          id: "00000000-0000-4000-8000-000000000151",
          name: "Analyst",
          systemPrompt: "Analyze",
          verbosity: null,
          temperature: null,
          tags: [],
          modelRefOrNull: null,
          archivedAtUtc: null,
          createdAtUtc: "2026-02-18T10:00:00.000Z",
          updatedAtUtc: "2026-02-18T10:00:00.000Z",
        })
        .isOk(),
    ).toBe(true);

    expect(
      persistence
        .saveCouncil({
          id: "00000000-0000-4000-8000-000000009151",
          title: "Transcript Council",
          topic: "Message persistence",
          goal: null,
          mode: "manual",
          tags: [],
          memberAgentIds: ["00000000-0000-4000-8000-000000000151"],
          memberColorsByAgentId: {},
          conductorModelRefOrNull: null,
          archivedAtUtc: null,
          startedAtUtc: "2026-02-18T10:05:00.000Z",
          autopilotPaused: true,
          autopilotMaxTurns: 5,
          autopilotTurnsCompleted: 2,
          turnCount: 0,
          createdAtUtc: "2026-02-18T10:00:01.000Z",
          updatedAtUtc: "2026-02-18T10:00:01.000Z",
        })
        .isOk(),
    ).toBe(true);

    const first = persistence.appendCouncilMessage({
      id: "00000000-0000-4000-8000-000000001001",
      councilId: "00000000-0000-4000-8000-000000009151",
      senderKind: "conductor",
      senderAgentId: null,
      senderName: "Conductor",
      senderColor: null,
      content: "Kickoff",
      createdAtUtc: "2026-02-18T10:05:10.000Z",
    });
    expect(first.isOk()).toBe(true);
    if (first.isOk()) {
      expect(first.value.sequenceNumber).toBe(1);
    }

    const second = persistence.appendCouncilMessage({
      id: "00000000-0000-4000-8000-000000001002",
      councilId: "00000000-0000-4000-8000-000000009151",
      senderKind: "member",
      senderAgentId: "00000000-0000-4000-8000-000000000151",
      senderName: "Analyst",
      senderColor: "#8899aa",
      content: "Reply",
      createdAtUtc: "2026-02-18T10:05:20.000Z",
    });
    expect(second.isOk()).toBe(true);
    if (second.isOk()) {
      expect(second.value.sequenceNumber).toBe(2);
    }

    expect(
      persistence
        .saveCouncilRuntimeBriefing({
          councilId: "00000000-0000-4000-8000-000000009151",
          briefing: "Concise latest briefing",
          goalReached: false,
          updatedAtUtc: "2026-02-18T10:05:25.000Z",
        })
        .isOk(),
    ).toBe(true);

    const loadedMessages = persistence.loadCouncilMessages("00000000-0000-4000-8000-000000009151");
    expect(loadedMessages.isOk()).toBe(true);
    if (loadedMessages.isOk()) {
      expect(loadedMessages.value).toHaveLength(2);
      expect(loadedMessages.value.map((message) => message.sequenceNumber)).toEqual([1, 2]);
    }

    const loadedBriefing = persistence.loadCouncilRuntimeBriefing(
      "00000000-0000-4000-8000-000000009151",
    );
    expect(loadedBriefing.isOk()).toBe(true);
    if (loadedBriefing.isOk()) {
      expect(loadedBriefing.value?.briefing).toBe("Concise latest briefing");
    }

    rmSync(tempDir, { recursive: true, force: true });
  });
});
