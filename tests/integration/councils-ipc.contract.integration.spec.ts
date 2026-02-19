import { ResultAsync, okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";
import { createCouncilsIpcHandlers } from "../../src/main/features/councils/ipc-handlers";
import { createCouncilsSlice } from "../../src/main/features/councils/slice";
import { asCouncilId } from "../../src/shared/domain/ids";

const createHandlers = () => {
  let sequence = 0;
  let messageId = 0;
  let generationId = 0;
  const messagesByCouncilId = new Map<string, Array<unknown>>();
  const briefingsByCouncilId = new Map<string, unknown>();
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
    loadCouncilMessages: (councilId) =>
      okAsync((messagesByCouncilId.get(councilId) ?? []) as never),
    appendCouncilMessage: (message) => {
      const current = messagesByCouncilId.get(message.councilId) ?? [];
      const next = {
        ...message,
        sequenceNumber: current.length + 1,
      };
      messagesByCouncilId.set(message.councilId, [...current, next]);
      return okAsync(next as never);
    },
    loadCouncilRuntimeBriefing: (councilId) =>
      okAsync((briefingsByCouncilId.get(councilId) ?? null) as never),
    persistCouncilRuntimeBriefing: (briefing) => {
      briefingsByCouncilId.set(briefing.councilId, briefing);
      return okAsync(undefined);
    },
    aiService: {
      generateText: () =>
        ResultAsync.fromPromise(Promise.resolve({ text: "generated" }), () => "ProviderError"),
    },
    createMessageId: () => `message-${++messageId}`,
    createGenerationRequestId: () => `generation-${++generationId}`,
    exportService: {
      saveMarkdownFile: () =>
        okAsync({
          status: "exported" as const,
          filePath: "/tmp/export.md",
        }),
    },
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

    const view = await handlers.getCouncilView(
      {
        viewKind: "councilView",
        councilId: save.value.council.id,
      },
      31,
    );
    expect(view.ok).toBe(true);
    if (!view.ok) {
      return;
    }
    expect(view.value.council.id).toBe(save.value.council.id);
    expect(view.value.generation.plannedNextSpeakerAgentId).toBeNull();

    const started = await handlers.startCouncil(
      {
        viewKind: "councilView",
        id: save.value.council.id,
        maxTurns: null,
      },
      31,
    );
    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }
    expect(started.value.council.started).toBe(true);
  });

  it("validates runtime command payloads", async () => {
    const handlers = createHandlers();

    const invalidView = await handlers.getCouncilView(
      {
        viewKind: "councilView",
        councilId: "invalid",
      },
      44,
    );
    expect(invalidView.ok).toBe(false);

    const invalidPause = await handlers.pauseCouncilAutopilot({ id: "bad" }, 44);
    expect(invalidPause.ok).toBe(false);
    if (!invalidPause.ok) {
      expect(invalidPause.error.kind).toBe("ValidationError");
    }

    const invalidManual = await handlers.generateManualTurn(
      {
        viewKind: "councilView",
        id: "bad",
        memberAgentId: "also-bad",
      },
      44,
    );
    expect(invalidManual.ok).toBe(false);

    const invalidStart = await handlers.startCouncil(
      {
        viewKind: "councilView",
        id: "00000000-0000-4000-8000-000000000112",
        maxTurns: 0,
      },
      44,
    );
    expect(invalidStart.ok).toBe(false);

    const invalidResume = await handlers.resumeCouncilAutopilot(
      {
        viewKind: "councilView",
        id: "00000000-0000-4000-8000-000000000112",
        maxTurns: 201,
      },
      44,
    );
    expect(invalidResume.ok).toBe(false);

    const invalidInject = await handlers.injectConductorMessage(
      {
        viewKind: "councilView",
        id: "00000000-0000-4000-8000-000000000112",
        content: "",
      },
      44,
    );
    expect(invalidInject.ok).toBe(false);

    const invalidExport = await handlers.exportTranscript(
      {
        viewKind: "settings",
        id: "00000000-0000-4000-8000-000000000112",
      },
      44,
    );
    expect(invalidExport.ok).toBe(false);
  });

  it("exports transcript through typed IPC handler", async () => {
    const handlers = createHandlers();
    const saved = await handlers.saveCouncil(
      {
        viewKind: "councilCreate",
        id: null,
        title: "Export Contract Council",
        topic: "Contract path",
        goal: null,
        mode: "manual",
        tags: [],
        memberAgentIds: ["00000000-0000-4000-8000-000000000101"],
        memberColorsByAgentId: {},
        conductorModelRefOrNull: null,
      },
      51,
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }

    const exported = await handlers.exportTranscript(
      {
        viewKind: "councilsList",
        id: saved.value.council.id,
      },
      51,
    );
    expect(exported.ok).toBe(true);
    if (exported.ok) {
      expect(exported.value.status).toBe("exported");
    }
  });
});
