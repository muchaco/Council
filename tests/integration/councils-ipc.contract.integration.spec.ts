import { okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";
import { createCouncilsIpcHandlers } from "../../src/main/features/councils/ipc-handlers";
import { createCouncilsSlice } from "../../src/main/features/councils/slice";
import { asCouncilId } from "../../src/shared/domain/ids";

const createHandlers = () => {
  let sequence = 0;
  const slice = createCouncilsSlice({
    nowUtc: () => "2026-02-18T10:00:00.000Z",
    createCouncilId: () =>
      asCouncilId(`00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`),
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
    listAvailableAgents: () =>
      okAsync([
        {
          id: "00000000-0000-4000-8000-000000000101",
          name: "Planner",
          invalidConfig: false,
        },
      ]),
  });

  return createCouncilsIpcHandlers(slice);
};

describe("councils ipc contract", () => {
  it("validates list payload", async () => {
    const handlers = createHandlers();
    const result = await handlers.listCouncils(
      {
        viewKind: "councilsList",
        searchText: "",
        tagFilter: "",
        archivedFilter: "all",
        sortBy: "updatedAt",
        sortDirection: "desc",
        page: 0,
      },
      30,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("ValidationError");
    }
  });

  it("creates and fetches council editor view", async () => {
    const handlers = createHandlers();
    const save = await handlers.saveCouncil(
      {
        viewKind: "councilCreate",
        id: null,
        title: "Roadmap Council",
        topic: "Q2 planning",
        goal: null,
        mode: "manual",
        tags: ["planning"],
        memberAgentIds: ["00000000-0000-4000-8000-000000000101"],
        memberColorsByAgentId: {},
        conductorModelRefOrNull: null,
      },
      31,
    );
    expect(save.ok).toBe(true);
    if (!save.ok) {
      return;
    }

    const editor = await handlers.getEditorView(
      {
        viewKind: "councilCreate",
        councilId: save.value.council.id,
      },
      31,
    );

    expect(editor.ok).toBe(true);
    if (!editor.ok) {
      return;
    }

    expect(editor.value.council?.title).toBe("Roadmap Council");
    expect(editor.value.modelCatalog.snapshotId).toContain("councilCreate");
  });
});
