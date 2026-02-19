import { ResultAsync, okAsync } from "neverthrow";
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

type TestMessage = {
  id: string;
  councilId: string;
  sequenceNumber: number;
  senderKind: "member" | "conductor";
  senderAgentId: string | null;
  senderName: string;
  senderColor: string | null;
  content: string;
  createdAtUtc: string;
};

type TestBriefing = {
  councilId: string;
  briefing: string;
  goalReached: boolean;
  updatedAtUtc: string;
};

const createSlice = (options?: {
  generationDelayMs?: number;
  failConductorDecision?: boolean;
  providerFailuresBeforeSuccess?: number;
}) => {
  let sequence = 0;
  let messageId = 0;
  let generationId = 0;
  const messagesByCouncilId = new Map<string, Array<TestMessage>>();
  const briefingsByCouncilId = new Map<string, TestBriefing>();

  const generationDelayMs = options?.generationDelayMs ?? 0;
  let providerFailuresRemaining = options?.providerFailuresBeforeSuccess ?? 0;
  const refreshModelCatalogCalls: Array<"councilsList" | "councilCreate" | "councilView"> = [];

  const buildConductorDecisionResponse = (promptContent: string): string => {
    const eligibleMatch = promptContent.match(/Eligible members for next speaker: (.*)/);
    const eligibleRaw = eligibleMatch?.[1]?.trim() ?? "";
    const eligible =
      eligibleRaw.length === 0 || eligibleRaw.startsWith("(")
        ? []
        : eligibleRaw
            .split(",")
            .map((value) => value.trim())
            .filter((value) => value.length > 0);

    return JSON.stringify({
      briefing: `Briefing ${sequence + 1}`,
      goalReached: false,
      nextSpeakerAgentId: eligible[0] ?? null,
    });
  };

  const slice = createCouncilsSlice({
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
      okAsync(
        (() => {
          refreshModelCatalogCalls.push(viewKind);
          return {
            modelCatalog: {
              snapshotId: `${viewKind}-snapshot-2`,
              modelsByProvider: {
                gemini: ["gemini-1.5-flash"],
              },
            },
          };
        })(),
      ),
    listAvailableAgents: () => okAsync(AVAILABLE_AGENTS),
    loadCouncilMessages: (councilId) =>
      okAsync((messagesByCouncilId.get(councilId) ?? []) as never),
    appendCouncilMessage: (message) => {
      const current = messagesByCouncilId.get(message.councilId) ?? [];
      const next = {
        ...message,
        sequenceNumber: current.length + 1,
      };
      messagesByCouncilId.set(message.councilId, [...current, next]);
      return okAsync(next);
    },
    loadCouncilRuntimeBriefing: (councilId) =>
      okAsync((briefingsByCouncilId.get(councilId) ?? null) as never),
    persistCouncilRuntimeBriefing: (briefing) => {
      briefingsByCouncilId.set(briefing.councilId, briefing);
      return okAsync(undefined);
    },
    aiService: {
      generateText: (request, abortSignal) =>
        ResultAsync.fromPromise(
          new Promise<{ text: string }>((resolve, reject) => {
            const timer = setTimeout(() => {
              if (abortSignal.aborted) {
                reject(new Error("aborted"));
                return;
              }
              const promptContent = request.messages.map((message) => message.content).join("\n");
              const isConductorRequest = promptContent.includes("You are the Council Conductor.");
              if (providerFailuresRemaining > 0) {
                providerFailuresRemaining -= 1;
                reject(new Error("provider failure"));
                return;
              }
              if (options?.failConductorDecision === true && isConductorRequest) {
                reject(new Error("provider failure"));
                return;
              }

              resolve({
                text: isConductorRequest
                  ? buildConductorDecisionResponse(promptContent)
                  : `Generated turn ${++sequence}`,
              });
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
  });

  return Object.assign(slice, {
    getRefreshModelCatalogCalls: (): ReadonlyArray<
      "councilsList" | "councilCreate" | "councilView"
    > => refreshModelCatalogCalls,
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

  it("supports start, pause, resume, and archive guard for autopilot councils", async () => {
    const slice = createSlice();
    const saved = await slice.saveCouncil({
      webContentsId: 23,
      draft: {
        viewKind: "councilCreate",
        id: null,
        title: "Runtime Council",
        topic: "Execution",
        goal: null,
        mode: "autopilot",
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

    const started = await slice.startCouncil({
      webContentsId: 23,
      id: saved.value.council.id,
    });
    expect(started.isOk()).toBe(true);
    if (started.isErr()) {
      return;
    }
    expect(started.value.council.started).toBe(true);
    expect(started.value.council.paused).toBe(false);

    const archiveWhileRunning = await slice.setArchived({
      webContentsId: 23,
      id: saved.value.council.id,
      archived: true,
    });
    expect(archiveWhileRunning.isErr()).toBe(true);
    if (archiveWhileRunning.isErr()) {
      expect(archiveWhileRunning.error.kind).toBe("StateViolationError");
    }

    const paused = await slice.pauseCouncilAutopilot({
      webContentsId: 23,
      id: saved.value.council.id,
    });
    expect(paused.isOk()).toBe(true);
    if (paused.isErr()) {
      return;
    }
    expect(paused.value.council.paused).toBe(true);

    const resumed = await slice.resumeCouncilAutopilot({
      webContentsId: 23,
      id: saved.value.council.id,
    });
    expect(resumed.isOk()).toBe(true);
    if (resumed.isErr()) {
      return;
    }
    expect(resumed.value.council.paused).toBe(false);
  });

  it("appends transcript messages in order for conductor + manual generation", async () => {
    const slice = createSlice();
    const saved = await slice.saveCouncil({
      webContentsId: 24,
      draft: {
        viewKind: "councilCreate",
        id: null,
        title: "Manual Council",
        topic: "Manual flow",
        goal: null,
        mode: "manual",
        tags: [],
        memberAgentIds: [PRIMARY_AGENT_ID, SECONDARY_AGENT_ID],
        memberColorsByAgentId: {},
        conductorModelRefOrNull: null,
      },
    });
    expect(saved.isOk()).toBe(true);
    if (saved.isErr()) {
      return;
    }

    expect(
      (
        await slice.startCouncil({
          webContentsId: 24,
          id: saved.value.council.id,
        })
      ).isOk(),
    ).toBe(true);

    const injected = await slice.injectConductorMessage({
      webContentsId: 24,
      id: saved.value.council.id,
      content: "Conductor kickoff",
    });
    expect(injected.isOk()).toBe(true);

    const generated = await slice.generateManualTurn({
      webContentsId: 24,
      id: saved.value.council.id,
      memberAgentId: PRIMARY_AGENT_ID,
    });
    expect(generated.isOk()).toBe(true);

    const view = await slice.getCouncilView({
      webContentsId: 24,
      councilId: saved.value.council.id,
    });
    expect(view.isOk()).toBe(true);
    if (view.isErr()) {
      return;
    }

    expect(view.value.messages.map((message) => message.sequenceNumber)).toEqual([1, 2]);
    expect(view.value.messages[0]?.senderKind).toBe("conductor");
    expect(view.value.messages[1]?.senderKind).toBe("member");
    expect(view.value.council.turnCount).toBe(1);
    expect(view.value.briefing?.briefing).toContain("Briefing");
  });

  it("pauses autopilot when provider error occurs during conductor briefing", async () => {
    const slice = createSlice({ failConductorDecision: true });
    const saved = await slice.saveCouncil({
      webContentsId: 26,
      draft: {
        viewKind: "councilCreate",
        id: null,
        title: "Autopilot Error Council",
        topic: "Error handling",
        goal: null,
        mode: "autopilot",
        tags: [],
        memberAgentIds: [PRIMARY_AGENT_ID, SECONDARY_AGENT_ID],
        memberColorsByAgentId: {},
        conductorModelRefOrNull: null,
      },
    });
    expect(saved.isOk()).toBe(true);
    if (saved.isErr()) {
      return;
    }

    await slice.startCouncil({
      webContentsId: 26,
      id: saved.value.council.id,
    });

    const advance = await slice.advanceAutopilotTurn({
      webContentsId: 26,
      id: saved.value.council.id,
    });
    expect(advance.isErr()).toBe(true);
    if (advance.isErr()) {
      expect(advance.error.kind).toBe("ProviderError");
    }

    const view = await slice.getCouncilView({
      webContentsId: 26,
      councilId: saved.value.council.id,
    });
    expect(view.isOk()).toBe(true);
    if (view.isOk()) {
      expect(view.value.council.paused).toBe(true);
      expect(view.value.messages).toHaveLength(1);
    }
  });

  it("does not repeat the same autopilot speaker consecutively", async () => {
    const slice = createSlice();
    const saved = await slice.saveCouncil({
      webContentsId: 27,
      draft: {
        viewKind: "councilCreate",
        id: null,
        title: "Autopilot Speaker Council",
        topic: "Speaker rotation",
        goal: null,
        mode: "autopilot",
        tags: [],
        memberAgentIds: [PRIMARY_AGENT_ID, SECONDARY_AGENT_ID],
        memberColorsByAgentId: {},
        conductorModelRefOrNull: null,
      },
    });
    expect(saved.isOk()).toBe(true);
    if (saved.isErr()) {
      return;
    }

    await slice.startCouncil({ webContentsId: 27, id: saved.value.council.id });
    const first = await slice.advanceAutopilotTurn({
      webContentsId: 27,
      id: saved.value.council.id,
    });
    const second = await slice.advanceAutopilotTurn({
      webContentsId: 27,
      id: saved.value.council.id,
    });

    expect(first.isOk()).toBe(true);
    expect(second.isOk()).toBe(true);
    if (first.isOk() && second.isOk()) {
      expect(first.value.selectedMemberAgentId).not.toBe(second.value.selectedMemberAgentId);
    }
  });

  it("discards cancelled generation output", async () => {
    const slice = createSlice({ generationDelayMs: 120 });
    const saved = await slice.saveCouncil({
      webContentsId: 25,
      draft: {
        viewKind: "councilCreate",
        id: null,
        title: "Cancel Council",
        topic: "Cancellation",
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

    await slice.startCouncil({
      webContentsId: 25,
      id: saved.value.council.id,
    });

    const generationPromise = slice.generateManualTurn({
      webContentsId: 25,
      id: saved.value.council.id,
      memberAgentId: PRIMARY_AGENT_ID,
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const cancelled = await slice.cancelGeneration({ id: saved.value.council.id });
    expect(cancelled.isOk()).toBe(true);
    if (cancelled.isOk()) {
      expect(cancelled.value.cancelled).toBe(true);
    }

    const generationResult = await generationPromise;
    expect(generationResult.isErr()).toBe(true);

    const view = await slice.getCouncilView({
      webContentsId: 25,
      councilId: saved.value.council.id,
    });
    expect(view.isOk()).toBe(true);
    if (view.isOk()) {
      expect(view.value.messages).toHaveLength(0);
      expect(view.value.generation.status).toBe("idle");
    }
  });

  it("refreshes model catalog and retries generation after provider error", async () => {
    const slice = createSlice({ providerFailuresBeforeSuccess: 1 });
    const saved = await slice.saveCouncil({
      webContentsId: 28,
      draft: {
        viewKind: "councilCreate",
        id: null,
        title: "Retry Council",
        topic: "Retry once",
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

    await slice.startCouncil({ webContentsId: 28, id: saved.value.council.id });

    const generated = await slice.generateManualTurn({
      webContentsId: 28,
      id: saved.value.council.id,
      memberAgentId: PRIMARY_AGENT_ID,
    });
    expect(generated.isOk()).toBe(true);
    expect(slice.getRefreshModelCatalogCalls()).toEqual(["councilView"]);
  });

  it("returns provider error when retry still fails", async () => {
    const slice = createSlice({ providerFailuresBeforeSuccess: 2 });
    const saved = await slice.saveCouncil({
      webContentsId: 29,
      draft: {
        viewKind: "councilCreate",
        id: null,
        title: "Retry Fails Council",
        topic: "Retry fail",
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

    await slice.startCouncil({ webContentsId: 29, id: saved.value.council.id });

    const generated = await slice.generateManualTurn({
      webContentsId: 29,
      id: saved.value.council.id,
      memberAgentId: PRIMARY_AGENT_ID,
    });
    expect(generated.isErr()).toBe(true);
    if (generated.isErr()) {
      expect(generated.error.kind).toBe("ProviderError");
    }
    expect(slice.getRefreshModelCatalogCalls()).toEqual(["councilView"]);
  });
});
