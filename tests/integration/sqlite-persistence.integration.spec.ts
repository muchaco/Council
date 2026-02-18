import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createSqlitePersistenceService } from "../../src/main/services/db/sqlite-persistence-service";

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
  it("persists settings and providers across re-open", () => {
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
    expect(loaded.value.providerConfigs).toHaveLength(1);
    expect(loaded.value.providerConfigs[0]?.providerId).toBe("gemini");

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("persists agents across re-open and supports delete", () => {
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

  it("persists councils and member references", () => {
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

    const count = persistence.countCouncilsUsingAgent("00000000-0000-4000-8000-000000000101");
    expect(count.isOk()).toBe(true);
    if (count.isOk()) {
      expect(count.value).toBe(1);
    }

    rmSync(tempDir, { recursive: true, force: true });
  });
});
