import { ResultAsync, okAsync } from "neverthrow";
import { describe, expect } from "vitest";
import { createAssistantIpcHandlers } from "../../src/main/features/assistant/ipc-handlers";
import { createAssistantSlice } from "../../src/main/features/assistant/slice";
import { createAssistantAuditService } from "../../src/main/services/assistant/assistant-audit-service";
import { itReq } from "../helpers/requirement-trace";

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
  plannerResponse?: string;
  plannerDelayMs?: number;
  onPlannerRequest?: (request: { userRequest: string }) => void;
  onGetSettingsView?: (request: { viewKind: string }) => void;
}) => {
  const events: Array<Record<string, unknown>> = [];
  const slice = createAssistantSlice({
    nowUtc: () => "2026-03-12T12:00:00.000Z",
    createSessionId: () => "00000000-0000-4000-8000-000000000001",
    getSettingsView: ({ viewKind }) => {
      options?.onGetSettingsView?.({ viewKind });
      return okAsync({
        providers: [],
        globalDefaultModelRef: {
          providerId: "gemini",
          modelId: "gemini-1.5-flash",
        },
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
    auditService: createAssistantAuditService({
      info: () => {},
      error: () => {},
      logWideEvent: (entry) => events.push(entry),
    }),
    planAssistantResponse:
      options?.plannerResponse === undefined
        ? undefined
        : (request, abortSignal) =>
            ResultAsync.fromPromise(
              new Promise<string>((resolve, reject) => {
                options.onPlannerRequest?.({ userRequest: request.userRequest });
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
                kind: "InternalError",
                devMessage: "planner aborted",
                userMessage: "planner aborted",
              }),
            ),
  });

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
    FLOW_AND_TOOL_CONTRACT_REQUIREMENT_IDS,
    "sanitizes assistant submit text and planner calls across ipc",
    async () => {
      const plannerRequests: Array<{ userRequest: string }> = [];
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
      const plannerRequests: Array<{ userRequest: string }> = [];
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
        nowUtc: () => "2026-03-12T12:00:00.000Z",
        createSessionId: () => "00000000-0000-4000-8000-000000000010",
        getSettingsView: () =>
          okAsync({
            providers: [],
            globalDefaultModelRef: {
              providerId: "gemini",
              modelId: "gemini-1.5-flash",
            },
            globalDefaultModelInvalidConfig: false,
            contextLastN: 24,
            modelCatalog: {
              snapshotId: "agentsList-snapshot-1",
              modelsByProvider: {
                gemini: ["gemini-1.5-flash"],
              },
            },
            canRefreshModels: true,
          }),
        auditService: createAssistantAuditService({
          info: () => {},
          error: () => {},
          logWideEvent: () => {},
        }),
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
        nowUtc: () => "2026-03-12T12:00:00.000Z",
        createSessionId: () => "00000000-0000-4000-8000-000000000009",
        getSettingsView: () =>
          okAsync({
            providers: [],
            globalDefaultModelRef: {
              providerId: "gemini",
              modelId: "gemini-1.5-flash",
            },
            globalDefaultModelInvalidConfig: false,
            contextLastN: 24,
            modelCatalog: {
              snapshotId: "agentsList-snapshot-1",
              modelsByProvider: {
                gemini: ["gemini-1.5-flash"],
              },
            },
            canRefreshModels: true,
          }),
        auditService: createAssistantAuditService({
          info: () => {},
          error: () => {},
          logWideEvent: (entry) => events.push(entry),
        }),
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
