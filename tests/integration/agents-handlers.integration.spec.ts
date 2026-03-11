import { okAsync } from "neverthrow";
import { describe, expect } from "vitest";
import { createAgentsSlice } from "../../src/main/features/agents/slice";
import { asAgentId } from "../../src/shared/domain/ids";
import { itReq } from "../helpers/requirement-trace";

const FILE_REQUIREMENT_IDS = [
  "R1.1",
  "R1.2",
  "R1.4",
  "R1.5",
  "R1.8",
  "R1.9",
  "R1.12",
  "R1.13",
  "R1.14",
  "R1.15",
  "R1.16",
  "R1.17",
  "R1.18",
  "R1.19",
  "R1.20",
  "R1.21",
  "R1.22",
  "R1.23",
  "R1.24",
  "R1.25",
  "R1.27",
  "R6.1",
  "R6.2",
  "R6.3",
  "R6.4",
  "U4.1",
  "U4.2",
  "U4.3",
  "U4.4",
  "U4.5",
  "U4.6",
  "U6.1",
  "U6.2",
  "U6.4",
  "U6.6",
  "U6.11",
  "U6.12",
  "U6.13",
] as const;

const createSlice = () => {
  let sequence = 0;
  return createAgentsSlice({
    nowUtc: () => `2026-02-18T10:00:${String(sequence).padStart(2, "0")}.000Z`,
    createAgentId: () =>
      asAgentId(`00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`),
    pageSize: 3,
    getModelContext: ({ viewKind }) =>
      okAsync({
        modelCatalog: {
          snapshotId: `${viewKind}-snapshot-1`,
          modelsByProvider: {
            gemini: ["gemini-1.5-flash"],
            openrouter: ["openai/gpt-4o-mini"],
          },
        },
        globalDefaultModelRef: {
          providerId: "gemini",
          modelId: "gemini-1.5-flash",
        },
        canRefreshModels: true,
      }),
    refreshModelCatalog: ({ viewKind }) =>
      okAsync({
        modelCatalog: {
          snapshotId: `${viewKind}-snapshot-2`,
          modelsByProvider: {
            gemini: ["gemini-1.5-flash"],
            openrouter: ["openai/gpt-4o-mini"],
          },
        },
      }),
  });
};

