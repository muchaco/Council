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
  "R6.1",
  "R6.2",
  "R6.3",
  "R6.4",
  "U4.1",
  "U4.2",
  "U4.3",
  "U4.4",
  "U6.1",
  "U6.2",
  "U6.4",
  "U6.6",
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
        tags: ["research"],
        modelRefOrNull: null,
      },
    });

    const textFiltered = await slice.listAgents({
      webContentsId: 11,
      searchText: "plan",
      tagFilter: "",
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
      sortBy: "updatedAt",
      sortDirection: "desc",
      page: 1,
    });
    expect(tagFiltered.isOk()).toBe(true);
    expect(tagFiltered._unsafeUnwrap().items).toHaveLength(1);
    expect(tagFiltered._unsafeUnwrap().items[0]?.name).toBe("Researcher");
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
});
