import { ResultAsync, okAsync } from "neverthrow";
import { describe, expect } from "vitest";
import { createAssistantIpcHandlers } from "../../src/main/features/assistant/ipc-handlers";
import { createAssistantSlice } from "../../src/main/features/assistant/slice";
import { createAssistantAuditService } from "../../src/main/services/assistant/assistant-audit-service";
import type {
  AssistantSubmitResponse,
  AssistantToolExecutionResult,
} from "../../src/shared/ipc/dto.js";
import { itReq } from "../helpers/requirement-trace";

const PRIMARY_AGENT_ID = "00000000-0000-4000-8000-000000000101";
const SECONDARY_AGENT_ID = "00000000-0000-4000-8000-000000000102";
const PRIMARY_COUNCIL_ID = "00000000-0000-4000-8000-000000000201";

const primaryAgent = {
  archived: false,
  createdAtUtc: "2026-03-12T11:00:00.000Z",
  id: PRIMARY_AGENT_ID,
  invalidConfig: false,
  modelRefOrNull: null,
  name: "Planner",
  systemPrompt: "Help with planning.",
  tags: ["ops"],
  temperature: 0.2,
  updatedAtUtc: "2026-03-12T11:30:00.000Z",
  verbosity: "concise",
} as const;

const secondaryAgent = {
  ...primaryAgent,
  id: SECONDARY_AGENT_ID,
  name: "Researcher",
  tags: ["research"],
} as const;

const primaryCouncil = {
  archived: false,
  autopilotMaxTurns: null,
  autopilotTurnsCompleted: 0,
  conductorModelRefOrNull: null,
  createdAtUtc: "2026-03-12T10:00:00.000Z",
  goal: null,
  id: PRIMARY_COUNCIL_ID,
  invalidConfig: false,
  memberAgentIds: [PRIMARY_AGENT_ID, SECONDARY_AGENT_ID],
  memberColorsByAgentId: {
    [PRIMARY_AGENT_ID]: "#111111",
    [SECONDARY_AGENT_ID]: "#222222",
  },
  mode: "manual" as const,
  paused: false,
  started: true,
  tags: ["ops"],
  title: "Quarterly Council",
  topic: "Quarterly planning",
  turnCount: 2,
  updatedAtUtc: "2026-03-12T11:45:00.000Z",
} as const;

const currentAgentExecutionSnapshot = {
  kind: "agent" as const,
  draft: {
    id: PRIMARY_AGENT_ID,
    modelSelection: "",
    name: primaryAgent.name,
    systemPrompt: primaryAgent.systemPrompt,
    tagsInput: primaryAgent.tags.join(", "),
    temperature: String(primaryAgent.temperature),
    verbosity: primaryAgent.verbosity ?? "",
  },
};

const currentCouncilExecutionSnapshot = {
  kind: "council" as const,
  draft: {
    conductorModelSelection: "",
    goal: primaryCouncil.goal ?? "",
    id: PRIMARY_COUNCIL_ID,
    mode: primaryCouncil.mode,
    selectedMemberIds: primaryCouncil.memberAgentIds,
    tagsInput: primaryCouncil.tags.join(", "),
    title: primaryCouncil.title,
    topic: primaryCouncil.topic,
  },
};

type AgentEditorViewAgent = Omit<typeof primaryAgent, "archived"> & { archived: boolean };
type CouncilEditorViewCouncil = Omit<typeof primaryCouncil, "archived"> & { archived: boolean };

const createAssistantSliceDeps = (options?: {
  events?: Array<Record<string, unknown>>;
  agentEditorViewAgent?: AgentEditorViewAgent | null;
  councilEditorViewCouncil?: CouncilEditorViewCouncil | null;
  saveAgentError?: { kind: string; userMessage: string; devMessage: string };
  saveCouncilError?: { kind: string; userMessage: string; devMessage: string };
  onGetSettingsView?: (request: { viewKind: string }) => void;
  onPlannerRequest?: (request: {
    modelRef: { providerId: string; modelId: string };
    userRequest: string;
  }) => void;
  onSaveAgent?: (request: { draft: Record<string, unknown> }) => void;
  onSaveCouncil?: (request: { draft: Record<string, unknown> }) => void;
  plannerDelayMs?: number;
  plannerResponse?: string;
  globalDefaultModelRef?: { providerId: string; modelId: string } | null;
  globalDefaultModelInvalidConfig?: boolean;
}) => ({
  nowUtc: () => "2026-03-12T12:00:00.000Z",
  createSessionId: () => "00000000-0000-4000-8000-000000000001",
  getSettingsView: ({ viewKind }: { viewKind: string }) => {
    options?.onGetSettingsView?.({ viewKind });
    return okAsync({
      providers: [],
      globalDefaultModelRef: options?.globalDefaultModelRef ?? {
        providerId: "gemini",
        modelId: "gemini-1.5-flash",
      },
      globalDefaultModelInvalidConfig: options?.globalDefaultModelInvalidConfig ?? false,
      contextLastN: 24,
      modelCatalog: {
        snapshotId: `${viewKind}-snapshot-1`,
        modelsByProvider: {
          gemini: ["gemini-1.5-flash"],
        },
      },
      canRefreshModels: true,
    });
  },
  auditService: createAssistantAuditService({
    info: () => {},
    error: () => {},
    logWideEvent: (entry) => options?.events?.push(entry),
  }),
  listAgents: () =>
    okAsync({
      items: [primaryAgent, secondaryAgent],
      page: 1,
      pageSize: 20,
      total: 2,
      hasMore: false,
      modelCatalog: {
        snapshotId: "agents-snapshot-1",
        modelsByProvider: { gemini: ["gemini-1.5-flash"] },
      },
      globalDefaultModelRef: null,
    }),
  getAgentEditorView: ({ agentId }: { agentId: string | null }) =>
    okAsync({
      agent:
        options?.agentEditorViewAgent !== undefined
          ? options.agentEditorViewAgent
          : agentId === PRIMARY_AGENT_ID
            ? primaryAgent
            : agentId === SECONDARY_AGENT_ID
              ? secondaryAgent
              : null,
      modelCatalog: {
        snapshotId: "agents-snapshot-1",
        modelsByProvider: { gemini: ["gemini-1.5-flash"] },
      },
      globalDefaultModelRef: null,
      canRefreshModels: true,
    }),
  saveAgent: ({ draft }: { draft: Record<string, unknown> }) => {
    options?.onSaveAgent?.({ draft });
    if (options?.saveAgentError !== undefined) {
      return ResultAsync.fromPromise(
        Promise.reject(options.saveAgentError),
        (error) => error as never,
      );
    }

    const agentId = typeof draft.id === "string" ? draft.id : PRIMARY_AGENT_ID;
    const name = typeof draft.name === "string" ? draft.name : primaryAgent.name;
    return okAsync({
      agent: {
        ...primaryAgent,
        id: agentId,
        name,
        systemPrompt:
          typeof draft.systemPrompt === "string" ? draft.systemPrompt : primaryAgent.systemPrompt,
        verbosity:
          typeof draft.verbosity === "string" || draft.verbosity === null
            ? (draft.verbosity as string | null)
            : primaryAgent.verbosity,
        temperature:
          typeof draft.temperature === "number" || draft.temperature === null
            ? (draft.temperature as number | null)
            : primaryAgent.temperature,
        tags: Array.isArray(draft.tags) ? (draft.tags as ReadonlyArray<string>) : primaryAgent.tags,
        modelRefOrNull:
          draft.modelRefOrNull === null ||
          (typeof draft.modelRefOrNull === "object" && draft.modelRefOrNull !== null)
            ? (draft.modelRefOrNull as typeof primaryAgent.modelRefOrNull)
            : primaryAgent.modelRefOrNull,
      },
    });
  },
  listCouncils: () =>
    okAsync({
      items: [primaryCouncil],
      page: 1,
      pageSize: 20,
      total: 1,
      hasMore: false,
      modelCatalog: {
        snapshotId: "councils-snapshot-1",
        modelsByProvider: { gemini: ["gemini-1.5-flash"] },
      },
      globalDefaultModelRef: null,
    }),
  getCouncilEditorView: ({ councilId }: { councilId: string | null }) =>
    okAsync({
      council:
        options?.councilEditorViewCouncil !== undefined
          ? options.councilEditorViewCouncil
          : councilId === PRIMARY_COUNCIL_ID
            ? primaryCouncil
            : null,
      availableAgents: [
        {
          archived: false,
          description: "Planning specialist",
          id: PRIMARY_AGENT_ID,
          invalidConfig: false,
          name: "Planner",
          tags: ["ops"],
        },
      ],
      modelCatalog: {
        snapshotId: "councils-snapshot-1",
        modelsByProvider: { gemini: ["gemini-1.5-flash"] },
      },
      globalDefaultModelRef: null,
      canRefreshModels: true,
    }),
  saveCouncil: ({ draft }: { draft: Record<string, unknown> }) => {
    options?.onSaveCouncil?.({ draft });
    if (options?.saveCouncilError !== undefined) {
      return ResultAsync.fromPromise(
        Promise.reject(options.saveCouncilError),
        (error) => error as never,
      );
    }

    const councilId = typeof draft.id === "string" ? draft.id : PRIMARY_COUNCIL_ID;
    const title = typeof draft.title === "string" ? draft.title : primaryCouncil.title;
    const mode: "autopilot" | "manual" =
      draft.mode === "autopilot" || draft.mode === "manual" ? draft.mode : primaryCouncil.mode;
    return okAsync({
      council: {
        ...primaryCouncil,
        id: councilId,
        title,
        topic: typeof draft.topic === "string" ? draft.topic : primaryCouncil.topic,
        goal:
          typeof draft.goal === "string" || draft.goal === null
            ? (draft.goal as string | null)
            : primaryCouncil.goal,
        mode,
        tags: Array.isArray(draft.tags)
          ? (draft.tags as ReadonlyArray<string>)
          : primaryCouncil.tags,
        memberAgentIds: Array.isArray(draft.memberAgentIds)
          ? (draft.memberAgentIds as ReadonlyArray<string>)
          : primaryCouncil.memberAgentIds,
        conductorModelRefOrNull:
          draft.conductorModelRefOrNull === null ||
          (typeof draft.conductorModelRefOrNull === "object" &&
            draft.conductorModelRefOrNull !== null)
            ? (draft.conductorModelRefOrNull as typeof primaryCouncil.conductorModelRefOrNull)
            : primaryCouncil.conductorModelRefOrNull,
      },
    });
  },
  getCouncilView: ({ councilId }: { councilId: string }) =>
    okAsync({
      council:
        councilId === PRIMARY_COUNCIL_ID ? primaryCouncil : { ...primaryCouncil, id: councilId },
      availableAgents: [
        {
          archived: false,
          description: "Planning specialist",
          id: PRIMARY_AGENT_ID,
          invalidConfig: false,
          name: "Planner",
          tags: ["ops"],
        },
      ],
      messages: [
        {
          content: "Let us begin.",
          councilId,
          createdAtUtc: "2026-03-12T11:01:00.000Z",
          id: "message-1",
          senderAgentId: PRIMARY_AGENT_ID,
          senderColor: "#111111",
          senderKind: "member" as const,
          senderName: "Planner",
          sequenceNumber: 1,
        },
      ],
      briefing: null,
      generation: {
        activeMemberAgentId: null,
        kind: null,
        plannedNextSpeakerAgentId: SECONDARY_AGENT_ID,
        status: "idle" as const,
      },
      modelCatalog: {
        snapshotId: "council-view-snapshot-1",
        modelsByProvider: { gemini: ["gemini-1.5-flash"] },
      },
      globalDefaultModelRef: null,
      canRefreshModels: true,
    }),
  planAssistantResponse:
    options?.plannerResponse === undefined
      ? undefined
      : (
          request: {
            modelRef: { providerId: string; modelId: string };
            userRequest: string;
          },
          abortSignal: AbortSignal,
        ) =>
          ResultAsync.fromPromise(
            new Promise<string>((resolve, reject) => {
              options.onPlannerRequest?.({
                modelRef: request.modelRef,
                userRequest: request.userRequest,
              });
              const timer = setTimeout(() => {
                if (abortSignal.aborted) {
                  reject(new Error("aborted"));
                  return;
                }
                resolve(options.plannerResponse as string);
              }, options.plannerDelayMs ?? 0);

              abortSignal.addEventListener(
                "abort",
                () => {
                  clearTimeout(timer);
                  reject(new Error("aborted"));
                },
                { once: true },
              );
            }),
            () => ({
              kind: "InternalError" as const,
              devMessage: "planner aborted",
              userMessage: "planner aborted",
            }),
          ),
});