describe("agents handlers", () => {
  itReq(FILE_REQUIREMENT_IDS, "creates and lists agents with pagination", async () => {
    const slice = createSlice();

    for (let index = 0; index < 5; index += 1) {
      const result = await slice.saveAgent({
        webContentsId: 10,
        draft: {
          viewKind: "agentEdit",
          id: null,
          name: `Agent ${index}`,
          systemPrompt: `Prompt ${index}`,
          verbosity: null,
          temperature: null,
          tags: ["alpha"],
          modelRefOrNull: null,
        },
      });
      expect(result.isOk()).toBe(true);
    }

    const page1 = await slice.listAgents({
      webContentsId: 10,
      searchText: "",
      tagFilter: "",
      archivedFilter: "all",
      sortBy: "createdAt",
      sortDirection: "asc",
      page: 1,
    });
    expect(page1.isOk()).toBe(true);
    expect(page1._unsafeUnwrap().items).toHaveLength(3);
    expect(page1._unsafeUnwrap().hasMore).toBe(true);

    const page2 = await slice.listAgents({
      webContentsId: 10,
      searchText: "",
      tagFilter: "",
      archivedFilter: "all",
      sortBy: "createdAt",
      sortDirection: "asc",
      page: 2,
    });
    expect(page2.isOk()).toBe(true);
    expect(page2._unsafeUnwrap().items).toHaveLength(2);
    expect(page2._unsafeUnwrap().hasMore).toBe(false);
  });

  itReq(FILE_REQUIREMENT_IDS, "filters by text and tag", async () => {
    const slice = createSlice();
    await slice.saveAgent({
      webContentsId: 11,
      draft: {
        viewKind: "agentEdit",
        id: null,
        name: "Planner",
        systemPrompt: "Creates plans",
        verbosity: null,
        temperature: null,
        tags: ["plan"],
        modelRefOrNull: null,
      },
    });
    await slice.saveAgent({
      webContentsId: 11,
      draft: {
        viewKind: "agentEdit",
        id: null,
        name: "Researcher",
        systemPrompt: "Finds facts",
        verbosity: null,
        temperature: null,
        tags: ["research", "ops"],
        modelRefOrNull: null,
      },
    });
    await slice.saveAgent({
      webContentsId: 11,
      draft: {
        viewKind: "agentEdit",
        id: null,
        name: "Research Notes",
        systemPrompt: "Stores notes",
        verbosity: null,
        temperature: null,
        tags: ["research-notes"],
        modelRefOrNull: null,
      },
    });

    const textFiltered = await slice.listAgents({
      webContentsId: 11,
      searchText: "plan",
      tagFilter: "",
      archivedFilter: "all",
      sortBy: "updatedAt",
      sortDirection: "desc",
      page: 1,
    });
    expect(textFiltered.isOk()).toBe(true);
    expect(textFiltered._unsafeUnwrap().items).toHaveLength(1);
    expect(textFiltered._unsafeUnwrap().items[0]?.name).toBe("Planner");

    const tagFiltered = await slice.listAgents({
      webContentsId: 11,
      searchText: "",
      tagFilter: "RESEARCH",
      archivedFilter: "all",
      sortBy: "updatedAt",
      sortDirection: "desc",
      page: 1,
    });
    expect(tagFiltered.isOk()).toBe(true);
    expect(tagFiltered._unsafeUnwrap().items).toHaveLength(1);
    expect(tagFiltered._unsafeUnwrap().items[0]?.name).toBe("Researcher");

    const partialTagFiltered = await slice.listAgents({
      webContentsId: 11,
      searchText: "",
      tagFilter: "research-note",
      archivedFilter: "all",
      sortBy: "updatedAt",
      sortDirection: "desc",
      page: 1,
    });
    expect(partialTagFiltered.isOk()).toBe(true);
    expect(partialTagFiltered._unsafeUnwrap().items).toHaveLength(0);

    const multiTagFiltered = await slice.listAgents({
      webContentsId: 11,
      searchText: "",
      tagFilter: "research, ops",
      archivedFilter: "all",
      sortBy: "updatedAt",
      sortDirection: "desc",
      page: 1,
    });
    expect(multiTagFiltered.isOk()).toBe(true);
    expect(multiTagFiltered._unsafeUnwrap().items).toHaveLength(1);
    expect(multiTagFiltered._unsafeUnwrap().items[0]?.name).toBe("Researcher");

    const missingMultiTagFiltered = await slice.listAgents({
      webContentsId: 11,
      searchText: "",
      tagFilter: "research, strategy",
      archivedFilter: "all",
      sortBy: "updatedAt",
      sortDirection: "desc",
      page: 1,
    });
    expect(missingMultiTagFiltered.isOk()).toBe(true);
    expect(missingMultiTagFiltered._unsafeUnwrap().items).toHaveLength(0);
  });

  itReq(FILE_REQUIREMENT_IDS, "blocks saving agent with invalid model config", async () => {
    const slice = createAgentsSlice({
      nowUtc: () => "2026-02-18T10:00:00.000Z",
      createAgentId: () => asAgentId("00000000-0000-4000-8000-000000000001"),
      pageSize: 10,
      getModelContext: () =>
        okAsync({
          modelCatalog: {
            snapshotId: "agent-edit",
            modelsByProvider: {
              gemini: ["gemini-1.5-flash"],
            },
          },
          globalDefaultModelRef: {
            providerId: "gemini",
            modelId: "gemini-1.5-flash",
          },
          canRefreshModels: true,
        }),
      refreshModelCatalog: () =>
        okAsync({
          modelCatalog: {
            snapshotId: "agent-edit-refreshed",
            modelsByProvider: {
              gemini: ["gemini-1.5-flash"],
            },
          },
        }),
    });

    const result = await slice.saveAgent({
      webContentsId: 12,
      draft: {
        viewKind: "agentEdit",
        id: null,
        name: "Invalid",
        systemPrompt: "Bad model",
        verbosity: null,
        temperature: null,
        tags: ["bad"],
        modelRefOrNull: {
          providerId: "openrouter",
          modelId: "openai/gpt-4o-mini",
        },
      },
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().kind).toBe("InvalidConfigError");
  });

  itReq(FILE_REQUIREMENT_IDS, "deletes existing agent", async () => {
    const slice = createSlice();
    const saved = await slice.saveAgent({
      webContentsId: 13,
      draft: {
        viewKind: "agentEdit",
        id: null,
        name: "Removable",
        systemPrompt: "Prompt",
        verbosity: null,
        temperature: null,
        tags: [],
        modelRefOrNull: null,
      },
    });
    expect(saved.isOk()).toBe(true);

    const deleted = await slice.deleteAgent({
      id: saved._unsafeUnwrap().agent.id,
    });
    expect(deleted.isOk()).toBe(true);

    const nextList = await slice.listAgents({
      webContentsId: 13,
      searchText: "",
      tagFilter: "",
      archivedFilter: "all",
      sortBy: "updatedAt",
      sortDirection: "desc",
      page: 1,
    });
    expect(nextList.isOk()).toBe(true);
    expect(nextList._unsafeUnwrap().items).toHaveLength(0);
  });

  itReq(FILE_REQUIREMENT_IDS, "blocks delete when agent is referenced by council", async () => {
    const slice = createAgentsSlice({
      nowUtc: () => "2026-02-18T10:00:00.000Z",
      createAgentId: () => asAgentId("00000000-0000-4000-8000-000000000001"),
      pageSize: 10,
      getModelContext: ({ viewKind }) =>
        okAsync({
          modelCatalog: {
            snapshotId: `${viewKind}-snapshot-1`,
            modelsByProvider: {
              gemini: ["gemini-1.5-flash"],
            },
          },
          globalDefaultModelRef: {
            providerId: "gemini",
            modelId: "gemini-1.5-flash",
          },
          canRefreshModels: true,
        }),
      refreshModelCatalog: ({ viewKind }) =>
        okAsync({
          modelCatalog: {
            snapshotId: `${viewKind}-snapshot-2`,
            modelsByProvider: {
              gemini: ["gemini-1.5-flash"],
            },
          },
        }),
      canDeleteAgent: () => okAsync(false),
    });

    const saved = await slice.saveAgent({
      webContentsId: 14,
      draft: {
        viewKind: "agentEdit",
        id: null,
        name: "Protected",
        systemPrompt: "Prompt",
        verbosity: null,
        temperature: null,
        tags: [],
        modelRefOrNull: null,
      },
    });
    expect(saved.isOk()).toBe(true);
    if (saved.isErr()) {
      return;
    }

    const deleted = await slice.deleteAgent({ id: saved.value.agent.id });
    expect(deleted.isErr()).toBe(true);
    expect(deleted._unsafeUnwrapErr().kind).toBe("ConflictError");
  });

  itReq(
    FILE_REQUIREMENT_IDS,
    "archives and restores agent while preserving list visibility and filtering",
    async () => {
      const slice = createSlice();
      const saved = await slice.saveAgent({
        webContentsId: 15,
        draft: {
          viewKind: "agentEdit",
          id: null,
          name: "Archivist",
          systemPrompt: "Keeps records",
          verbosity: null,
          temperature: null,
          tags: ["ops"],
          modelRefOrNull: null,
        },
      });
      expect(saved.isOk()).toBe(true);
      if (saved.isErr()) {
        return;
      }

      const archived = await slice.setArchived({
        webContentsId: 15,
        id: saved.value.agent.id,
        archived: true,
      });
      expect(archived.isOk()).toBe(true);
      expect(archived._unsafeUnwrap().agent.archived).toBe(true);

      const archivedOnly = await slice.listAgents({
        webContentsId: 15,
        searchText: "",
        tagFilter: "",
        archivedFilter: "archived",
        sortBy: "updatedAt",
        sortDirection: "desc",
        page: 1,
      });
      expect(archivedOnly.isOk()).toBe(true);
      expect(archivedOnly._unsafeUnwrap().items).toHaveLength(1);

      const activeOnly = await slice.listAgents({
        webContentsId: 15,
        searchText: "",
        tagFilter: "",
        archivedFilter: "active",
        sortBy: "updatedAt",
        sortDirection: "desc",
        page: 1,
      });
      expect(activeOnly.isOk()).toBe(true);
      expect(activeOnly._unsafeUnwrap().items).toHaveLength(0);

      const restored = await slice.setArchived({
        webContentsId: 15,
        id: saved.value.agent.id,
        archived: false,
      });
      expect(restored.isOk()).toBe(true);
      expect(restored._unsafeUnwrap().agent.archived).toBe(false);
    },
  );

  itReq(FILE_REQUIREMENT_IDS, "blocks editing archived agent until restored", async () => {
    const slice = createSlice();
    const saved = await slice.saveAgent({
      webContentsId: 16,
      draft: {
        viewKind: "agentEdit",
        id: null,
        name: "Readonly",
        systemPrompt: "Original",
        verbosity: null,
        temperature: null,
        tags: [],
        modelRefOrNull: null,
      },
    });
    expect(saved.isOk()).toBe(true);
    if (saved.isErr()) {
      return;
    }

    await slice.setArchived({
      webContentsId: 16,
      id: saved.value.agent.id,
      archived: true,
    });

    const edited = await slice.saveAgent({
      webContentsId: 16,
      draft: {
        viewKind: "agentEdit",
        id: saved.value.agent.id,
        name: "Readonly",
        systemPrompt: "Changed",
        verbosity: null,
        temperature: null,
        tags: [],
        modelRefOrNull: null,
      },
    });
    expect(edited.isErr()).toBe(true);
    expect(edited._unsafeUnwrapErr().kind).toBe("StateViolationError");
  });
});
