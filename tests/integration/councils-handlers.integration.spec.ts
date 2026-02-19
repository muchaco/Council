import { ResultAsync, okAsync } from "neverthrow";
import { describe, expect } from "vitest";
import { type CouncilRecord, createCouncilsSlice } from "../../src/main/features/councils/slice";
import { asAgentId, asCouncilId } from "../../src/shared/domain/ids";
import { itReq } from "../helpers/requirement-trace";

const FILE_REQUIREMENT_IDS = [
  "R2.1",
  "R2.2",
  "R2.3",
  "R2.4",
  "R2.5",
  "R2.6",
  "R2.7",
  "R2.8",
  "R2.9",
  "R2.10",
  "R2.11",
  "R2.12",
  "R2.13",
  "R2.14",
  "R2.15",
  "R2.16",
  "R2.17",
  "R2.18",
  "R2.19",
  "R2.20",
  "R2.21",
  "R2.22",
  "R2.23",
  "R2.24",
  "R3.3",
  "R3.7",
  "R3.8",
  "R3.9",
  "R3.10",
  "R3.11",
  "R3.13",
  "R3.14",
  "R3.15",
  "R3.18",
  "R3.19",
  "R3.20",
  "R3.21",
  "R3.22",
  "R3.23",
  "R3.24",
  "R3.25",
  "R3.26",
  "R3.27",
  "R3.29",
  "R3.30",
  "R3.31",
  "R3.32",
  "R3.33",
  "R3.34",
  "R4.16",
  "R8.2",
  "R8.3",
  "F1",
  "R6.1",
  "R6.2",
  "R6.3",
  "R6.4",
  "R6.6",
  "U3.8",
  "U3.9",
  "U11.7",
  "U12.1",
  "U12.2",
  "U12.3",
  "U12.4",
  "U12.5",
  "U12.6",
  "U13.1",
  "U13.2",
  "U13.4",
  "U16.1",
  "U16.2",
  "U9.3",
  "U9.6",
  "U9.7",
  "U9.8",
] as const;

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
  contextLastN?: number;
  initialCouncils?: ReadonlyArray<CouncilRecord>;
}) => {
  let sequence = 0;
  let messageId = 0;
  let generationId = 0;
  const messagesByCouncilId = new Map<string, Array<TestMessage>>();
  const briefingsByCouncilId = new Map<string, TestBriefing>();

  const generationDelayMs = options?.generationDelayMs ?? 0;
  let providerFailuresRemaining = options?.providerFailuresBeforeSuccess ?? 0;
  const refreshModelCatalogCalls: Array<"councilsList" | "councilCreate" | "councilView"> = [];
  const memberPrompts: Array<string> = [];
  const conductorPrompts: Array<string> = [];
  const transcriptExports: Array<{
    webContentsId: number;
    suggestedFileName: string;
    markdown: string;
  }> = [];

  const readEligibleMembers = (promptContent: string, label: string): ReadonlyArray<string> => {
    const eligibleMatch = promptContent.match(new RegExp(`${label}: (.*)`));
    const eligibleRaw = eligibleMatch?.[1]?.trim() ?? "";
    if (eligibleRaw.length === 0 || eligibleRaw.startsWith("(")) {
      return [];
    }

    return eligibleRaw
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  };

  const buildConductorDecisionResponse = (promptContent: string): string => {
    const eligible = readEligibleMembers(promptContent, "Eligible members for next speaker");

    return JSON.stringify({
      briefing: `Briefing ${sequence + 1}`,
      goalReached: false,
      nextSpeakerAgentId: eligible[0] ?? null,
    });
  };

  const buildConductorOpeningResponse = (promptContent: string): string => {
    const eligible = readEligibleMembers(promptContent, "Eligible members for first speaker");

    return JSON.stringify({
      openingMessage: "Opening kickoff",
      briefing: `Briefing ${sequence + 1}`,
      goalReached: false,
      firstSpeakerAgentId: eligible[0] ?? PRIMARY_AGENT_ID,
    });
  };

  const slice = createCouncilsSlice(
    {
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
                if (isConductorRequest) {
                  conductorPrompts.push(promptContent);
                } else {
                  memberPrompts.push(promptContent);
                }
                if (providerFailuresRemaining > 0) {
                  providerFailuresRemaining -= 1;
                  reject(new Error("provider failure"));
                  return;
                }
                const isOpeningRequest = promptContent.includes("starting an Autopilot council");

                if (
                  options?.failConductorDecision === true &&
                  isConductorRequest &&
                  !isOpeningRequest
                ) {
                  reject(new Error("provider failure"));
                  return;
                }

                resolve({
                  text: isConductorRequest
                    ? isOpeningRequest
                      ? buildConductorOpeningResponse(promptContent)
                      : buildConductorDecisionResponse(promptContent)
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
      getContextLastN: () => options?.contextLastN ?? 12,
      exportService: {
        saveMarkdownFile: ({ webContentsId, suggestedFileName, markdown }) => {
          transcriptExports.push({ webContentsId, suggestedFileName, markdown });
          return okAsync({
            status: "exported" as const,
            filePath: `/tmp/${suggestedFileName}.md`,
          });
        },
      },
    },
    options?.initialCouncils,
  );

  return Object.assign(slice, {
    getRefreshModelCatalogCalls: (): ReadonlyArray<
      "councilsList" | "councilCreate" | "councilView"
    > => refreshModelCatalogCalls,
    getMemberPrompts: (): ReadonlyArray<string> => memberPrompts,
    getConductorPrompts: (): ReadonlyArray<string> => conductorPrompts,
    getTranscriptExports: (): ReadonlyArray<{
      webContentsId: number;
      suggestedFileName: string;
      markdown: string;
    }> => transcriptExports,
  });
};

describe("councils handlers", () => {
  itReq(FILE_REQUIREMENT_IDS, "creates councils and paginates list results", async () => {
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

  itReq(
    FILE_REQUIREMENT_IDS,
    "keeps created councils not-started and enforces topic-required create flow",
    async () => {
      const slice = createSlice();
      const saved = await slice.saveCouncil({
        webContentsId: 201,
        draft: {
          viewKind: "councilCreate",
          id: null,
          title: "Topic Required Council",
          topic: "Launch plan",
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

      const view = await slice.getCouncilView({
        webContentsId: 201,
        councilId: saved.value.council.id,
      });
      expect(view.isOk()).toBe(true);
      if (view.isOk()) {
        expect(view.value.council.started).toBe(false);
      }

      const saveWithoutTopic = await slice.saveCouncil({
        webContentsId: 201,
        draft: {
          viewKind: "councilCreate",
          id: null,
          title: "Invalid Council",
          topic: "   ",
          goal: null,
          mode: "manual",
          tags: [],
          memberAgentIds: [PRIMARY_AGENT_ID],
          memberColorsByAgentId: {},
          conductorModelRefOrNull: null,
        },
      });
      expect(saveWithoutTopic.isErr()).toBe(true);
      if (saveWithoutTopic.isErr()) {
        expect(saveWithoutTopic.error.kind).toBe("ValidationError");
      }
    },
  );

  itReq(
    FILE_REQUIREMENT_IDS,
    "blocks runtime and config mutation while archived then allows restore edits",
    async () => {
      const slice = createSlice();
      const saved = await slice.saveCouncil({
        webContentsId: 202,
        draft: {
          viewKind: "councilCreate",
          id: null,
          title: "Archived ReadOnly Council",
          topic: "Read-only checks",
          goal: null,
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
        webContentsId: 202,
        id: saved.value.council.id,
        archived: true,
      });
      expect(archived.isOk()).toBe(true);

      const startArchived = await slice.startCouncil({
        webContentsId: 202,
        id: saved.value.council.id,
        maxTurns: null,
      });
      expect(startArchived.isErr()).toBe(true);

      const manualTurnArchived = await slice.generateManualTurn({
        webContentsId: 202,
        id: saved.value.council.id,
        memberAgentId: PRIMARY_AGENT_ID,
      });
      expect(manualTurnArchived.isErr()).toBe(true);

      const injectArchived = await slice.injectConductorMessage({
        webContentsId: 202,
        id: saved.value.council.id,
        content: "Should be blocked",
      });
      expect(injectArchived.isErr()).toBe(true);

      const editArchived = await slice.saveCouncil({
        webContentsId: 202,
        draft: {
          viewKind: "councilView",
          id: saved.value.council.id,
          title: saved.value.council.title,
          topic: saved.value.council.topic,
          goal: "Archived edit",
          mode: saved.value.council.mode,
          tags: saved.value.council.tags,
          memberAgentIds: saved.value.council.memberAgentIds,
          memberColorsByAgentId: saved.value.council.memberColorsByAgentId,
          conductorModelRefOrNull: {
            providerId: "gemini",
            modelId: "gemini-1.5-flash",
          },
        },
      });
      expect(editArchived.isErr()).toBe(true);
      if (editArchived.isErr()) {
        expect(editArchived.error.kind).toBe("StateViolationError");
      }

      const restored = await slice.setArchived({
        webContentsId: 202,
        id: saved.value.council.id,
        archived: false,
      });
      expect(restored.isOk()).toBe(true);

      const editAfterRestore = await slice.saveCouncil({
        webContentsId: 202,
        draft: {
          viewKind: "councilView",
          id: saved.value.council.id,
          title: "Restored Council",
          topic: saved.value.council.topic,
          goal: "Allowed now",
          mode: saved.value.council.mode,
          tags: ["ops", "restored"],
          memberAgentIds: saved.value.council.memberAgentIds,
          memberColorsByAgentId: saved.value.council.memberColorsByAgentId,
          conductorModelRefOrNull: {
            providerId: "gemini",
            modelId: "gemini-1.5-flash",
          },
        },
      });
      expect(editAfterRestore.isOk()).toBe(true);
      if (editAfterRestore.isOk()) {
        expect(editAfterRestore.value.council.conductorModelRefOrNull).toEqual({
          providerId: "gemini",
          modelId: "gemini-1.5-flash",
        });
      }
    },
  );

  itReq(
    FILE_REQUIREMENT_IDS,
    "blocks start for councils with missing topic even if legacy data exists",
    async () => {
      const slice = createSlice({
        initialCouncils: [
          {
            id: asCouncilId("00000000-0000-4000-8000-999999999901"),
            title: "Legacy Council",
            topic: "",
            goal: null,
            mode: "manual",
            tags: [],
            memberAgentIds: [asAgentId(PRIMARY_AGENT_ID)],
            memberColorsByAgentId: {},
            conductorModelRefOrNull: null,
            archivedAtUtc: null,
            startedAtUtc: null,
            autopilotPaused: true,
            autopilotMaxTurns: null,
            autopilotTurnsCompleted: 0,
            turnCount: 0,
            createdAtUtc: "2026-02-18T10:00:00.000Z",
            updatedAtUtc: "2026-02-18T10:00:00.000Z",
          },
        ],
      });

      const started = await slice.startCouncil({
        webContentsId: 203,
        id: "00000000-0000-4000-8000-999999999901",
        maxTurns: null,
      });

      expect(started.isErr()).toBe(true);
      if (started.isErr()) {
        expect(started.error.kind).toBe("ValidationError");
      }
    },
  );

  itReq(FILE_REQUIREMENT_IDS, "archives and restores council", async () => {
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

  itReq(FILE_REQUIREMENT_IDS, "does not allow changing mode after create", async () => {
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

  itReq(
    FILE_REQUIREMENT_IDS,
    "blocks adding members from council view while autopilot is actively running",
    async () => {
      const slice = createSlice();
      const saved = await slice.saveCouncil({
        webContentsId: 223,
        draft: {
          viewKind: "councilCreate",
          id: null,
          title: "Running Autopilot Council",
          topic: "Release triage",
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
        webContentsId: 223,
        id: saved.value.council.id,
        maxTurns: null,
      });
      expect(started.isOk()).toBe(true);

      const addMemberWhileRunning = await slice.saveCouncil({
        webContentsId: 223,
        draft: {
          viewKind: "councilView",
          id: saved.value.council.id,
          title: saved.value.council.title,
          topic: saved.value.council.topic,
          goal: saved.value.council.goal,
          mode: saved.value.council.mode,
          tags: saved.value.council.tags,
          memberAgentIds: [PRIMARY_AGENT_ID, SECONDARY_AGENT_ID],
          memberColorsByAgentId: {},
          conductorModelRefOrNull: saved.value.council.conductorModelRefOrNull,
        },
      });

      expect(addMemberWhileRunning.isErr()).toBe(true);
      if (addMemberWhileRunning.isErr()) {
        expect(addMemberWhileRunning.error.kind).toBe("StateViolationError");
      }
    },
  );

  itReq(
    FILE_REQUIREMENT_IDS,
    "allows adding members in manual mode and blocks removing members with message history",
    async () => {
      const slice = createSlice();
      const saved = await slice.saveCouncil({
        webContentsId: 224,
        draft: {
          viewKind: "councilCreate",
          id: null,
          title: "Manual Members Council",
          topic: "Plan next steps",
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

      const started = await slice.startCouncil({
        webContentsId: 224,
        id: saved.value.council.id,
        maxTurns: null,
      });
      expect(started.isOk()).toBe(true);

      const addMemberInManual = await slice.saveCouncil({
        webContentsId: 224,
        draft: {
          viewKind: "councilView",
          id: saved.value.council.id,
          title: saved.value.council.title,
          topic: saved.value.council.topic,
          goal: saved.value.council.goal,
          mode: saved.value.council.mode,
          tags: saved.value.council.tags,
          memberAgentIds: [PRIMARY_AGENT_ID, SECONDARY_AGENT_ID],
          memberColorsByAgentId: {},
          conductorModelRefOrNull: saved.value.council.conductorModelRefOrNull,
        },
      });
      expect(addMemberInManual.isOk()).toBe(true);

      const generated = await slice.generateManualTurn({
        webContentsId: 224,
        id: saved.value.council.id,
        memberAgentId: PRIMARY_AGENT_ID,
      });
      expect(generated.isOk()).toBe(true);

      const removeSpeakingMember = await slice.saveCouncil({
        webContentsId: 224,
        draft: {
          viewKind: "councilView",
          id: saved.value.council.id,
          title: saved.value.council.title,
          topic: saved.value.council.topic,
          goal: saved.value.council.goal,
          mode: saved.value.council.mode,
          tags: saved.value.council.tags,
          memberAgentIds: [SECONDARY_AGENT_ID],
          memberColorsByAgentId: {},
          conductorModelRefOrNull: saved.value.council.conductorModelRefOrNull,
        },
      });

      expect(removeSpeakingMember.isErr()).toBe(true);
      if (removeSpeakingMember.isErr()) {
        expect(removeSpeakingMember.error.kind).toBe("ValidationError");
      }
    },
  );

  itReq(
    FILE_REQUIREMENT_IDS,
    "supports start, pause, resume, and archive guard for autopilot councils",
    async () => {
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
        maxTurns: null,
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

      const viewWhilePaused = await slice.getCouncilView({
        webContentsId: 23,
        councilId: saved.value.council.id,
      });
      expect(viewWhilePaused.isOk()).toBe(true);
      if (viewWhilePaused.isOk()) {
        expect(viewWhilePaused.value.generation.plannedNextSpeakerAgentId).toBe(PRIMARY_AGENT_ID);
      }

      const resumed = await slice.resumeCouncilAutopilot({
        webContentsId: 23,
        id: saved.value.council.id,
        maxTurns: null,
      });
      expect(resumed.isOk()).toBe(true);
      if (resumed.isErr()) {
        return;
      }
      expect(resumed.value.council.paused).toBe(false);
    },
  );

  itReq(
    FILE_REQUIREMENT_IDS,
    "runs autopilot opening on start and persists first planned speaker",
    async () => {
      const slice = createSlice();
      const saved = await slice.saveCouncil({
        webContentsId: 231,
        draft: {
          viewKind: "councilCreate",
          id: null,
          title: "Opening Council",
          topic: "Kickoff sequence",
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

      const started = await slice.startCouncil({
        webContentsId: 231,
        id: saved.value.council.id,
        maxTurns: 4,
      });
      expect(started.isOk()).toBe(true);
      if (started.isErr()) {
        return;
      }
      expect(started.value.council.autopilotMaxTurns).toBe(4);
      expect(started.value.council.autopilotTurnsCompleted).toBe(0);

      const viewAfterStart = await slice.getCouncilView({
        webContentsId: 231,
        councilId: saved.value.council.id,
      });
      expect(viewAfterStart.isOk()).toBe(true);
      if (viewAfterStart.isErr()) {
        return;
      }

      expect(viewAfterStart.value.messages).toHaveLength(1);
      expect(viewAfterStart.value.messages[0]?.senderKind).toBe("conductor");
      expect(viewAfterStart.value.messages[0]?.content).toBe("Opening kickoff");
      expect(viewAfterStart.value.generation.plannedNextSpeakerAgentId).toBe(PRIMARY_AGENT_ID);

      const firstAdvance = await slice.advanceAutopilotTurn({
        webContentsId: 231,
        id: saved.value.council.id,
      });
      expect(firstAdvance.isOk()).toBe(true);
      if (firstAdvance.isOk()) {
        expect(firstAdvance.value.selectedMemberAgentId).toBe(PRIMARY_AGENT_ID);
      }
    },
  );

  itReq(
    FILE_REQUIREMENT_IDS,
    "pauses autopilot when configured max turns are reached",
    async () => {
      const slice = createSlice();
      const saved = await slice.saveCouncil({
        webContentsId: 232,
        draft: {
          viewKind: "councilCreate",
          id: null,
          title: "Turn Limit Council",
          topic: "Bound runtime",
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
        webContentsId: 232,
        id: saved.value.council.id,
        maxTurns: 1,
      });

      const firstAdvance = await slice.advanceAutopilotTurn({
        webContentsId: 232,
        id: saved.value.council.id,
      });
      expect(firstAdvance.isOk()).toBe(true);

      const viewAfterFirstAdvance = await slice.getCouncilView({
        webContentsId: 232,
        councilId: saved.value.council.id,
      });
      expect(viewAfterFirstAdvance.isOk()).toBe(true);
      if (viewAfterFirstAdvance.isErr()) {
        return;
      }

      expect(viewAfterFirstAdvance.value.council.paused).toBe(true);
      expect(viewAfterFirstAdvance.value.council.autopilotTurnsCompleted).toBe(1);

      const resume = await slice.resumeCouncilAutopilot({
        webContentsId: 232,
        id: saved.value.council.id,
        maxTurns: null,
      });
      expect(resume.isOk()).toBe(true);
      if (resume.isOk()) {
        expect(resume.value.council.autopilotTurnsCompleted).toBe(0);
        expect(resume.value.council.autopilotMaxTurns).toBeNull();
      }
    },
  );

  itReq(
    FILE_REQUIREMENT_IDS,
    "appends transcript messages in order for conductor + manual generation",
    async () => {
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
            maxTurns: null,
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
    },
  );

  itReq(
    FILE_REQUIREMENT_IDS,
    "uses briefing plus last N messages for runtime prompts",
    async () => {
      const slice = createSlice({ contextLastN: 2 });
      const saved = await slice.saveCouncil({
        webContentsId: 30,
        draft: {
          viewKind: "councilCreate",
          id: null,
          title: "Context Council",
          topic: "Context handling",
          goal: "Keep only recent context",
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

      await slice.startCouncil({ webContentsId: 30, id: saved.value.council.id, maxTurns: null });
      await slice.injectConductorMessage({
        webContentsId: 30,
        id: saved.value.council.id,
        content: "Kickoff",
      });
      await slice.injectConductorMessage({
        webContentsId: 30,
        id: saved.value.council.id,
        content: "Second note",
      });
      await slice.injectConductorMessage({
        webContentsId: 30,
        id: saved.value.council.id,
        content: "Third note",
      });

      const generated = await slice.generateManualTurn({
        webContentsId: 30,
        id: saved.value.council.id,
        memberAgentId: PRIMARY_AGENT_ID,
      });
      expect(generated.isOk()).toBe(true);

      const latestMemberPrompt = slice.getMemberPrompts().at(-1) ?? "";
      expect(latestMemberPrompt).toContain("Second note");
      expect(latestMemberPrompt).toContain("Third note");
      expect(latestMemberPrompt).not.toContain("Kickoff");
      expect(latestMemberPrompt).toContain("Current briefing: Briefing");
      expect(latestMemberPrompt).toContain("Earlier messages omitted: 1");

      const latestConductorPrompt = slice.getConductorPrompts().at(-1) ?? "";
      expect(latestConductorPrompt).toContain("Third note");
      expect(latestConductorPrompt).toContain("Generated turn");
      expect(latestConductorPrompt).not.toContain("Kickoff");
      expect(latestConductorPrompt).toContain("Previous briefing: Briefing");
      expect(latestConductorPrompt).toContain("Earlier messages omitted: 2");
    },
  );

  itReq(
    FILE_REQUIREMENT_IDS,
    "pauses autopilot when provider error occurs during conductor briefing",
    async () => {
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
        maxTurns: null,
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
        expect(view.value.messages).toHaveLength(2);
      }
    },
  );

  itReq(
    FILE_REQUIREMENT_IDS,
    "does not repeat the same autopilot speaker consecutively",
    async () => {
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

      await slice.startCouncil({ webContentsId: 27, id: saved.value.council.id, maxTurns: null });
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
    },
  );

  itReq(FILE_REQUIREMENT_IDS, "discards cancelled generation output", async () => {
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
      maxTurns: null,
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

  itReq(
    FILE_REQUIREMENT_IDS,
    "exposes active autopilot speaker while generation is running",
    async () => {
      const slice = createSlice({ generationDelayMs: 120 });
      const saved = await slice.saveCouncil({
        webContentsId: 251,
        draft: {
          viewKind: "councilCreate",
          id: null,
          title: "Thinking Council",
          topic: "Show active speaker",
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

      await slice.startCouncil({ webContentsId: 251, id: saved.value.council.id, maxTurns: null });

      const advancePromise = slice.advanceAutopilotTurn({
        webContentsId: 251,
        id: saved.value.council.id,
      });
      await new Promise((resolve) => setTimeout(resolve, 10));

      const viewDuringGeneration = await slice.getCouncilView({
        webContentsId: 251,
        councilId: saved.value.council.id,
      });
      expect(viewDuringGeneration.isOk()).toBe(true);
      if (viewDuringGeneration.isOk()) {
        expect(viewDuringGeneration.value.generation.status).toBe("running");
        expect(viewDuringGeneration.value.generation.kind).toBe("autopilotStep");
        expect(viewDuringGeneration.value.generation.activeMemberAgentId).toBe(PRIMARY_AGENT_ID);
      }

      const advanceResult = await advancePromise;
      expect(advanceResult.isOk()).toBe(true);
    },
  );

  itReq(
    FILE_REQUIREMENT_IDS,
    "refreshes model catalog and retries generation after provider error",
    async () => {
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

      await slice.startCouncil({ webContentsId: 28, id: saved.value.council.id, maxTurns: null });

      const generated = await slice.generateManualTurn({
        webContentsId: 28,
        id: saved.value.council.id,
        memberAgentId: PRIMARY_AGENT_ID,
      });
      expect(generated.isOk()).toBe(true);
      expect(slice.getRefreshModelCatalogCalls()).toEqual(["councilView"]);
    },
  );

  itReq(FILE_REQUIREMENT_IDS, "returns provider error when retry still fails", async () => {
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

    await slice.startCouncil({ webContentsId: 29, id: saved.value.council.id, maxTurns: null });

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

  itReq(
    FILE_REQUIREMENT_IDS,
    "exports transcript markdown with header and UI-visible message fields",
    async () => {
      const slice = createSlice();
      const saved = await slice.saveCouncil({
        webContentsId: 31,
        draft: {
          viewKind: "councilCreate",
          id: null,
          title: "Export Council",
          topic: "Markdown export",
          goal: "Capture transcript",
          mode: "manual",
          tags: [],
          memberAgentIds: [PRIMARY_AGENT_ID],
          memberColorsByAgentId: {
            [PRIMARY_AGENT_ID]: "#2d6cdf",
          },
          conductorModelRefOrNull: null,
        },
      });
      expect(saved.isOk()).toBe(true);
      if (saved.isErr()) {
        return;
      }

      await slice.startCouncil({ webContentsId: 31, id: saved.value.council.id, maxTurns: null });
      await slice.injectConductorMessage({
        webContentsId: 31,
        id: saved.value.council.id,
        content: "Kickoff note",
      });
      await slice.generateManualTurn({
        webContentsId: 31,
        id: saved.value.council.id,
        memberAgentId: PRIMARY_AGENT_ID,
      });

      const exported = await slice.exportTranscript({
        webContentsId: 31,
        id: saved.value.council.id,
      });
      expect(exported.isOk()).toBe(true);
      if (exported.isErr()) {
        return;
      }

      expect(exported.value.status).toBe("exported");
      const request = slice.getTranscriptExports().at(-1);
      expect(request).toBeDefined();
      if (request === undefined) {
        return;
      }

      expect(request.suggestedFileName).toBe("Export Council");
      expect(request.markdown).toContain("# Export Council");
      expect(request.markdown).toContain("- Topic: Markdown export");
      expect(request.markdown).toContain("- Goal: Capture transcript");
      expect(request.markdown).toContain("### 1. Conductor");
      expect(request.markdown).toContain("- Timestamp: 2026-02-18T10:00:");
      expect(request.markdown).toContain("Kickoff note");
      expect(request.markdown).not.toContain("#2d6cdf");
    },
  );
});