const FILE_REQUIREMENT_IDS = [
  "R9.3",
  "R9.4",
  "R9.11",
  "R9.16",
  "R9.19",
  "R9.20",
  "R9.21",
  "A3",
  "D5",
] as const;

const TOOL_CONTRACT_REQUIREMENT_IDS = ["R9.9", "R9.11", "R9.13", "R9.14", "R9.22", "A1"] as const;

const FLOW_AND_TOOL_CONTRACT_REQUIREMENT_IDS = [
  "R9.3",
  "R9.4",
  "R9.9",
  "R9.11",
  "R9.13",
  "R9.14",
  "R9.16",
  "R9.19",
  "R9.20",
  "R9.21",
  "R9.22",
  "A1",
  "A3",
  "D5",
] as const;

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {
    promise,
    resolve,
    reject,
  };
};

const createHandlers = (options?: {
  agentEditorViewAgent?: AgentEditorViewAgent | null;
  councilEditorViewCouncil?: CouncilEditorViewCouncil | null;
  saveAgentError?: { kind: string; userMessage: string; devMessage: string };
  saveCouncilError?: { kind: string; userMessage: string; devMessage: string };
  plannerResponse?: string;
  plannerDelayMs?: number;
  onPlannerRequest?: (request: {
    modelRef: { providerId: string; modelId: string };
    userRequest: string;
  }) => void;
  onGetSettingsView?: (request: { viewKind: string }) => void;
  onSaveAgent?: (request: { draft: Record<string, unknown> }) => void;
  onSaveCouncil?: (request: { draft: Record<string, unknown> }) => void;
  globalDefaultModelRef?: { providerId: string; modelId: string } | null;
  globalDefaultModelInvalidConfig?: boolean;
}) => {
  const events: Array<Record<string, unknown>> = [];
  const slice = createAssistantSlice(createAssistantSliceDeps({ ...options, events }));

  return {
    handlers: createAssistantIpcHandlers(slice),
    events,
  };
};

const validContext = {
  viewKind: "agentsList" as const,
  contextLabel: "Agents /tmp/private notes.txt",
  activeEntityId: null,
  selectionIds: [],
  listState: {
    searchText: "planner",
    tagFilter: "ops",
    sortBy: "updatedAt",
    sortDirection: "desc" as const,
    archivedFilter: "all",
  },
  draftState: null,
  runtimeState: null,
};

const councilsListContext = {
  ...validContext,
  viewKind: "councilsList" as const,
  contextLabel: "Home / Councils",
  listState: {
    ...validContext.listState,
    searchText: "",
  },
};

const councilViewContext = {
  ...validContext,
  viewKind: "councilView" as const,
  contextLabel: "Council view / Quarterly Council / overview",
  activeEntityId: PRIMARY_COUNCIL_ID,
  listState: null,
  runtimeState: {
    councilId: PRIMARY_COUNCIL_ID,
    plannedNextSpeakerAgentId: SECONDARY_AGENT_ID,
    status: "idle" as const,
  },
};

const completeAllNavigationReconciliations = async (params: {
  handlers: ReturnType<typeof createAssistantIpcHandlers>;
  result: Extract<AssistantSubmitResponse["result"], { kind: "result" }>;
  webContentsId: number;
}) => {
  return params.handlers.completeReconciliation(
    {
      sessionId: params.result.sessionId,
      reconciliations: params.result.executionResults.flatMap(
        (executionResult: AssistantToolExecutionResult) =>
          executionResult.status === "reconciling"
            ? [
                {
                  callId: executionResult.callId,
                  toolName: executionResult.toolName,
                  status: "completed" as const,
                  failureMessage: null,
                  completion: null,
                },
              ]
            : [],
      ),
    },
    params.webContentsId,
  );
};

