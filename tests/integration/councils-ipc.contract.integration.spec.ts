import { ResultAsync, errAsync, okAsync } from "neverthrow";
import { describe, expect } from "vitest";
import { createCouncilsIpcHandlers } from "../../src/main/features/councils/ipc-handlers";
import { createCouncilsSlice } from "../../src/main/features/councils/slice";
import { asCouncilId } from "../../src/shared/domain/ids";
import { itReq } from "../helpers/requirement-trace";

const FILE_REQUIREMENT_IDS = [
  "A3",
  "R2.1",
  "R2.3",
  "R3.1",
  "R3.7",
  "R3.23",
  "R3.25",
  "R3.26",
  "R3.32",
  "R8.1",
  "U3.8",
  "U10.1",
  "U10.9",
  "U11.6",
  "U12.2",
] as const;

const createHandlers = (options?: {
  generationDelayMs?: number;
  failExport?: boolean;
}) => {
  let sequence = 0;
  let messageId = 0;
  let generationId = 0;
  const messagesByCouncilId = new Map<string, Array<unknown>>();
  const briefingsByCouncilId = new Map<string, unknown>();
  const generationDelayMs = options?.generationDelayMs ?? 0;
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
      generateText: (_request, abortSignal) =>
        ResultAsync.fromPromise(
          new Promise<{ text: string }>((resolve, reject) => {
            const timer = setTimeout(() => {
              if (abortSignal.aborted) {
                reject(new Error("aborted"));
                return;
              }
              resolve({ text: "generated" });
            }, generationDelayMs);
            abortSignal.addEventListener(
              "abort",
              () => {
                clearTimeout(timer);
                reject(new Error("aborted"));
              },
              { once: true },
            );
          }),
          () => "ProviderError",
        ),
    },
    createMessageId: () => `message-${++messageId}`,
    createGenerationRequestId: () => `generation-${++generationId}`,
    exportService: {
      saveMarkdownFile: () => {
        if (options?.failExport === true) {
          return errAsync("ExportWriteError" as const);
        }

        return okAsync({
          status: "exported" as const,
          filePath: "/tmp/export.md",
        });
      },
    },
  });

  return createCouncilsIpcHandlers(slice);
};

describe("councils ipc contract", () => {
  itReq(FILE_REQUIREMENT_IDS, "validates list payload", async () => {
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

  itReq(FILE_REQUIREMENT_IDS, "creates and fetches council editor view", async () => {
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

    const savedFromView = await handlers.saveCouncil(
      {
        viewKind: "councilView",
        id: save.value.council.id,
        title: "Roadmap Council",
        topic: "Q3 planning",
        goal: null,
        mode: "manual",
        tags: ["planning"],
        memberAgentIds: ["00000000-0000-4000-8000-000000000101"],
        memberColorsByAgentId: {},
        conductorModelRefOrNull: null,
      },
      31,
    );
    expect(savedFromView.ok).toBe(true);
    if (savedFromView.ok) {
      expect(savedFromView.value.council.topic).toBe("Q3 planning");
    }
  });

  itReq(FILE_REQUIREMENT_IDS, "validates runtime command payloads", async () => {
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

    const refreshForCouncilView = await handlers.refreshModelCatalog(
      {
        viewKind: "councilView",
      },
      44,
    );
    expect(refreshForCouncilView.ok).toBe(true);
  });

  itReq(FILE_REQUIREMENT_IDS, "exports transcript through typed IPC handler", async () => {
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

  itReq(FILE_REQUIREMENT_IDS, "enforces runtime cancellation semantics over IPC", async () => {
    const handlers = createHandlers({ generationDelayMs: 120 });
    const saved = await handlers.saveCouncil(
      {
        viewKind: "councilCreate",
        id: null,
        title: "Cancel Contract Council",
        topic: "Cancellation semantics",
        goal: null,
        mode: "manual",
        tags: [],
        memberAgentIds: ["00000000-0000-4000-8000-000000000101"],
        memberColorsByAgentId: {},
        conductorModelRefOrNull: null,
      },
      52,
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }

    const started = await handlers.startCouncil(
      {
        viewKind: "councilView",
        id: saved.value.council.id,
        maxTurns: null,
      },
      52,
    );
    expect(started.ok).toBe(true);

    const generationPromise = handlers.generateManualTurn(
      {
        viewKind: "councilView",
        id: saved.value.council.id,
        memberAgentId: "00000000-0000-4000-8000-000000000101",
      },
      52,
    );
    await new Promise((resolve) => setTimeout(resolve, 10));

    const cancelled = await handlers.cancelGeneration({
      id: saved.value.council.id,
    });
    expect(cancelled.ok).toBe(true);
    if (cancelled.ok) {
      expect(cancelled.value.cancelled).toBe(true);
    }

    const generationResult = await generationPromise;
    expect(generationResult.ok).toBe(false);
    if (!generationResult.ok) {
      expect(generationResult.error.kind).toBe("StateViolationError");
    }

    const view = await handlers.getCouncilView(
      {
        viewKind: "councilView",
        councilId: saved.value.council.id,
      },
      52,
    );
    expect(view.ok).toBe(true);
    if (view.ok) {
      expect(view.value.messages).toHaveLength(0);
      expect(view.value.generation.status).toBe("idle");
    }
  });

  itReq(FILE_REQUIREMENT_IDS, "redacts internal path-bearing error details over IPC", async () => {
    const handlers = createHandlers({ failExport: true });
    const saved = await handlers.saveCouncil(
      {
        viewKind: "councilCreate",
        id: null,
        title: "Export Failure Council",
        topic: "Path redaction",
        goal: null,
        mode: "manual",
        tags: [],
        memberAgentIds: ["00000000-0000-4000-8000-000000000101"],
        memberColorsByAgentId: {},
        conductorModelRefOrNull: null,
      },
      53,
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
      53,
    );
    expect(exported.ok).toBe(false);
    if (!exported.ok) {
      expect(exported.error.devMessage).toBe("Redacted at IPC boundary.");
      expect(exported.error.details).toBeUndefined();
      const serialized = JSON.stringify(exported.error);
      expect(serialized.includes("/tmp")).toBe(false);
    }
  });
});
