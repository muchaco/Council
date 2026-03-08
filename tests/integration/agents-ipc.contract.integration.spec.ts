import { okAsync } from "neverthrow";
import { describe, expect } from "vitest";
import { createAgentsIpcHandlers } from "../../src/main/features/agents/ipc-handlers";
import { createAgentsSlice } from "../../src/main/features/agents/slice";
import { asAgentId } from "../../src/shared/domain/ids";
import { itReq } from "../helpers/requirement-trace";

const FILE_REQUIREMENT_IDS = [
  "A3",
  "R1.1",
  "R1.2",
  "R1.20",
  "R1.22",
  "R6.1",
  "R6.2",
  "U4.3",
  "U4.6",
] as const;

const createHandlers = () => {
  let sequence = 0;
  const slice = createAgentsSlice({
    nowUtc: () => "2026-02-18T10:00:00.000Z",
    createAgentId: () =>
      asAgentId(`00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`),
    pageSize: 12,
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
  });
  return createAgentsIpcHandlers(slice);
};

describe("agents ipc contract", () => {
  itReq(FILE_REQUIREMENT_IDS, "validates list payload", async () => {
    const handlers = createHandlers();
    const result = await handlers.listAgents(
      {
        viewKind: "agentsList",
        searchText: "",
        tagFilter: "",
        archivedFilter: "all",
        sortBy: "updatedAt",
        sortDirection: "desc",
        page: 0,
      },
      5,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("ValidationError");
    }
  });

  itReq(FILE_REQUIREMENT_IDS, "creates and retrieves editor view", async () => {
    const handlers = createHandlers();
    const save = await handlers.saveAgent(
      {
        viewKind: "agentEdit",
        id: null,
        name: "Planner",
        systemPrompt: "Build a plan",
        verbosity: null,
        temperature: null,
        tags: ["plan"],
        modelRefOrNull: null,
      },
      8,
    );
    expect(save.ok).toBe(true);
    if (!save.ok) {
      return;
    }

    const editor = await handlers.getEditorView(
      {
        viewKind: "agentEdit",
        agentId: save.value.agent.id,
      },
      8,
    );
    expect(editor.ok).toBe(true);
    if (!editor.ok) {
      return;
    }

    expect(editor.value.agent?.name).toBe("Planner");
    expect(editor.value.modelCatalog.snapshotId).toContain("agentEdit");
  });

  itReq(
    FILE_REQUIREMENT_IDS,
    "returns the configured default agents page size through ipc",
    async () => {
      const handlers = createHandlers();

      for (let index = 0; index < 13; index += 1) {
        const save = await handlers.saveAgent(
          {
            viewKind: "agentEdit",
            id: null,
            name: `Page Fill Agent ${index}`,
            systemPrompt: `Prompt ${index}`,
            verbosity: null,
            temperature: null,
            tags: ["pagefill"],
            modelRefOrNull: null,
          },
          9,
        );
        expect(save.ok).toBe(true);
      }

      const list = await handlers.listAgents(
        {
          viewKind: "agentsList",
          searchText: "Page Fill Agent",
          tagFilter: "",
          archivedFilter: "all",
          sortBy: "createdAt",
          sortDirection: "asc",
          page: 1,
        },
        9,
      );

      expect(list.ok).toBe(true);
      if (!list.ok) {
        return;
      }

      expect(list.value.pageSize).toBe(12);
      expect(list.value.items).toHaveLength(12);
      expect(list.value.hasMore).toBe(true);
    },
  );

  itReq(FILE_REQUIREMENT_IDS, "archives agent through ipc handler", async () => {
    const handlers = createHandlers();
    const save = await handlers.saveAgent(
      {
        viewKind: "agentEdit",
        id: null,
        name: "Archivist",
        systemPrompt: "Build a plan",
        verbosity: null,
        temperature: null,
        tags: ["plan"],
        modelRefOrNull: null,
      },
      8,
    );
    expect(save.ok).toBe(true);
    if (!save.ok) {
      return;
    }

    const archived = await handlers.setArchived(
      {
        id: save.value.agent.id,
        archived: true,
      },
      8,
    );
    expect(archived.ok).toBe(true);
    if (!archived.ok) {
      return;
    }

    expect(archived.value.agent.archived).toBe(true);
  });
});
