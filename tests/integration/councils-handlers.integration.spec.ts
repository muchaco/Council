import { okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";
import { createCouncilsSlice } from "../../src/main/features/councils/slice";
import { asCouncilId } from "../../src/shared/domain/ids";

const AVAILABLE_AGENTS = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    name: "Planner",
    invalidConfig: false,
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    name: "Researcher",
    invalidConfig: false,
  },
];
const PRIMARY_AGENT_ID = "00000000-0000-4000-8000-000000000101";
const SECONDARY_AGENT_ID = "00000000-0000-4000-8000-000000000102";

const createSlice = () => {
  let sequence = 0;

  return createCouncilsSlice({
    nowUtc: () => `2026-02-18T10:00:${String(sequence).padStart(2, "0")}.000Z`,
    createCouncilId: () =>
      asCouncilId(`00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`),
    pageSize: 2,
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
    listAvailableAgents: () => okAsync(AVAILABLE_AGENTS),
  });
};

describe("councils handlers", () => {
  it("creates councils and paginates list results", async () => {
    const slice = createSlice();

    for (let index = 0; index < 3; index += 1) {
      const saved = await slice.saveCouncil({
        webContentsId: 20,
        draft: {
          viewKind: "councilCreate",
          id: null,
          title: `Council ${index}`,
          topic: `Topic ${index}`,
          goal: null,
          mode: "autopilot",
          tags: ["delivery"],
          memberAgentIds: [PRIMARY_AGENT_ID],
          memberColorsByAgentId: {},
          conductorModelRefOrNull: null,
        },
      });
      expect(saved.isOk()).toBe(true);
    }

    const page1 = await slice.listCouncils({
      webContentsId: 20,
      searchText: "",
      tagFilter: "",
      archivedFilter: "all",
      sortBy: "createdAt",
      sortDirection: "asc",
      page: 1,
    });
    expect(page1.isOk()).toBe(true);
    expect(page1._unsafeUnwrap().items).toHaveLength(2);
    expect(page1._unsafeUnwrap().hasMore).toBe(true);

    const page2 = await slice.listCouncils({
      webContentsId: 20,
      searchText: "",
      tagFilter: "",
      archivedFilter: "all",
      sortBy: "createdAt",
      sortDirection: "asc",
      page: 2,
    });
    expect(page2.isOk()).toBe(true);
    expect(page2._unsafeUnwrap().items).toHaveLength(1);
    expect(page2._unsafeUnwrap().hasMore).toBe(false);
  });

  it("archives and restores council", async () => {
    const slice = createSlice();
    const saved = await slice.saveCouncil({
      webContentsId: 21,
      draft: {
        viewKind: "councilCreate",
        id: null,
        title: "Ops Council",
        topic: "Reduce incident load",
        goal: "Define top 3 actions",
        mode: "manual",
        tags: ["ops"],
        memberAgentIds: [PRIMARY_AGENT_ID, SECONDARY_AGENT_ID],
        memberColorsByAgentId: {},
        conductorModelRefOrNull: null,
      },
    });
    expect(saved.isOk()).toBe(true);
    if (saved.isErr()) {
      return;
    }

    const archived = await slice.setArchived({
      webContentsId: 21,
      id: saved.value.council.id,
      archived: true,
    });
    expect(archived.isOk()).toBe(true);
    expect(archived._unsafeUnwrap().council.archived).toBe(true);

    const archivedOnly = await slice.listCouncils({
      webContentsId: 21,
      searchText: "",
      tagFilter: "",
      archivedFilter: "archived",
      sortBy: "updatedAt",
      sortDirection: "desc",
      page: 1,
    });
    expect(archivedOnly.isOk()).toBe(true);
    expect(archivedOnly._unsafeUnwrap().items).toHaveLength(1);

    const restored = await slice.setArchived({
      webContentsId: 21,
      id: saved.value.council.id,
      archived: false,
    });
    expect(restored.isOk()).toBe(true);
    expect(restored._unsafeUnwrap().council.archived).toBe(false);
  });

  it("does not allow changing mode after create", async () => {
    const slice = createSlice();
    const saved = await slice.saveCouncil({
      webContentsId: 22,
      draft: {
        viewKind: "councilCreate",
        id: null,
        title: "Strategy Council",
        topic: "Roadmap",
        goal: null,
        mode: "manual",
        tags: [],
        memberAgentIds: [PRIMARY_AGENT_ID],
        memberColorsByAgentId: {},
        conductorModelRefOrNull: null,
      },
    });
    expect(saved.isOk()).toBe(true);
    if (saved.isErr()) {
      return;
    }

    const changed = await slice.saveCouncil({
      webContentsId: 22,
      draft: {
        viewKind: "councilCreate",
        id: saved.value.council.id,
        title: "Strategy Council",
        topic: "Roadmap",
        goal: null,
        mode: "autopilot",
        tags: [],
        memberAgentIds: [PRIMARY_AGENT_ID],
        memberColorsByAgentId: {},
        conductorModelRefOrNull: null,
      },
    });

    expect(changed.isErr()).toBe(true);
    expect(changed._unsafeUnwrapErr().kind).toBe("StateViolationError");
  });
});