describe("assistant ipc contract", () => {
  itReq(FILE_REQUIREMENT_IDS, "validates assistant session payloads", async () => {
    const { handlers } = createHandlers();
    const result = await handlers.createSession({ viewKind: "not-a-view" }, 50);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("ValidationError");
    }
  });

  itReq(
    ["R9.11", "R9.14", "R9.17", "R9.18", "R9.22", "A1", "A3"],
    "keeps current agent draft edits pending until renderer reconciliation acknowledges completion metadata",
    async () => {
      const agentDraftContext = {
        ...validContext,
        activeEntityId: PRIMARY_AGENT_ID,
        contextLabel: "Agent editor / Planner",
        draftState: {
          changedFields: [],
          dirty: false,
          entityId: PRIMARY_AGENT_ID,
          entityKind: "agent" as const,
          summary: "Agent draft matches the saved state.",
        },
        listState: null,
        viewKind: "agentEdit" as const,
      };
      const { handlers } = createHandlers({
        plannerResponse: JSON.stringify({
          kind: "execute",
          summary: "Update the planner draft.",
          plannedCalls: [
            {
              callId: "call-1",
              toolName: "setAgentDraftFields",
              rationale: "Patch the current visible draft.",
              input: {
                name: "Planner Revised",
                tags: ["ops", "ready"],
              },
            },
          ],
        }),
      });
      const session = await handlers.createSession({ viewKind: "agentEdit" }, 70);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      const planned = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Rename this draft",
          context: agentDraftContext,
          response: null,
        },
        70,
      );
      expect(planned.ok).toBe(true);
      if (!planned.ok || planned.value.result.kind !== "execute") {
        return;
      }

      const executed = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Rename this draft",
          context: agentDraftContext,
          response: null,
        },
        70,
      );
      expect(executed.ok).toBe(true);
      if (!executed.ok || executed.value.result.kind !== "result") {
        return;
      }

      expect(executed.value.result.outcome).toBe("partial");
      expect(executed.value.result.executionResults).toMatchObject([
        {
          status: "reconciling",
          toolName: "setAgentDraftFields",
          output: {
            entityId: PRIMARY_AGENT_ID,
            patch: {
              name: "Planner Revised",
              tags: ["ops", "ready"],
            },
          },
        },
      ]);

      const reconciled = await handlers.completeReconciliation(
        {
          sessionId: session.value.session.sessionId,
          reconciliations: [
            {
              callId: "call-1",
              toolName: "setAgentDraftFields",
              status: "completed",
              failureMessage: null,
              completion: {
                output: {
                  appliedFieldLabels: ["name", "tags"],
                  entityId: PRIMARY_AGENT_ID,
                  patch: {
                    name: "Planner Revised",
                    tags: ["ops", "ready"],
                  },
                },
                userSummary: "Updated the current agent draft name, tags.",
              },
            },
          ],
        },
        70,
      );
      expect(reconciled.ok).toBe(true);
      if (!reconciled.ok || reconciled.value.result.kind !== "result") {
        return;
      }

      expect(reconciled.value.result.outcome).toBe("success");
      expect(reconciled.value.result.executionResults).toMatchObject([
        {
          status: "success",
          toolName: "setAgentDraftFields",
          output: {
            entityId: PRIMARY_AGENT_ID,
            patch: {
              name: "Planner Revised",
              tags: ["ops", "ready"],
            },
          },
          userSummary: "Updated the current agent draft name, tags.",
        },
      ]);
    },
  );

  itReq(
    ["R9.11", "R9.14", "R9.17", "R9.18", "R9.22", "A1", "A3"],
    "keeps current council draft edits pending until renderer reconciliation acknowledges completion metadata",
    async () => {
      const councilDraftContext = {
        ...validContext,
        activeEntityId: PRIMARY_COUNCIL_ID,
        contextLabel: "Council editor / Quarterly Council",
        draftState: {
          changedFields: [],
          dirty: false,
          entityId: PRIMARY_COUNCIL_ID,
          entityKind: "council" as const,
          summary: "Council draft matches the saved state.",
        },
        listState: null,
        viewKind: "councilCreate" as const,
      };
      const { handlers } = createHandlers({
        plannerResponse: JSON.stringify({
          kind: "execute",
          summary: "Update the current council draft.",
          plannedCalls: [
            {
              callId: "call-1",
              toolName: "setCouncilDraftFields",
              rationale: "Patch the current visible council draft.",
              input: {
                title: "Quarterly Council Updated",
                tags: ["ops", "ready"],
              },
            },
          ],
        }),
      });
      const session = await handlers.createSession({ viewKind: "councilCreate" }, 72);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      const planned = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Rename this council draft",
          context: councilDraftContext,
          response: null,
        },
        72,
      );
      expect(planned.ok).toBe(true);
      if (!planned.ok || planned.value.result.kind !== "execute") {
        return;
      }

      const executed = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Rename this council draft",
          context: councilDraftContext,
          response: null,
        },
        72,
      );
      expect(executed.ok).toBe(true);
      if (!executed.ok || executed.value.result.kind !== "result") {
        return;
      }

      expect(executed.value.result.outcome).toBe("partial");
      expect(executed.value.result.executionResults).toMatchObject([
        {
          status: "reconciling",
          toolName: "setCouncilDraftFields",
          output: {
            entityId: PRIMARY_COUNCIL_ID,
            patch: {
              title: "Quarterly Council Updated",
              tags: ["ops", "ready"],
            },
          },
        },
      ]);

      const reconciled = await handlers.completeReconciliation(
        {
          sessionId: session.value.session.sessionId,
          reconciliations: [
            {
              callId: "call-1",
              toolName: "setCouncilDraftFields",
              status: "completed",
              failureMessage: null,
              completion: {
                output: {
                  appliedFieldLabels: ["title", "tags"],
                  entityId: PRIMARY_COUNCIL_ID,
                  patch: {
                    title: "Quarterly Council Updated",
                    tags: ["ops", "ready"],
                  },
                },
                userSummary: "Updated the current council draft title, tags.",
              },
            },
          ],
        },
        72,
      );
      expect(reconciled.ok).toBe(true);
      if (!reconciled.ok || reconciled.value.result.kind !== "result") {
        return;
      }

      expect(reconciled.value.result.outcome).toBe("success");
      expect(reconciled.value.result.executionResults).toMatchObject([
        {
          status: "success",
          toolName: "setCouncilDraftFields",
          output: {
            entityId: PRIMARY_COUNCIL_ID,
            patch: {
              title: "Quarterly Council Updated",
              tags: ["ops", "ready"],
            },
          },
          userSummary: "Updated the current council draft title, tags.",
        },
      ]);
    },
  );

  itReq(
    ["R9.11", "R9.17", "R9.18", "R9.22", "U18.8", "U18.10", "U18.11", "A3"],
    "creates an agent through the authoritative save handler and waits for visible completion before success",
    async () => {
      const { handlers } = createHandlers({
        plannerResponse: JSON.stringify({
          kind: "execute",
          summary: "Create a new agent.",
          plannedCalls: [
            {
              callId: "call-create-agent",
              toolName: "createAgent",
              rationale: "Create the requested agent.",
              input: {
                modelRefOrNull: {
                  providerId: "gemini",
                  modelId: "gemini-1.5-flash",
                },
                name: "Strategy Coach",
                systemPrompt: "Coach the team toward practical next steps.",
                tags: ["ops"],
                temperature: 0.2,
                verbosity: "concise",
              },
            },
          ],
        }),
      });
      const session = await handlers.createSession({ viewKind: "agentsList" }, 82);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Create a strategy coach agent.",
          context: validContext,
          response: null,
        },
        82,
      );

      const executed = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Create a strategy coach agent.",
          context: validContext,
          response: null,
        },
        82,
      );
      expect(executed.ok).toBe(true);
      if (!executed.ok || executed.value.result.kind !== "result") {
        return;
      }

      expect(executed.value.result.outcome).toBe("partial");
      expect(executed.value.result.executionResults).toMatchObject([
        {
          callId: "call-create-agent",
          status: "reconciling",
          toolName: "createAgent",
          output: {
            agentId: PRIMARY_AGENT_ID,
            agentName: "Strategy Coach",
            savedFields: {
              name: "Strategy Coach",
              modelRefOrNull: {
                providerId: "gemini",
                modelId: "gemini-1.5-flash",
              },
              systemPrompt: "Coach the team toward practical next steps.",
              tags: ["ops"],
              temperature: 0.2,
              verbosity: "concise",
            },
          },
        },
      ]);

      const reconciled = await handlers.completeReconciliation(
        {
          sessionId: session.value.session.sessionId,
          reconciliations: [
            {
              callId: "call-create-agent",
              toolName: "createAgent",
              status: "completed",
              failureMessage: null,
              completion: null,
            },
          ],
        },
        82,
      );
      expect(reconciled.ok).toBe(true);
      if (!reconciled.ok || reconciled.value.result.kind !== "result") {
        return;
      }

      expect(reconciled.value.result.outcome).toBe("success");
      expect(reconciled.value.result.executionResults).toMatchObject([
        {
          callId: "call-create-agent",
          status: "success",
          toolName: "createAgent",
          output: {
            agentId: PRIMARY_AGENT_ID,
            agentName: "Strategy Coach",
            savedFields: {
              name: "Strategy Coach",
              modelRefOrNull: {
                providerId: "gemini",
                modelId: "gemini-1.5-flash",
              },
              systemPrompt: "Coach the team toward practical next steps.",
              tags: ["ops"],
              temperature: 0.2,
              verbosity: "concise",
            },
          },
        },
      ]);
    },
  );

  itReq(
    ["R9.11", "R9.17", "R9.18", "R9.22", "A1", "A3"],
    "returns authoritative saved council fields for update reconciliation",
    async () => {
      const savedDrafts: Array<Record<string, unknown>> = [];
      const { handlers } = createHandlers({
        onSaveCouncil: ({ draft }) => savedDrafts.push(draft),
        plannerResponse: JSON.stringify({
          kind: "execute",
          summary: "Update the saved council.",
          plannedCalls: [
            {
              callId: "call-update-council",
              toolName: "updateCouncilConfig",
              rationale: "Update the saved council configuration.",
              input: {
                councilId: PRIMARY_COUNCIL_ID,
                conductorModelRefOrNull: {
                  providerId: "gemini",
                  modelId: "gemini-1.5-flash",
                },
                memberAgentIds: [SECONDARY_AGENT_ID],
                title: "Quarterly Council Revised",
              },
            },
          ],
        }),
      });
      const session = await handlers.createSession({ viewKind: "councilsList" }, 84);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Update the saved council.",
          context: councilsListContext,
          response: null,
        },
        84,
      );

      const executed = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Update the saved council.",
          context: councilsListContext,
          response: null,
        },
        84,
      );
      expect(executed.ok).toBe(true);
      if (!executed.ok || executed.value.result.kind !== "result") {
        return;
      }

      expect(executed.value.result.outcome).toBe("partial");
      expect(executed.value.result.executionResults).toMatchObject([
        {
          callId: "call-update-council",
          status: "reconciling",
          toolName: "updateCouncilConfig",
          output: {
            councilId: PRIMARY_COUNCIL_ID,
            councilTitle: "Quarterly Council Revised",
            savedFields: {
              conductorModelRefOrNull: {
                providerId: "gemini",
                modelId: "gemini-1.5-flash",
              },
              goal: primaryCouncil.goal,
              memberAgentIds: [SECONDARY_AGENT_ID],
              mode: primaryCouncil.mode,
              tags: primaryCouncil.tags,
              title: "Quarterly Council Revised",
              topic: primaryCouncil.topic,
            },
          },
        },
      ]);
      expect(savedDrafts).toEqual([
        expect.objectContaining({
          id: PRIMARY_COUNCIL_ID,
          memberAgentIds: [SECONDARY_AGENT_ID],
          title: "Quarterly Council Revised",
          viewKind: "councilView",
        }),
      ]);

      const reconciled = await handlers.completeReconciliation(
        {
          sessionId: session.value.session.sessionId,
          reconciliations: [
            {
              callId: "call-update-council",
              toolName: "updateCouncilConfig",
              status: "completed",
              failureMessage: null,
              completion: null,
            },
          ],
        },
        84,
      );
      expect(reconciled.ok).toBe(true);
      if (!reconciled.ok || reconciled.value.result.kind !== "result") {
        return;
      }

      expect(reconciled.value.result.outcome).toBe("success");
      expect(reconciled.value.result.executionResults).toMatchObject([
        {
          callId: "call-update-council",
          status: "success",
          toolName: "updateCouncilConfig",
          output: {
            councilId: PRIMARY_COUNCIL_ID,
            councilTitle: "Quarterly Council Revised",
            savedFields: {
              conductorModelRefOrNull: {
                providerId: "gemini",
                modelId: "gemini-1.5-flash",
              },
              goal: primaryCouncil.goal,
              memberAgentIds: [SECONDARY_AGENT_ID],
              mode: primaryCouncil.mode,
              tags: primaryCouncil.tags,
              title: "Quarterly Council Revised",
              topic: primaryCouncil.topic,
            },
          },
        },
      ]);
    },
  );

  itReq(
    ["R9.11", "R9.14", "R9.17", "R9.18", "R9.22", "A1", "A3"],
    "patches the current council draft and then saves it through the normal save flow",
    async () => {
      const savedDrafts: Array<Record<string, unknown>> = [];
      const councilDraftContext = {
        ...validContext,
        activeEntityId: PRIMARY_COUNCIL_ID,
        contextLabel: "Council editor / Quarterly Council",
        draftState: {
          changedFields: ["title"],
          dirty: true,
          entityId: PRIMARY_COUNCIL_ID,
          entityKind: "council" as const,
          summary: "Council draft has 1 unsaved field change: title.",
        },
        listState: null,
        viewKind: "councilCreate" as const,
      };
      const { handlers } = createHandlers({
        onSaveCouncil: ({ draft }) => savedDrafts.push(draft),
        plannerResponse: JSON.stringify({
          kind: "execute",
          summary: "Update and save the current council draft.",
          plannedCalls: [
            {
              callId: "call-patch-council",
              toolName: "setCouncilDraftFields",
              rationale: "Apply the requested council draft updates.",
              input: {
                title: "Quarterly Council Revised",
              },
            },
            {
              callId: "call-save-council",
              toolName: "saveCouncilDraft",
              rationale: "Save the current council draft.",
              input: {
                entityId: PRIMARY_COUNCIL_ID,
              },
            },
          ],
        }),
      });
      const session = await handlers.createSession({ viewKind: "councilCreate" }, 83);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Rename this council and save it.",
          context: councilDraftContext,
          executionSnapshot: currentCouncilExecutionSnapshot,
          response: null,
        },
        83,
      );

      const executed = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Rename this council and save it.",
          context: councilDraftContext,
          executionSnapshot: currentCouncilExecutionSnapshot,
          response: null,
        },
        83,
      );
      expect(executed.ok).toBe(true);
      if (!executed.ok || executed.value.result.kind !== "result") {
        return;
      }

      expect(executed.value.result.outcome).toBe("partial");
      expect(executed.value.result.executionResults).toMatchObject([
        {
          callId: "call-patch-council",
          status: "reconciling",
          toolName: "setCouncilDraftFields",
        },
        {
          callId: "call-save-council",
          status: "reconciling",
          toolName: "saveCouncilDraft",
        },
      ]);
      expect(savedDrafts).toEqual([
        expect.objectContaining({
          conductorModelRefOrNull: null,
          goal: null,
          memberAgentIds: primaryCouncil.memberAgentIds,
          title: "Quarterly Council Revised",
          topic: primaryCouncil.topic,
          viewKind: "councilCreate",
        }),
      ]);

      const reconciled = await handlers.completeReconciliation(
        {
          sessionId: session.value.session.sessionId,
          reconciliations: [
            {
              callId: "call-patch-council",
              toolName: "setCouncilDraftFields",
              status: "completed",
              failureMessage: null,
              completion: {
                output: {
                  appliedFieldLabels: ["title"],
                  entityId: PRIMARY_COUNCIL_ID,
                  patch: {
                    title: "Quarterly Council Revised",
                  },
                },
                userSummary: "Updated the current council draft title.",
              },
            },
            {
              callId: "call-save-council",
              toolName: "saveCouncilDraft",
              status: "completed",
              failureMessage: null,
              completion: {
                output: {
                  councilId: PRIMARY_COUNCIL_ID,
                  councilTitle: "Quarterly Council Revised",
                  savedFields: {
                    conductorModelRefOrNull: null,
                    goal: null,
                    memberAgentIds: primaryCouncil.memberAgentIds,
                    mode: primaryCouncil.mode,
                    tags: primaryCouncil.tags,
                    title: "Quarterly Council Revised",
                    topic: primaryCouncil.topic,
                  },
                },
                userSummary: "Saved Quarterly Council Revised.",
              },
            },
          ],
        },
        83,
      );
      expect(reconciled.ok).toBe(true);
      if (!reconciled.ok || reconciled.value.result.kind !== "result") {
        return;
      }

      expect(reconciled.value.result.outcome).toBe("success");
      expect(reconciled.value.result.executionResults).toMatchObject([
        {
          callId: "call-patch-council",
          status: "success",
          toolName: "setCouncilDraftFields",
        },
        {
          callId: "call-save-council",
          status: "success",
          toolName: "saveCouncilDraft",
          output: {
            councilId: PRIMARY_COUNCIL_ID,
            councilTitle: "Quarterly Council Revised",
            savedFields: {
              conductorModelRefOrNull: null,
              goal: null,
              memberAgentIds: primaryCouncil.memberAgentIds,
              mode: primaryCouncil.mode,
              tags: primaryCouncil.tags,
              title: "Quarterly Council Revised",
              topic: primaryCouncil.topic,
            },
          },
          userSummary: "Saved Quarterly Council Revised.",
        },
      ]);
    },
  );

  itReq(
    ["R9.11", "R9.13", "R9.14", "U18.9", "A1", "A3"],
    "requires confirmation before replacing a dirty draft with another assistant action",
    async () => {
      const dirtyAgentDraftContext = {
        ...validContext,
        activeEntityId: PRIMARY_AGENT_ID,
        contextLabel: "Agent editor / Planner",
        draftState: {
          changedFields: ["name"],
          dirty: true,
          entityId: PRIMARY_AGENT_ID,
          entityKind: "agent" as const,
          summary: "Agent draft has 1 unsaved field change: name.",
        },
        listState: null,
        viewKind: "agentEdit" as const,
      };
      const { handlers } = createHandlers({
        plannerResponse: JSON.stringify({
          kind: "execute",
          summary: "Create a new agent.",
          plannedCalls: [
            {
              callId: "call-replace-draft",
              toolName: "createAgent",
              rationale: "Create a different agent.",
              input: {
                name: "Replacement Agent",
                systemPrompt: "A new agent.",
              },
            },
          ],
        }),
      });
      const session = await handlers.createSession({ viewKind: "agentEdit" }, 84);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      const planned = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Create a new agent.",
          context: dirtyAgentDraftContext,
          response: null,
        },
        84,
      );
      expect(planned.ok).toBe(true);
      if (!planned.ok) {
        return;
      }

      expect(planned.value.result.kind).toBe("confirm");
      if (planned.value.result.kind !== "confirm") {
        return;
      }

      expect(planned.value.result.confirmation.draftImpact).toBe("replace-current-draft");
      expect(planned.value.result.confirmation.scopeDescription).toContain("unsaved field change");
    },
  );

  itReq(
    ["R9.14", "R9.17", "R9.18", "R9.22", "U18.8", "A3"],
    "surfaces safe validation blockers from the authoritative save rules",
    async () => {
      const { handlers } = createHandlers({
        plannerResponse: JSON.stringify({
          kind: "execute",
          summary: "Create a blocked agent.",
          plannedCalls: [
            {
              callId: "call-blocked-agent",
              toolName: "createAgent",
              rationale: "Create the requested agent.",
              input: {
                name: "Blocked Agent",
                systemPrompt: "Needs a bad model.",
              },
            },
          ],
        }),
        saveAgentError: {
          kind: "InvalidConfigError",
          userMessage:
            "Selected model configuration is invalid in this view. Refresh models or change the model.",
          devMessage: "blocked for test",
        },
      });
      const session = await handlers.createSession({ viewKind: "agentsList" }, 85);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Create a blocked agent.",
          context: validContext,
          response: null,
        },
        85,
      );

      const executed = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Create a blocked agent.",
          context: validContext,
          response: null,
        },
        85,
      );
      expect(executed.ok).toBe(true);
      if (!executed.ok || executed.value.result.kind !== "result") {
        return;
      }

      expect(executed.value.result.outcome).toBe("failure");
      expect(executed.value.result.executionResults).toMatchObject([
        {
          callId: "call-blocked-agent",
          status: "failed",
          toolName: "createAgent",
          error: {
            kind: "InvalidConfigError",
            userMessage:
              "Selected model configuration is invalid in this view. Refresh models or change the model.",
          },
        },
      ]);
    },
  );

  itReq(
    ["R9.11", "R9.14", "R9.22", "A1", "A3"],
    "fails current draft edits when the request targets a different editor entity",
    async () => {
      const agentDraftContext = {
        ...validContext,
        activeEntityId: PRIMARY_AGENT_ID,
        contextLabel: "Agent editor / Planner",
        draftState: {
          changedFields: [],
          dirty: false,
          entityId: PRIMARY_AGENT_ID,
          entityKind: "agent" as const,
          summary: "Agent draft matches the saved state.",
        },
        listState: null,
        viewKind: "agentEdit" as const,
      };
      const { handlers } = createHandlers({
        plannerResponse: JSON.stringify({
          kind: "execute",
          summary: "Update a different draft.",
          plannedCalls: [
            {
              callId: "call-1",
              toolName: "setAgentDraftFields",
              rationale: "Patch a draft.",
              input: {
                entityId: SECONDARY_AGENT_ID,
                name: "Researcher Revised",
              },
            },
          ],
        }),
      });
      const session = await handlers.createSession({ viewKind: "agentEdit" }, 71);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Rename that other draft",
          context: agentDraftContext,
          response: null,
        },
        71,
      );

      const executed = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Rename that other draft",
          context: agentDraftContext,
          response: null,
        },
        71,
      );
      expect(executed.ok).toBe(true);
      if (!executed.ok || executed.value.result.kind !== "result") {
        return;
      }

      expect(executed.value.result.outcome).toBe("failure");
      expect(executed.value.result.executionResults).toMatchObject([
        {
          status: "failed",
          toolName: "setAgentDraftFields",
          error: {
            kind: "ValidationError",
          },
        },
      ]);
    },
  );

  itReq(
    ["R9.11", "R9.14", "R9.22", "A1", "A3"],
    "fails current draft edits when the current agent editor is archived",
    async () => {
      const agentDraftContext = {
        ...validContext,
        activeEntityId: PRIMARY_AGENT_ID,
        contextLabel: "Agent editor / Planner - archived",
        draftState: {
          changedFields: [],
          dirty: false,
          entityId: PRIMARY_AGENT_ID,
          entityKind: "agent" as const,
          summary: "Agent draft matches the saved state.",
        },
        listState: null,
        viewKind: "agentEdit" as const,
      };
      const { handlers } = createHandlers({
        agentEditorViewAgent: { ...primaryAgent, archived: true },
        plannerResponse: JSON.stringify({
          kind: "execute",
          summary: "Update the archived draft.",
          plannedCalls: [
            {
              callId: "call-1",
              toolName: "setAgentDraftFields",
              rationale: "Patch the archived draft.",
              input: {
                name: "Planner Updated",
              },
            },
          ],
        }),
      });
      const session = await handlers.createSession({ viewKind: "agentEdit" }, 73);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Rename this archived draft",
          context: agentDraftContext,
          response: null,
        },
        73,
      );

      const executed = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Rename this archived draft",
          context: agentDraftContext,
          response: null,
        },
        73,
      );
      expect(executed.ok).toBe(true);
      if (!executed.ok || executed.value.result.kind !== "result") {
        return;
      }

      expect(executed.value.result.outcome).toBe("failure");
      expect(executed.value.result.executionResults).toMatchObject([
        {
          status: "failed",
          toolName: "setAgentDraftFields",
          error: {
            kind: "ValidationError",
            userMessage:
              "Archived agents are read-only. Restore the current agent before editing it.",
          },
        },
      ]);
    },
  );

  itReq(
    ["R9.11", "R9.14", "R9.22", "A1", "A3"],
    "fails current draft edits when the current council editor is archived or mode-locked",
    async () => {
      const councilDraftContext = {
        ...validContext,
        activeEntityId: PRIMARY_COUNCIL_ID,
        contextLabel: "Council editor / Quarterly Council - archived",
        draftState: {
          changedFields: [],
          dirty: false,
          entityId: PRIMARY_COUNCIL_ID,
          entityKind: "council" as const,
          summary: "Council draft matches the saved state.",
        },
        listState: null,
        viewKind: "councilCreate" as const,
      };

      const archivedHandlers = createHandlers({
        councilEditorViewCouncil: { ...primaryCouncil, archived: true },
        plannerResponse: JSON.stringify({
          kind: "execute",
          summary: "Update the archived council draft.",
          plannedCalls: [
            {
              callId: "call-1",
              toolName: "setCouncilDraftFields",
              rationale: "Patch the archived council draft.",
              input: {
                title: "Archived Update",
              },
            },
          ],
        }),
      }).handlers;
      const archivedSession = await archivedHandlers.createSession(
        { viewKind: "councilCreate" },
        74,
      );
      expect(archivedSession.ok).toBe(true);
      if (!archivedSession.ok) {
        return;
      }

      await archivedHandlers.submit(
        {
          sessionId: archivedSession.value.session.sessionId,
          userRequest: "Rename this archived council draft",
          context: councilDraftContext,
          response: null,
        },
        74,
      );

      const archivedExecuted = await archivedHandlers.submit(
        {
          sessionId: archivedSession.value.session.sessionId,
          userRequest: "Rename this archived council draft",
          context: councilDraftContext,
          response: null,
        },
        74,
      );
      expect(archivedExecuted.ok).toBe(true);
      if (!archivedExecuted.ok || archivedExecuted.value.result.kind !== "result") {
        return;
      }

      expect(archivedExecuted.value.result.outcome).toBe("failure");
      expect(archivedExecuted.value.result.executionResults).toMatchObject([
        {
          status: "failed",
          toolName: "setCouncilDraftFields",
          error: {
            kind: "ValidationError",
            userMessage:
              "Archived councils are read-only. Restore the current council before editing it.",
          },
        },
      ]);

      const modeLockedHandlers = createHandlers({
        plannerResponse: JSON.stringify({
          kind: "execute",
          summary: "Change the saved council mode.",
          plannedCalls: [
            {
              callId: "call-1",
              toolName: "setCouncilDraftFields",
              rationale: "Patch the saved council mode.",
              input: {
                mode: "autopilot",
              },
            },
          ],
        }),
      }).handlers;
      const modeLockedSession = await modeLockedHandlers.createSession(
        { viewKind: "councilCreate" },
        75,
      );
      expect(modeLockedSession.ok).toBe(true);
      if (!modeLockedSession.ok) {
        return;
      }

      await modeLockedHandlers.submit(
        {
          sessionId: modeLockedSession.value.session.sessionId,
          userRequest: "Switch this saved council to autopilot",
          context: councilDraftContext,
          response: null,
        },
        75,
      );

      const modeLockedExecuted = await modeLockedHandlers.submit(
        {
          sessionId: modeLockedSession.value.session.sessionId,
          userRequest: "Switch this saved council to autopilot",
          context: councilDraftContext,
          response: null,
        },
        75,
      );
      expect(modeLockedExecuted.ok).toBe(true);
      if (!modeLockedExecuted.ok || modeLockedExecuted.value.result.kind !== "result") {
        return;
      }

      expect(modeLockedExecuted.value.result.outcome).toBe("failure");
      expect(modeLockedExecuted.value.result.executionResults).toMatchObject([
        {
          status: "failed",
          toolName: "setCouncilDraftFields",
          error: {
            kind: "ValidationError",
            userMessage:
              "Council mode is locked after creation. Open a new council draft to change the mode.",
          },
        },
      ]);
    },
  );

  itReq(
    ["R9.11", "R9.14", "R9.17", "R9.22", "A1", "A3"],
    "preserves model changes when rewriting a current-agent update into an in-place draft patch",
    async () => {
      const agentDraftContext = {
        ...validContext,
        activeEntityId: PRIMARY_AGENT_ID,
        contextLabel: "Agent editor / Planner",
        draftState: {
          changedFields: [],
          dirty: false,
          entityId: PRIMARY_AGENT_ID,
          entityKind: "agent" as const,
          summary: "Agent draft matches the saved state.",
        },
        listState: null,
        viewKind: "agentEdit" as const,
      };
      const { handlers } = createHandlers({
        plannerResponse: JSON.stringify({
          kind: "execute",
          summary: "Update the current agent.",
          plannedCalls: [
            {
              callId: "call-update-agent",
              toolName: "updateAgent",
              rationale: "Update the open agent.",
              input: {
                agentId: PRIMARY_AGENT_ID,
                modelRefOrNull: {
                  providerId: "gemini",
                  modelId: "gemini-1.5-flash",
                },
                name: "Planner Revised",
              },
            },
          ],
        }),
      });
      const session = await handlers.createSession({ viewKind: "agentEdit" }, 75);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      const planned = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Update this agent and set its model.",
          context: agentDraftContext,
          response: null,
        },
        75,
      );
      expect(planned.ok).toBe(true);
      if (!planned.ok || planned.value.result.kind !== "execute") {
        return;
      }

      expect(planned.value.result.plannedCalls).toMatchObject([
        {
          toolName: "setAgentDraftFields",
          input: {
            entityId: PRIMARY_AGENT_ID,
            modelRefOrNull: {
              providerId: "gemini",
              modelId: "gemini-1.5-flash",
            },
            name: "Planner Revised",
          },
        },
      ]);
    },
  );

  itReq(
    ["R9.11", "R9.14", "R9.17", "R9.22", "A1", "A3"],
    "preserves conductor and member changes when rewriting a current-council update into an in-place draft patch",
    async () => {
      const councilDraftContext = {
        ...validContext,
        activeEntityId: PRIMARY_COUNCIL_ID,
        contextLabel: "Council editor / Quarterly Council",
        draftState: {
          changedFields: [],
          dirty: false,
          entityId: PRIMARY_COUNCIL_ID,
          entityKind: "council" as const,
          summary: "Council draft matches the saved state.",
        },
        listState: null,
        viewKind: "councilCreate" as const,
      };
      const { handlers } = createHandlers({
        plannerResponse: JSON.stringify({
          kind: "execute",
          summary: "Update the current council.",
          plannedCalls: [
            {
              callId: "call-update-council",
              toolName: "updateCouncilConfig",
              rationale: "Update the open council.",
              input: {
                councilId: PRIMARY_COUNCIL_ID,
                conductorModelRefOrNull: {
                  providerId: "gemini",
                  modelId: "gemini-1.5-flash",
                },
                memberAgentIds: [SECONDARY_AGENT_ID],
                title: "Quarterly Council Revised",
              },
            },
          ],
        }),
      });
      const session = await handlers.createSession({ viewKind: "councilCreate" }, 76);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      const planned = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Update this council and change its members and conductor model.",
          context: councilDraftContext,
          response: null,
        },
        76,
      );
      expect(planned.ok).toBe(true);
      if (!planned.ok || planned.value.result.kind !== "execute") {
        return;
      }

      expect(planned.value.result.plannedCalls).toMatchObject([
        {
          toolName: "setCouncilDraftFields",
          input: {
            entityId: PRIMARY_COUNCIL_ID,
            conductorModelRefOrNull: {
              providerId: "gemini",
              modelId: "gemini-1.5-flash",
            },
            memberAgentIds: [SECONDARY_AGENT_ID],
            title: "Quarterly Council Revised",
          },
        },
      ]);
    },
  );

  itReq(
    ["R9.1", "R9.11", "R9.14", "R9.17", "U18.7", "A1", "D5"],
    "uses the deterministic current agent draft shortcut when the request is explicit",
    async () => {
      const agentDraftContext = {
        ...validContext,
        activeEntityId: PRIMARY_AGENT_ID,
        contextLabel: "Agent editor / Planner",
        draftState: {
          changedFields: [],
          dirty: false,
          entityId: PRIMARY_AGENT_ID,
          entityKind: "agent" as const,
          summary: "Agent draft matches the saved state.",
        },
        listState: null,
        viewKind: "agentEdit" as const,
      };
      const plannerRequests: Array<string> = [];
      const { handlers } = createHandlers({
        onPlannerRequest: (request) => plannerRequests.push(request.userRequest),
      });
      const session = await handlers.createSession({ viewKind: "agentEdit" }, 76);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      const planned = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest:
            "Rename this draft to Scenario Draft Agent Updated and set tags to ops, ready without saving.",
          context: agentDraftContext,
          response: null,
        },
        76,
      );
      expect(planned.ok).toBe(true);
      if (!planned.ok || planned.value.result.kind !== "execute") {
        return;
      }

      expect(planned.value.result.planSummary).toBe(
        "Rename the current draft to Scenario Draft Agent Updated and update its tags.",
      );
      expect(planned.value.result.plannedCalls).toMatchObject([
        {
          toolName: "setAgentDraftFields",
          input: {
            name: "Scenario Draft Agent Updated",
            tags: ["ops", "ready"],
          },
        },
      ]);
      expect(plannerRequests).toEqual([]);
    },
  );

  itReq(
    FILE_REQUIREMENT_IDS,
    "returns a safe placeholder result when planner execution is not enabled",
    async () => {
      const { handlers, events } = createHandlers();
      const session = await handlers.createSession({ viewKind: "agentsList" }, 51);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      const submit = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Show me the agents list",
          context: validContext,
          response: null,
        },
        51,
      );

      expect(submit.ok).toBe(true);
      if (!submit.ok) {
        return;
      }

      expect(submit.value.result.kind).toBe("result");
      if (submit.value.result.kind !== "result") {
        return;
      }

      expect(submit.value.result.outcome).toBe("failure");
      expect(submit.value.result.message).toContain("foundation is registered");
      expect(JSON.stringify(events)).not.toContain("Show me the agents list");
      expect(JSON.stringify(events)).not.toContain("/tmp/private.txt");
    },
  );

  itReq(
    ["R9.3", "A1", "D1", "D5"],
    "fails closed when the global default model is missing or invalid",
    async () => {
      const plannerRequests: Array<{
        modelRef: { providerId: string; modelId: string };
        userRequest: string;
      }> = [];

      const missingModelHandlers = createHandlers({
        globalDefaultModelRef: null,
        plannerResponse: JSON.stringify({ kind: "clarify", question: "unused" }),
        onPlannerRequest: (request) => plannerRequests.push(request),
      }).handlers;
      const missingSession = await missingModelHandlers.createSession(
        { viewKind: "agentsList" },
        151,
      );
      expect(missingSession.ok).toBe(true);
      if (!missingSession.ok) {
        return;
      }

      const missingModelSubmit = await missingModelHandlers.submit(
        {
          sessionId: missingSession.value.session.sessionId,
          userRequest: "Open the planner",
          context: validContext,
          response: null,
        },
        151,
      );

      expect(missingModelSubmit.ok).toBe(true);
      if (!missingModelSubmit.ok || missingModelSubmit.value.result.kind !== "result") {
        return;
      }

      expect(missingModelSubmit.value.result.outcome).toBe("failure");
      expect(missingModelSubmit.value.result.error?.kind).toBe("InvalidConfigError");
      expect(missingModelSubmit.value.result.message).toBe(
        "Assistant needs a valid global default model before it can plan.",
      );

      const invalidModelHandlers = createHandlers({
        globalDefaultModelInvalidConfig: true,
        plannerResponse: JSON.stringify({ kind: "clarify", question: "unused" }),
        onPlannerRequest: (request) => plannerRequests.push(request),
      }).handlers;
      const invalidSession = await invalidModelHandlers.createSession(
        { viewKind: "agentsList" },
        152,
      );
      expect(invalidSession.ok).toBe(true);
      if (!invalidSession.ok) {
        return;
      }

      const invalidModelSubmit = await invalidModelHandlers.submit(
        {
          sessionId: invalidSession.value.session.sessionId,
          userRequest: "Open the planner",
          context: validContext,
          response: null,
        },
        152,
      );

      expect(invalidModelSubmit.ok).toBe(true);
      if (!invalidModelSubmit.ok || invalidModelSubmit.value.result.kind !== "result") {
        return;
      }

      expect(invalidModelSubmit.value.result.outcome).toBe("failure");
      expect(invalidModelSubmit.value.result.error?.kind).toBe("InvalidConfigError");
      expect(plannerRequests).toEqual([]);
    },
  );

  itReq(
    ["R9.3", "A1", "D1", "D5"],
    "passes the global default model through the planner request in main",
    async () => {
      const plannerRequests: Array<{
        modelRef: { providerId: string; modelId: string };
        userRequest: string;
      }> = [];
      const { handlers } = createHandlers({
        plannerResponse: JSON.stringify({
          kind: "clarify",
          question: "Which agent should I open?",
        }),
        onPlannerRequest: (request) => plannerRequests.push(request),
        globalDefaultModelRef: {
          providerId: "openrouter",
          modelId: "gpt-4.1-mini",
        },
      });
      const session = await handlers.createSession({ viewKind: "agentsList" }, 153);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      const submit = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Open the planner",
          context: validContext,
          response: null,
        },
        153,
      );

      expect(submit.ok).toBe(true);
      expect(plannerRequests).toEqual([
        {
          modelRef: {
            providerId: "openrouter",
            modelId: "gpt-4.1-mini",
          },
          userRequest: "Open the planner",
        },
      ]);
    },
  );

  itReq(FILE_REQUIREMENT_IDS, "returns parsed planner clarify responses over IPC", async () => {
    const { handlers } = createHandlers({
      plannerResponse: JSON.stringify({
        kind: "clarify",
        question: "Which agent should I open?",
      }),
    });
    const session = await handlers.createSession({ viewKind: "agentsList" }, 52);
    expect(session.ok).toBe(true);
    if (!session.ok) {
      return;
    }

    const submit = await handlers.submit(
      {
        sessionId: session.value.session.sessionId,
        userRequest: "Open the agent editor",
        context: validContext,
        response: null,
      },
      52,
    );

    expect(submit.ok).toBe(true);
    if (!submit.ok) {
      return;
    }
    expect(submit.value.result.kind).toBe("clarify");
  });

  itReq(
    ["R9.7", "R9.18", "R9.19", "R9.20", "A3", "D5"],
    "loops clarification through the same session and then executes the stored plan",
    async () => {
      let plannerCallCount = 0;
      const slice = createAssistantSlice({
        ...createAssistantSliceDeps(),
        planAssistantResponse: () => {
          plannerCallCount += 1;
          return okAsync(
            plannerCallCount === 1
              ? JSON.stringify({
                  kind: "clarify",
                  question: "Which council should I open?",
                })
              : JSON.stringify({
                  kind: "execute",
                  summary: "Open Quarterly Council.",
                  plannedCalls: [
                    {
                      callId: "call-1",
                      toolName: "openCouncilView",
                      rationale: "Open the selected council.",
                      input: {
                        councilId: PRIMARY_COUNCIL_ID,
                      },
                    },
                  ],
                }),
          );
        },
      });
      const handlers = createAssistantIpcHandlers(slice);
      const session = await handlers.createSession({ viewKind: "agentsList" }, 60);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      const firstSubmit = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Open the council",
          context: validContext,
          response: null,
        },
        60,
      );
      expect(firstSubmit.ok).toBe(true);
      if (!firstSubmit.ok || firstSubmit.value.result.kind !== "clarify") {
        return;
      }

      const secondSubmit = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Open the council",
          context: validContext,
          response: {
            kind: "clarification",
            text: "Quarterly Council",
          },
        },
        60,
      );
      expect(secondSubmit.ok).toBe(true);
      if (!secondSubmit.ok) {
        return;
      }
      expect(secondSubmit.value.result).toMatchObject({
        kind: "execute",
        message: "Open Quarterly Council.",
      });

      const executeSubmit = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Open the council",
          context: validContext,
          response: null,
        },
        60,
      );
      expect(executeSubmit.ok).toBe(true);
      if (!executeSubmit.ok || executeSubmit.value.result.kind !== "result") {
        return;
      }

      expect(executeSubmit.value.result.outcome).toBe("partial");
      expect(executeSubmit.value.result.executionResults).toMatchObject([
        {
          status: "reconciling",
          toolName: "openCouncilView",
        },
      ]);

      const reconciled = await completeAllNavigationReconciliations({
        handlers,
        result: executeSubmit.value.result,
        webContentsId: 60,
      });
      expect(reconciled.ok).toBe(true);
      if (!reconciled.ok || reconciled.value.result.kind !== "result") {
        return;
      }

      expect(reconciled.value.result.outcome).toBe("success");
      expect(reconciled.value.result.executionResults).toMatchObject([
        {
          status: "success",
          toolName: "openCouncilView",
          reconciliationState: "completed",
        },
      ]);
    },
  );

  itReq(
    ["R9.7", "R9.18", "R9.19", "R9.20", "A3", "D5"],
    "resolves open council clarifications locally when the planner already asked for a council name",
    async () => {
      let plannerCallCount = 0;
      const slice = createAssistantSlice({
        ...createAssistantSliceDeps(),
        planAssistantResponse: () => {
          plannerCallCount += 1;
          return okAsync(
            JSON.stringify({
              kind: "clarify",
              question: "Which council would you like to open?",
            }),
          );
        },
      });
      const handlers = createAssistantIpcHandlers(slice);
      const session = await handlers.createSession({ viewKind: "councilsList" }, 160);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      const firstSubmit = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Open the council",
          context: councilsListContext,
          response: null,
        },
        160,
      );
      expect(firstSubmit.ok).toBe(true);
      if (!firstSubmit.ok || firstSubmit.value.result.kind !== "clarify") {
        return;
      }

      const secondSubmit = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Open the council",
          context: councilsListContext,
          response: {
            kind: "clarification",
            text: primaryCouncil.title,
          },
        },
        160,
      );
      expect(secondSubmit.ok).toBe(true);
      if (!secondSubmit.ok || secondSubmit.value.result.kind !== "execute") {
        return;
      }

      expect(plannerCallCount).toBe(1);
      expect(secondSubmit.value.result).toMatchObject({
        kind: "execute",
        message: `Open ${primaryCouncil.title}.`,
        plannedCalls: [
          {
            toolName: "openCouncilView",
            input: { councilId: PRIMARY_COUNCIL_ID },
          },
        ],
      });
    },
  );

  itReq(
    ["R9.3", "R9.7", "R9.19", "A3", "D5"],
    "blocks stored clarification follow-up turns when the global default model becomes invalid",
    async () => {
      let plannerCallCount = 0;
      let settingsCallCount = 0;
      const slice = createAssistantSlice({
        ...createAssistantSliceDeps(),
        getSettingsView: ({ viewKind }) => {
          settingsCallCount += 1;
          return okAsync({
            providers: [],
            globalDefaultModelRef:
              settingsCallCount === 1
                ? {
                    providerId: "gemini",
                    modelId: "gemini-1.5-flash",
                  }
                : null,
            globalDefaultModelInvalidConfig: false,
            contextLastN: 24,
            modelCatalog: {
              snapshotId: `${viewKind}-snapshot-1`,
              modelsByProvider: {
                gemini: ["gemini-1.5-flash"],
              },
            },
            canRefreshModels: true,
          });
        },
        planAssistantResponse: () => {
          plannerCallCount += 1;
          return okAsync(
            JSON.stringify({
              kind: "clarify",
              question: "Which council would you like to open?",
            }),
          );
        },
      });
      const handlers = createAssistantIpcHandlers(slice);
      const session = await handlers.createSession({ viewKind: "councilsList" }, 161);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      const firstSubmit = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Open the council",
          context: councilsListContext,
          response: null,
        },
        161,
      );
      expect(firstSubmit.ok).toBe(true);
      if (!firstSubmit.ok || firstSubmit.value.result.kind !== "clarify") {
        return;
      }

      const secondSubmit = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Open the council",
          context: councilsListContext,
          response: {
            kind: "clarification",
            text: primaryCouncil.title,
          },
        },
        161,
      );
      expect(secondSubmit.ok).toBe(true);
      if (!secondSubmit.ok) {
        return;
      }

      expect(plannerCallCount).toBe(1);
      expect(secondSubmit.value.result).toMatchObject({
        kind: "result",
        outcome: "failure",
        message: "Assistant needs a valid global default model before it can plan.",
        error: {
          kind: "InvalidConfigError",
        },
      });
    },
  );

  itReq(
    ["R9.3", "R9.7", "R9.18", "R9.19", "R9.20", "R9.22", "A1", "A3", "D5"],
    "executes supported read and navigation tools into a final assistant result",
    async () => {
      const { handlers } = createHandlers({
        plannerResponse: JSON.stringify({
          kind: "execute",
          summary: "Review agents, inspect a council, then open it.",
          plannedCalls: [
            {
              callId: "call-1",
              toolName: "listAgents",
              rationale: "Review matching agents.",
              input: {
                searchText: "plan",
              },
            },
            {
              callId: "call-2",
              toolName: "getCouncilRuntimeState",
              rationale: "Inspect runtime state.",
              input: {
                councilId: PRIMARY_COUNCIL_ID,
              },
            },
            {
              callId: "call-3",
              toolName: "openCouncilView",
              rationale: "Open the council.",
              input: {
                councilId: PRIMARY_COUNCIL_ID,
              },
            },
          ],
        }),
      });
      const session = await handlers.createSession({ viewKind: "agentsList" }, 61);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      const plan = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Review the planning council and open it",
          context: validContext,
          response: null,
        },
        61,
      );
      expect(plan.ok).toBe(true);
      if (!plan.ok || plan.value.result.kind !== "execute") {
        return;
      }

      const executed = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Review the planning council and open it",
          context: validContext,
          response: null,
        },
        61,
      );
      expect(executed.ok).toBe(true);
      if (!executed.ok || executed.value.result.kind !== "result") {
        return;
      }

      expect(executed.value.result.outcome).toBe("partial");
      expect(executed.value.result.executionResults).toMatchObject([
        {
          status: "success",
          toolName: "listAgents",
          output: {
            total: 2,
          },
        },
        {
          status: "success",
          toolName: "getCouncilRuntimeState",
          output: {
            councilId: PRIMARY_COUNCIL_ID,
            runtimeStatus: "running",
          },
        },
        {
          status: "reconciling",
          toolName: "openCouncilView",
          output: {
            councilId: PRIMARY_COUNCIL_ID,
            councilTitle: "Quarterly Council",
          },
        },
      ]);

      const reconciled = await completeAllNavigationReconciliations({
        handlers,
        result: executed.value.result,
        webContentsId: 61,
      });
      expect(reconciled.ok).toBe(true);
      if (!reconciled.ok || reconciled.value.result.kind !== "result") {
        return;
      }

      expect(reconciled.value.result.outcome).toBe("success");
      expect(reconciled.value.result.executionResults.at(-1)).toMatchObject({
        status: "success",
        toolName: "openCouncilView",
        reconciliationState: "completed",
      });
    },
  );

  itReq(
    ["R9.18", "R9.19", "R9.22", "U18.8", "U18.10", "U18.11", "A1", "D5"],
    "uses the council runtime read tool for runtime-status follow-up questions on the open council",
    async () => {
      let plannerCallCount = 0;
      const { handlers } = createHandlers({
        plannerResponse: JSON.stringify({
          kind: "execute",
          summary: "This fallback planner response should not run.",
          plannedCalls: [
            {
              callId: "call-fallback",
              toolName: "listCouncils",
              rationale: "Unexpected fallback",
              input: {},
            },
          ],
        }),
        onPlannerRequest: () => {
          plannerCallCount += 1;
        },
      });
      const session = await handlers.createSession({ viewKind: "councilView" }, 62);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      const planned = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "What is the runtime status of this council?",
          context: councilViewContext,
          response: null,
        },
        62,
      );
      expect(planned.ok).toBe(true);
      if (!planned.ok || planned.value.result.kind !== "execute") {
        return;
      }

      expect(plannerCallCount).toBe(0);
      expect(planned.value.result.plannedCalls).toMatchObject([
        {
          toolName: "getCouncilRuntimeState",
          input: {
            councilId: PRIMARY_COUNCIL_ID,
          },
        },
      ]);

      const executed = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "What is the runtime status of this council?",
          context: councilViewContext,
          response: null,
        },
        62,
      );
      expect(executed.ok).toBe(true);
      if (!executed.ok || executed.value.result.kind !== "result") {
        return;
      }

      expect(executed.value.result.outcome).toBe("success");
      expect(executed.value.result.executionResults).toMatchObject([
        {
          status: "success",
          toolName: "getCouncilRuntimeState",
          output: {
            councilId: PRIMARY_COUNCIL_ID,
            runtimeStatus: "running",
          },
          userSummary: "Quarterly Council is running with 2 turn(s) and 1 message(s).",
        },
      ]);
    },
  );

  itReq(
    ["R9.3", "R9.7", "R9.18", "R9.19", "R9.20", "R9.22", "A1", "A3", "D5"],
    "supports the remaining phase 1 home, entity, and list read tools",
    async () => {
      const { handlers } = createHandlers({
        plannerResponse: JSON.stringify({
          kind: "execute",
          summary: "Review entities and return home.",
          plannedCalls: [
            {
              callId: "call-1",
              toolName: "navigateToHomeTab",
              rationale: "Go to the agents tab.",
              input: {
                tab: "agentsList",
              },
            },
            {
              callId: "call-2",
              toolName: "getAgent",
              rationale: "Inspect the planner agent.",
              input: {
                agentId: PRIMARY_AGENT_ID,
              },
            },
            {
              callId: "call-3",
              toolName: "openAgentEditor",
              rationale: "Open the planner agent.",
              input: {
                agentId: PRIMARY_AGENT_ID,
              },
            },
            {
              callId: "call-4",
              toolName: "listCouncils",
              rationale: "Review active councils.",
              input: {},
            },
            {
              callId: "call-5",
              toolName: "getCouncil",
              rationale: "Inspect the current council.",
              input: {
                councilId: PRIMARY_COUNCIL_ID,
              },
            },
            {
              callId: "call-6",
              toolName: "openCouncilEditor",
              rationale: "Open the council editor.",
              input: {
                councilId: PRIMARY_COUNCIL_ID,
              },
            },
          ],
        }),
      });
      const session = await handlers.createSession({ viewKind: "agentsList" }, 62);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      const plan = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Inspect the planner agent and planning council",
          context: validContext,
          response: null,
        },
        62,
      );
      expect(plan.ok).toBe(true);
      if (!plan.ok || plan.value.result.kind !== "execute") {
        return;
      }

      const executed = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Inspect the planner agent and planning council",
          context: validContext,
          response: null,
        },
        62,
      );
      expect(executed.ok).toBe(true);
      if (!executed.ok || executed.value.result.kind !== "result") {
        return;
      }

      expect(executed.value.result.outcome).toBe("partial");
      expect(executed.value.result.executionResults).toMatchObject([
        { status: "reconciling", toolName: "navigateToHomeTab" },
        { status: "success", toolName: "getAgent", output: { agentId: PRIMARY_AGENT_ID } },
        {
          status: "reconciling",
          toolName: "openAgentEditor",
          output: { agentId: PRIMARY_AGENT_ID },
        },
        { status: "success", toolName: "listCouncils", output: { total: 1 } },
        { status: "success", toolName: "getCouncil", output: { councilId: PRIMARY_COUNCIL_ID } },
        {
          status: "reconciling",
          toolName: "openCouncilEditor",
          output: { councilId: PRIMARY_COUNCIL_ID },
        },
      ]);

      const reconciled = await completeAllNavigationReconciliations({
        handlers,
        result: executed.value.result,
        webContentsId: 62,
      });
      expect(reconciled.ok).toBe(true);
      if (!reconciled.ok || reconciled.value.result.kind !== "result") {
        return;
      }

      expect(reconciled.value.result.outcome).toBe("success");
      expect(reconciled.value.result.executionResults).toMatchObject([
        { status: "success", toolName: "navigateToHomeTab" },
        { status: "success", toolName: "getAgent", output: { agentId: PRIMARY_AGENT_ID } },
        { status: "success", toolName: "openAgentEditor", output: { agentId: PRIMARY_AGENT_ID } },
        { status: "success", toolName: "listCouncils", output: { total: 1 } },
        { status: "success", toolName: "getCouncil", output: { councilId: PRIMARY_COUNCIL_ID } },
        {
          status: "success",
          toolName: "openCouncilEditor",
          output: { councilId: PRIMARY_COUNCIL_ID },
        },
      ]);
    },
  );

  itReq(
    ["R9.17", "R9.18", "R9.22", "U18.8", "U18.10", "U18.11", "A3", "D5"],
    "fails navigation reconciliation closed when the visible destination never appears",
    async () => {
      const { handlers } = createHandlers({
        plannerResponse: JSON.stringify({
          kind: "execute",
          summary: "Open the council.",
          plannedCalls: [
            {
              callId: "call-1",
              toolName: "openCouncilView",
              rationale: "Open the council.",
              input: {
                councilId: PRIMARY_COUNCIL_ID,
              },
            },
          ],
        }),
      });
      const session = await handlers.createSession({ viewKind: "agentsList" }, 63);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      const plan = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Open the planning council",
          context: validContext,
          response: null,
        },
        63,
      );
      expect(plan.ok).toBe(true);
      if (!plan.ok || plan.value.result.kind !== "execute") {
        return;
      }

      const executed = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Open the planning council",
          context: validContext,
          response: null,
        },
        63,
      );
      expect(executed.ok).toBe(true);
      if (!executed.ok || executed.value.result.kind !== "result") {
        return;
      }

      const reconciled = await handlers.completeReconciliation(
        {
          sessionId: session.value.session.sessionId,
          reconciliations: [
            {
              callId: "call-1",
              toolName: "openCouncilView",
              status: "failed",
              failureMessage: "The requested council view never became visible.",
              completion: null,
            },
          ],
        },
        63,
      );
      expect(reconciled.ok).toBe(true);
      if (!reconciled.ok || reconciled.value.result.kind !== "result") {
        return;
      }

      expect(reconciled.value.result.outcome).toBe("failure");
      expect(reconciled.value.result.error?.kind).toBe("StateViolationError");
      expect(reconciled.value.result.executionResults).toMatchObject([
        {
          status: "failed",
          toolName: "openCouncilView",
          error: {
            kind: "StateViolationError",
          },
        },
      ]);
    },
  );

  itReq(
    FLOW_AND_TOOL_CONTRACT_REQUIREMENT_IDS,
    "sanitizes assistant submit text and planner calls across ipc",
    async () => {
      const plannerRequests: Array<{
        modelRef: { providerId: string; modelId: string };
        userRequest: string;
      }> = [];
      const { handlers } = createHandlers({
        plannerResponse: JSON.stringify({
          kind: "execute",
          summary: "Inspect /tmp/private notes.txt",
          plannedCalls: [
            {
              callId: "call-1",
              toolName: "listAgents",
              rationale: "Search ../secret folder/notes.txt first.",
              input: {
                searchText: "../secret folder/notes.txt",
              },
            },
          ],
        }),
        onPlannerRequest: (request) => plannerRequests.push(request),
      });
      const session = await handlers.createSession({ viewKind: "agentsList" }, 55);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      const submit = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Open /tmp/private notes.txt with Bearer top-secret",
          context: validContext,
          response: {
            kind: "clarification",
            text: "Use ../secret notes/notes.md instead",
          },
        },
        55,
      );

      expect(plannerRequests).toEqual([
        {
          modelRef: {
            providerId: "gemini",
            modelId: "gemini-1.5-flash",
          },
          userRequest: "Open [redacted] with [redacted]",
        },
      ]);
      expect(submit.ok).toBe(true);
      if (!submit.ok) {
        return;
      }

      expect(submit.value.result.kind).toBe("execute");
      if (submit.value.result.kind !== "execute") {
        return;
      }

      expect(submit.value.result.message).toBe("Inspect [redacted]");
      expect(submit.value.result.plannedCalls).toEqual([
        {
          callId: "call-1",
          toolName: "listAgents",
          rationale: "Search [redacted] first.",
          input: {
            searchText: "[redacted]",
          },
        },
      ]);
    },
  );

  itReq(
    ["R9.3", "R9.4", "R9.22", "A3"],
    "rejects submits whose context view kind does not match the session scope",
    async () => {
      const plannerRequests: Array<{
        modelRef: { providerId: string; modelId: string };
        userRequest: string;
      }> = [];
      const settingsViewRequests: Array<{ viewKind: string }> = [];
      const { handlers } = createHandlers({
        plannerResponse: JSON.stringify({
          kind: "clarify",
          question: "Which agent should I open?",
        }),
        onPlannerRequest: (request) => plannerRequests.push(request),
        onGetSettingsView: (request) => settingsViewRequests.push(request),
      });
      const session = await handlers.createSession({ viewKind: "agentsList" }, 57);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      const submit = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Open the agent editor",
          context: {
            ...validContext,
            viewKind: "settings",
          },
          response: null,
        },
        57,
      );

      expect(settingsViewRequests).toEqual([]);
      expect(plannerRequests).toEqual([]);
      expect(submit.ok).toBe(true);
      if (!submit.ok) {
        return;
      }

      expect(submit.value.result).toMatchObject({
        kind: "result",
        outcome: "failure",
        message: "That assistant session belongs to a different view.",
      });
    },
  );

  itReq(
    TOOL_CONTRACT_REQUIREMENT_IDS,
    "maps unknown planner tools to a safe failure result",
    async () => {
      const { handlers } = createHandlers({
        plannerResponse: JSON.stringify({
          kind: "execute",
          summary: "Run something unsafe",
          plannedCalls: [
            {
              callId: "call-1",
              toolName: "deleteEverything",
              rationale: "nope",
              input: {},
            },
          ],
        }),
      });
      const session = await handlers.createSession({ viewKind: "agentsList" }, 56);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      const submit = await handlers.submit(
        {
          sessionId: session.value.session.sessionId,
          userRequest: "Do the unsafe thing",
          context: validContext,
          response: null,
        },
        56,
      );

      expect(submit.ok).toBe(true);
      if (!submit.ok) {
        return;
      }

      expect(submit.value.result).toMatchObject({
        kind: "result",
        outcome: "failure",
        message: "Assistant planner returned an invalid structured response.",
      });
    },
  );

  itReq(
    ["R9.3", "R9.7", "R9.17", "A3", "D5"],
    "rejects planner terminal success and partial results so main owns final execution outcomes",
    async () => {
      for (const outcome of ["success", "partial"] as const) {
        const { handlers } = createHandlers({
          plannerResponse: JSON.stringify({
            kind: "result",
            outcome,
            summary: `planner said ${outcome}`,
          }),
        });
        const session = await handlers.createSession({ viewKind: "agentsList" }, 156);
        expect(session.ok).toBe(true);
        if (!session.ok) {
          return;
        }

        const submit = await handlers.submit(
          {
            sessionId: session.value.session.sessionId,
            userRequest: "Open the planning council",
            context: validContext,
            response: null,
          },
          156,
        );

        expect(submit.ok).toBe(true);
        if (!submit.ok) {
          return;
        }

        expect(submit.value.result).toMatchObject({
          kind: "result",
          outcome: "failure",
          message: "Assistant planner returned an invalid structured response.",
        });
      }
    },
  );

  itReq(FILE_REQUIREMENT_IDS, "cancels in-flight planning when the session closes", async () => {
    const { handlers } = createHandlers({
      plannerResponse: JSON.stringify({
        kind: "clarify",
        question: "Which agent should I open?",
      }),
      plannerDelayMs: 50,
    });
    const session = await handlers.createSession({ viewKind: "agentsList" }, 53);
    expect(session.ok).toBe(true);
    if (!session.ok) {
      return;
    }

    const submitPromise = handlers.submit(
      {
        sessionId: session.value.session.sessionId,
        userRequest: "Open the agent editor",
        context: validContext,
        response: null,
      },
      53,
    );

    const close = await handlers.closeSession({ sessionId: session.value.session.sessionId }, 53);
    expect(close.ok).toBe(true);
    if (close.ok) {
      expect(close.value.cancelledInFlightWork).toBe(true);
    }

    const submit = await submitPromise;
    expect(submit.ok).toBe(true);
    if (!submit.ok) {
      return;
    }
    expect(submit.value.result.kind).toBe("result");
    if (submit.value.result.kind === "result") {
      expect(submit.value.result.outcome).toBe("cancelled");
    }
  });

  itReq(
    ["R9.3", "R9.20", "R9.21", "A3", "D5"],
    "rejects a second concurrent submit for the same session",
    async () => {
      const { handlers } = createHandlers({
        plannerResponse: JSON.stringify({
          kind: "clarify",
          question: "Which agent should I open?",
        }),
        plannerDelayMs: 50,
      });
      const session = await handlers.createSession({ viewKind: "agentsList" }, 58);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      const submitRequest = {
        sessionId: session.value.session.sessionId,
        userRequest: "Open the agent editor",
        context: validContext,
        response: null,
      };

      const firstSubmitPromise = handlers.submit(submitRequest, 58);
      const secondSubmit = await handlers.submit(submitRequest, 58);

      expect(secondSubmit.ok).toBe(true);
      if (!secondSubmit.ok) {
        return;
      }

      expect(secondSubmit.value.result).toMatchObject({
        kind: "result",
        outcome: "failure",
        message: "Assistant is already working on this session.",
      });

      const firstSubmit = await firstSubmitPromise;
      expect(firstSubmit.ok).toBe(true);
      if (!firstSubmit.ok) {
        return;
      }

      expect(firstSubmit.value.result.kind).toBe("clarify");
    },
  );

  itReq(
    ["R9.20", "R9.21", "A3", "D5"],
    "keeps a stale cancelled submit from clearing newer in-flight work",
    async () => {
      const firstPlannerResponse = createDeferred<string>();
      const secondPlannerResponse = createDeferred<string>();
      const plannerResponses = [firstPlannerResponse, secondPlannerResponse] as const;
      let plannerCallCount = 0;
      const slice = createAssistantSlice({
        ...createAssistantSliceDeps(),
        createSessionId: () => "00000000-0000-4000-8000-000000000010",
        planAssistantResponse: (_request, _abortSignal) => {
          const deferred = plannerResponses[plannerCallCount];
          plannerCallCount += 1;

          if (deferred === undefined) {
            throw new Error("unexpected planner call");
          }

          return ResultAsync.fromPromise(deferred.promise, () => ({
            kind: "InternalError",
            devMessage: "planner failed",
            userMessage: "planner failed",
          }));
        },
      });

      const created = await slice.createSession({ webContentsId: 59, viewKind: "agentsList" });
      expect(created.isOk()).toBe(true);
      if (created.isErr()) {
        return;
      }

      const submitRequest = {
        sessionId: created.value.session.sessionId,
        userRequest: "Open the agent editor",
        context: validContext,
        response: null,
      };

      const firstSubmitPromise = slice.submitRequest({ webContentsId: 59, request: submitRequest });

      const cancel = await slice.cancelSession({
        sessionId: created.value.session.sessionId,
        webContentsId: 59,
      });
      expect(cancel.isOk()).toBe(true);
      if (cancel.isOk()) {
        expect(cancel.value.cancelled).toBe(true);
      }

      const secondSubmitPromise = slice.submitRequest({
        webContentsId: 59,
        request: submitRequest,
      });

      firstPlannerResponse.resolve(
        JSON.stringify({
          kind: "clarify",
          question: "Which agent should I open?",
        }),
      );

      const firstSubmit = await firstSubmitPromise;
      expect(firstSubmit.isOk()).toBe(true);
      if (firstSubmit.isOk()) {
        expect(firstSubmit.value.result).toMatchObject({
          kind: "result",
          outcome: "cancelled",
        });
      }

      const close = await slice.closeSession({
        sessionId: created.value.session.sessionId,
        webContentsId: 59,
      });
      expect(close.isOk()).toBe(true);
      if (close.isOk()) {
        expect(close.value.closed).toBe(true);
        expect(close.value.cancelledInFlightWork).toBe(true);
      }

      secondPlannerResponse.resolve(
        JSON.stringify({
          kind: "clarify",
          question: "Which agent should I open next?",
        }),
      );

      const secondSubmit = await secondSubmitPromise;
      expect(secondSubmit.isOk()).toBe(true);
      if (secondSubmit.isOk()) {
        expect(secondSubmit.value.result).toMatchObject({
          kind: "result",
          outcome: "cancelled",
        });
      }
    },
  );

  itReq(
    FILE_REQUIREMENT_IDS,
    "scopes cancel and close operations to the owning webcontents session",
    async () => {
      const { handlers } = createHandlers();
      const session = await handlers.createSession({ viewKind: "agentsList" }, 54);
      expect(session.ok).toBe(true);
      if (!session.ok) {
        return;
      }

      const cancel = await handlers.cancelSession(
        { sessionId: session.value.session.sessionId },
        999,
      );
      expect(cancel.ok).toBe(true);
      if (cancel.ok) {
        expect(cancel.value.cancelled).toBe(false);
      }

      const close = await handlers.closeSession(
        { sessionId: session.value.session.sessionId },
        999,
      );
      expect(close.ok).toBe(true);
      if (close.ok) {
        expect(close.value.closed).toBe(false);
        expect(close.value.cancelledInFlightWork).toBe(false);
      }

      const ownerClose = await handlers.closeSession(
        { sessionId: session.value.session.sessionId },
        54,
      );
      expect(ownerClose.ok).toBe(true);
      if (ownerClose.ok) {
        expect(ownerClose.value.closed).toBe(true);
      }

      const secondOwnerClose = await handlers.closeSession(
        { sessionId: session.value.session.sessionId },
        54,
      );
      expect(secondOwnerClose.ok).toBe(true);
      if (secondOwnerClose.ok) {
        expect(secondOwnerClose.value.closed).toBe(false);
        expect(secondOwnerClose.value.cancelledInFlightWork).toBe(false);
      }
    },
  );

  itReq(
    FILE_REQUIREMENT_IDS,
    "releases webcontents-owned sessions from in-memory state during teardown",
    async () => {
      const events: Array<Record<string, unknown>> = [];
      const slice = createAssistantSlice({
        ...createAssistantSliceDeps({ events }),
        createSessionId: () => "00000000-0000-4000-8000-000000000009",
      });

      const created = await slice.createSession({ webContentsId: 61, viewKind: "agentsList" });
      expect(created.isOk()).toBe(true);
      if (created.isErr()) {
        return;
      }

      slice.releaseWebContentsSessions(61);

      const closeAfterRelease = await slice.closeSession({
        sessionId: created.value.session.sessionId,
        webContentsId: 61,
      });

      expect(closeAfterRelease.isOk()).toBe(true);
      if (closeAfterRelease.isOk()) {
        expect(closeAfterRelease.value.closed).toBe(false);
        expect(closeAfterRelease.value.cancelledInFlightWork).toBe(false);
      }
    },
  );
});
