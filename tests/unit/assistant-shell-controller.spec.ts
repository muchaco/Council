import { describe, expect, vi } from "vitest";

import { createAssistantShellController } from "../../src/renderer/components/assistant/assistant-shell-controller";
import {
  type AssistantUiState,
  createInitialAssistantUiState,
  openAssistantForScope,
  rebaseAssistantForScopeChange,
} from "../../src/renderer/components/assistant/assistant-ui-state";
import type {
  AssistantCompleteReconciliationResponse,
  AssistantContextEnvelope,
  AssistantCreateSessionResponse,
  AssistantSubmitResponse,
  IpcResult,
} from "../../src/shared/ipc/dto.js";
import { itReq } from "../helpers/requirement-trace";

const createDeferred = <T>() => {
  let resolvePromise: (value: T) => void = () => undefined;
  let rejectPromise: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    reject: rejectPromise,
    resolve: resolvePromise,
  };
};

const flushPromises = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const createAssistantContext = (
  viewKind: AssistantContextEnvelope["viewKind"],
): AssistantContextEnvelope => ({
  activeEntityId: null,
  contextLabel: "Home / Councils",
  draftState: null,
  listState: null,
  runtimeState: null,
  selectionIds: [],
  viewKind,
});

const createOkResult = <T>(value: T): IpcResult<T> => ({ ok: true, value });

const createSessionResponse = (
  viewKind: AssistantContextEnvelope["viewKind"],
): IpcResult<AssistantCreateSessionResponse> =>
  createOkResult({
    session: {
      createdAtUtc: "2026-03-12T00:00:00.000Z",
      lastUpdatedAtUtc: "2026-03-12T00:00:00.000Z",
      sessionId: "session-1",
      status: "open",
      viewKind,
    },
  });

const createSubmitResponse = (message: string): IpcResult<AssistantSubmitResponse> =>
  createOkResult({
    result: {
      destinationLabel: null,
      error: null,
      executionResults: [],
      kind: "result",
      message,
      outcome: "success",
      planSummary: message,
      plannedCalls: [],
      requiresUserAction: false,
      sessionId: "session-1",
    },
  });

const createHarness = (params?: {
  applyPlanResultEffects?: () => Promise<
    ReadonlyArray<{
      callId: string;
      toolName: string;
      status: "completed" | "failed";
      failureMessage: string | null;
    }>
  >;
  completeReconciliation?: () => Promise<IpcResult<AssistantCompleteReconciliationResponse>>;
  createSession?: () => Promise<IpcResult<AssistantCreateSessionResponse>>;
  rebaseCurrentStateToActiveScope?: boolean;
  submit?: () => Promise<IpcResult<AssistantSubmitResponse>>;
}) => {
  let activeScopeKey = "home:councils";
  let activeContext = createAssistantContext("councilsList");
  let state: AssistantUiState = openAssistantForScope({
    scopeKey: activeScopeKey,
    state: createInitialAssistantUiState(),
  });

  const closeSession = vi.fn(async () =>
    createOkResult({ cancelledInFlightWork: false, closed: true }),
  );
  const cancelSession = vi.fn(async () => createOkResult({ cancelled: true }));
  const createSession = vi.fn(
    params?.createSession ?? (async () => createSessionResponse(activeContext.viewKind)),
  );
  const completeReconciliation = vi.fn(
    params?.completeReconciliation ??
      (async () => createSubmitResponse("Finished assistant work.")),
  );
  const submit = vi.fn(
    params?.submit ?? (async () => createSubmitResponse("Finished assistant work.")),
  );
  const restoreLauncherFocus = vi.fn();
  const pushErrorToast = vi.fn();

  const getCurrentAssistantState = (): AssistantUiState =>
    params?.rebaseCurrentStateToActiveScope === false
      ? state
      : rebaseAssistantForScopeChange({ scopeKey: activeScopeKey, state });

  const updateAssistantState = (
    action: AssistantUiState | ((current: AssistantUiState) => AssistantUiState),
  ): AssistantUiState => {
    const currentState = getCurrentAssistantState();
    state = typeof action === "function" ? action(currentState) : action;
    return state;
  };

  const controller = createAssistantShellController({
    applyPlanResultEffects: params?.applyPlanResultEffects ?? (async () => []),
    api: {
      cancelSession,
      closeSession,
      completeReconciliation,
      createSession,
      submit,
    },
    getActiveAssistantContext: () => activeContext,
    getActiveAssistantScopeKey: () => activeScopeKey,
    getCurrentAssistantState,
    getStoredAssistantState: () => state,
    pushErrorToast,
    restoreLauncherFocus,
    updateAssistantState,
  });

  return {
    cancelSession,
    closeSession,
    completeReconciliation,
    controller,
    createSession,
    getState: (): AssistantUiState => state,
    pushErrorToast,
    restoreLauncherFocus,
    setActiveScope: (scopeKey: string, context: AssistantContextEnvelope): void => {
      activeScopeKey = scopeKey;
      activeContext = context;
    },
    submit,
    updateAssistantState,
  };
};

describe("assistant shell controller", () => {
  itReq(
    ["R9.17", "R9.21", "U18.12", "U18.13", "U18.14"],
    "keeps the modal cancelled when delayed session creation resolves after stop",
    async () => {
      const pendingCreateSession = createDeferred<IpcResult<AssistantCreateSessionResponse>>();
      const harness = createHarness({
        createSession: () => pendingCreateSession.promise,
      });

      harness.updateAssistantState((current) => ({
        ...current,
        inputValue: "Review this council",
      }));

      const submitPromise = harness.controller.submitAssistant({
        response: null,
        responseLabel: null,
        userMessageText: "Review this council",
      });
      await flushPromises();

      expect(harness.getState().phase.status).toBe("planning");

      await harness.controller.stopAssistant();
      expect(harness.getState().phase.status).toBe("cancelled");

      pendingCreateSession.resolve(createSessionResponse("councilsList"));

      await submitPromise;

      expect(harness.getState().phase.status).toBe("cancelled");
      expect(harness.getState().sessionId).toBeNull();
      expect(harness.submit).not.toHaveBeenCalled();
      expect(harness.closeSession).toHaveBeenCalledWith({ sessionId: "session-1" });
    },
  );

  itReq(
    ["R9.17", "R9.21", "U18.12", "U18.13", "U18.14"],
    "keeps the modal closed when delayed session creation resolves after close",
    async () => {
      const pendingCreateSession = createDeferred<IpcResult<AssistantCreateSessionResponse>>();
      const harness = createHarness({
        createSession: () => pendingCreateSession.promise,
      });

      harness.updateAssistantState((current) => ({
        ...current,
        inputValue: "Review this council",
      }));

      const submitPromise = harness.controller.submitAssistant({
        response: null,
        responseLabel: null,
        userMessageText: "Review this council",
      });
      await flushPromises();

      await harness.controller.closeAssistantSession();
      expect(harness.getState().isOpen).toBe(false);

      pendingCreateSession.resolve(createSessionResponse("councilsList"));

      await submitPromise;

      expect(harness.getState().isOpen).toBe(false);
      expect(harness.getState().messages).toHaveLength(0);
      expect(harness.getState().sessionId).toBeNull();
      expect(harness.submit).not.toHaveBeenCalled();
      expect(harness.restoreLauncherFocus).toHaveBeenCalledTimes(1);
      expect(harness.closeSession).toHaveBeenCalledWith({ sessionId: "session-1" });
    },
  );

  itReq(
    ["R9.17", "R9.21", "U18.12", "U18.14"],
    "keeps a rebased modal idle when delayed submit results resolve for the previous scope",
    async () => {
      const pendingSubmit = createDeferred<IpcResult<AssistantSubmitResponse>>();
      const harness = createHarness({
        submit: () => pendingSubmit.promise,
      });

      harness.updateAssistantState((current) => ({
        ...current,
        inputValue: "Review this council",
      }));

      const submitPromise = harness.controller.submitAssistant({
        response: null,
        responseLabel: null,
        userMessageText: "Review this council",
      });
      await flushPromises();

      expect(harness.submit).toHaveBeenCalledTimes(1);

      harness.setActiveScope("agentEditor:new", createAssistantContext("agentEdit"));
      await harness.controller.rebaseToActiveScope();

      expect(harness.getState().scopeKey).toBe("agentEditor:new");
      expect(harness.getState().phase.status).toBe("idle");
      expect(harness.getState().messages).toHaveLength(0);

      pendingSubmit.resolve(createSubmitResponse("Opened Quarterly Council."));

      await submitPromise;

      expect(harness.getState().scopeKey).toBe("agentEditor:new");
      expect(harness.getState().phase.status).toBe("idle");
      expect(harness.getState().messages).toHaveLength(0);
      expect(harness.closeSession).toHaveBeenCalledWith({ sessionId: "session-1" });
    },
  );

  itReq(
    ["R9.17", "R9.18", "R9.21", "U18.10", "U18.11"],
    "keeps the source session open while navigation reconciliation is still rebasing the modal",
    async () => {
      const harness = createHarness({ rebaseCurrentStateToActiveScope: false });

      harness.updateAssistantState((current) => ({
        ...current,
        pendingSessionRebase: {
          destinationScopeKey: "councilView:00000000-0000-4000-8000-000000000010",
          destinationViewKind: "councilView",
          sourceScopeKey: "home:councils",
          sourceSessionId: "session-1",
        },
        scopeKey: "home:councils",
        sessionId: "session-1",
        sessionViewKind: "councilsList",
      }));
      harness.setActiveScope(
        "councilView:00000000-0000-4000-8000-000000000010",
        createAssistantContext("councilView"),
      );

      await harness.controller.rebaseToActiveScope();

      expect(harness.closeSession).not.toHaveBeenCalled();
      expect(harness.getState().sessionId).toBe("session-1");
      expect(harness.getState().pendingSessionRebase).toMatchObject({
        destinationScopeKey: "councilView:00000000-0000-4000-8000-000000000010",
        sourceSessionId: "session-1",
      });
    },
  );

  itReq(
    ["R9.7", "R9.17", "R9.18", "U18.7", "U18.10", "U18.11"],
    "auto-continues execute plans and finalizes navigation after reconciliation acknowledgement",
    async () => {
      const submit = vi
        .fn<() => Promise<IpcResult<AssistantSubmitResponse>>>()
        .mockResolvedValueOnce(
          createOkResult({
            result: {
              kind: "execute",
              message: "Open Quarterly Council.",
              planSummary: "Open Quarterly Council.",
              plannedCalls: [
                {
                  callId: "call-1",
                  input: {
                    councilId: "00000000-0000-4000-8000-000000000010",
                  },
                  rationale: "Open the requested council.",
                  toolName: "openCouncilView",
                },
              ],
              sessionId: "session-1",
            },
          }),
        )
        .mockResolvedValueOnce(
          createOkResult({
            result: {
              destinationLabel: "Quarterly Council",
              error: null,
              executionResults: [
                {
                  callId: "call-1",
                  output: {
                    councilId: "00000000-0000-4000-8000-000000000010",
                    councilTitle: "Quarterly Council",
                  },
                  reconciliationState: "follow-up-refresh-in-progress",
                  status: "reconciling",
                  toolName: "openCouncilView",
                  userSummary: "Opened council view for Quarterly Council.",
                },
              ],
              kind: "result",
              message: "Waiting for 1 navigation step to finish loading visibly.",
              outcome: "partial",
              planSummary: null,
              plannedCalls: [],
              requiresUserAction: false,
              sessionId: "session-1",
            },
          }),
        );
      const completeReconciliation = vi
        .fn<() => Promise<IpcResult<AssistantCompleteReconciliationResponse>>>()
        .mockResolvedValue(
          createOkResult({
            result: {
              destinationLabel: "Quarterly Council",
              error: null,
              executionResults: [
                {
                  callId: "call-1",
                  output: {
                    councilId: "00000000-0000-4000-8000-000000000010",
                    councilTitle: "Quarterly Council",
                  },
                  reconciliationState: "completed",
                  status: "success",
                  toolName: "openCouncilView",
                  userSummary: "Opened council view for Quarterly Council.",
                },
              ],
              kind: "result",
              message: "Opened council view for Quarterly Council.",
              outcome: "success",
              planSummary: null,
              plannedCalls: [],
              requiresUserAction: false,
              sessionId: "session-1",
            },
          }),
        );
      const applyPlanResultEffects = vi.fn().mockResolvedValue([
        {
          callId: "call-1",
          toolName: "openCouncilView",
          status: "completed",
          failureMessage: null,
        },
      ]);
      const harness = createHarness({
        applyPlanResultEffects,
        completeReconciliation,
        submit,
      });

      harness.updateAssistantState((current) => ({
        ...current,
        inputValue: "Open Quarterly Council",
      }));

      await harness.controller.submitAssistant({
        response: null,
        responseLabel: null,
        userMessageText: "Open Quarterly Council",
      });

      expect(submit).toHaveBeenCalledTimes(2);
      expect(completeReconciliation).toHaveBeenCalledWith({
        sessionId: "session-1",
        reconciliations: [
          {
            callId: "call-1",
            toolName: "openCouncilView",
            status: "completed",
            failureMessage: null,
          },
        ],
      });
      expect(harness.getState().phase.status).toBe("success");
      const finalPhase = harness.getState().phase;
      if (finalPhase.status !== "success") {
        return;
      }
      expect(finalPhase.executionResults).toHaveLength(1);
      expect(harness.getState().messages.at(-1)?.text).toBe(
        "Opened council view for Quarterly Council.",
      );
    },
  );

  itReq(
    ["R9.17", "R9.21", "U18.12", "U18.13", "U18.14"],
    "keeps the modal cancelled when reconciliation effects resolve after stop",
    async () => {
      const pendingReconciliations =
        createDeferred<
          ReadonlyArray<{
            callId: string;
            toolName: string;
            status: "completed" | "failed";
            failureMessage: string | null;
          }>
        >();
      const submit = vi
        .fn<() => Promise<IpcResult<AssistantSubmitResponse>>>()
        .mockResolvedValueOnce(
          createOkResult({
            result: {
              kind: "execute",
              message: "Open Quarterly Council.",
              planSummary: "Open Quarterly Council.",
              plannedCalls: [
                {
                  callId: "call-1",
                  input: {
                    councilId: "00000000-0000-4000-8000-000000000010",
                  },
                  rationale: "Open the requested council.",
                  toolName: "openCouncilView",
                },
              ],
              sessionId: "session-1",
            },
          }),
        )
        .mockResolvedValueOnce(
          createOkResult({
            result: {
              destinationLabel: "Quarterly Council",
              error: null,
              executionResults: [
                {
                  callId: "call-1",
                  output: {
                    councilId: "00000000-0000-4000-8000-000000000010",
                    councilTitle: "Quarterly Council",
                  },
                  reconciliationState: "follow-up-refresh-in-progress",
                  status: "reconciling",
                  toolName: "openCouncilView",
                  userSummary: "Opened council view for Quarterly Council.",
                },
              ],
              kind: "result",
              message: "Waiting for 1 navigation step to finish loading visibly.",
              outcome: "partial",
              planSummary: null,
              plannedCalls: [],
              requiresUserAction: false,
              sessionId: "session-1",
            },
          }),
        );
      const completeReconciliation = vi
        .fn<() => Promise<IpcResult<AssistantCompleteReconciliationResponse>>>()
        .mockResolvedValue(
          createOkResult({
            result: {
              destinationLabel: "Quarterly Council",
              error: null,
              executionResults: [],
              kind: "result",
              message: "Opened council view for Quarterly Council.",
              outcome: "success",
              planSummary: null,
              plannedCalls: [],
              requiresUserAction: false,
              sessionId: "session-1",
            },
          }),
        );
      const harness = createHarness({
        applyPlanResultEffects: () => pendingReconciliations.promise,
        completeReconciliation,
        submit,
      });

      harness.updateAssistantState((current) => ({
        ...current,
        inputValue: "Open Quarterly Council",
      }));

      const submitPromise = harness.controller.submitAssistant({
        response: null,
        responseLabel: null,
        userMessageText: "Open Quarterly Council",
      });
      await flushPromises();

      await harness.controller.stopAssistant();
      pendingReconciliations.resolve([
        {
          callId: "call-1",
          toolName: "openCouncilView",
          status: "completed",
          failureMessage: null,
        },
      ]);

      await submitPromise;

      expect(completeReconciliation).not.toHaveBeenCalled();
      expect(harness.getState().phase.status).toBe("cancelled");
      expect(harness.getState().messages.at(-1)?.text).toBe(
        "Stopped the current assistant request.",
      );
    },
  );

  itReq(
    ["R9.17", "R9.21", "U18.12", "U18.14"],
    "keeps a rebased modal idle when reconciliation effects resolve for the previous scope",
    async () => {
      const pendingReconciliations =
        createDeferred<
          ReadonlyArray<{
            callId: string;
            toolName: string;
            status: "completed" | "failed";
            failureMessage: string | null;
          }>
        >();
      const submit = vi
        .fn<() => Promise<IpcResult<AssistantSubmitResponse>>>()
        .mockResolvedValueOnce(
          createOkResult({
            result: {
              kind: "execute",
              message: "Open Quarterly Council.",
              planSummary: "Open Quarterly Council.",
              plannedCalls: [
                {
                  callId: "call-1",
                  input: {
                    councilId: "00000000-0000-4000-8000-000000000010",
                  },
                  rationale: "Open the requested council.",
                  toolName: "openCouncilView",
                },
              ],
              sessionId: "session-1",
            },
          }),
        )
        .mockResolvedValueOnce(
          createOkResult({
            result: {
              destinationLabel: "Quarterly Council",
              error: null,
              executionResults: [
                {
                  callId: "call-1",
                  output: {
                    councilId: "00000000-0000-4000-8000-000000000010",
                    councilTitle: "Quarterly Council",
                  },
                  reconciliationState: "follow-up-refresh-in-progress",
                  status: "reconciling",
                  toolName: "openCouncilView",
                  userSummary: "Opened council view for Quarterly Council.",
                },
              ],
              kind: "result",
              message: "Waiting for 1 navigation step to finish loading visibly.",
              outcome: "partial",
              planSummary: null,
              plannedCalls: [],
              requiresUserAction: false,
              sessionId: "session-1",
            },
          }),
        );
      const completeReconciliation = vi
        .fn<() => Promise<IpcResult<AssistantCompleteReconciliationResponse>>>()
        .mockResolvedValue(
          createOkResult({
            result: {
              destinationLabel: "Quarterly Council",
              error: null,
              executionResults: [],
              kind: "result",
              message: "Opened council view for Quarterly Council.",
              outcome: "success",
              planSummary: null,
              plannedCalls: [],
              requiresUserAction: false,
              sessionId: "session-1",
            },
          }),
        );
      const harness = createHarness({
        applyPlanResultEffects: () => pendingReconciliations.promise,
        completeReconciliation,
        submit,
      });

      harness.updateAssistantState((current) => ({
        ...current,
        inputValue: "Open Quarterly Council",
      }));

      const submitPromise = harness.controller.submitAssistant({
        response: null,
        responseLabel: null,
        userMessageText: "Open Quarterly Council",
      });
      await flushPromises();

      harness.setActiveScope("agentEditor:new", createAssistantContext("agentEdit"));
      await harness.controller.rebaseToActiveScope();
      pendingReconciliations.resolve([
        {
          callId: "call-1",
          toolName: "openCouncilView",
          status: "completed",
          failureMessage: null,
        },
      ]);

      await submitPromise;

      expect(completeReconciliation).not.toHaveBeenCalled();
      expect(harness.getState().scopeKey).toBe("agentEditor:new");
      expect(harness.getState().phase.status).toBe("idle");
      expect(harness.getState().messages).toHaveLength(0);
      expect(harness.closeSession).toHaveBeenCalledWith({ sessionId: "session-1" });
    },
  );

  itReq(
    ["R9.17", "R9.18", "R9.21", "U18.7", "U18.10", "U18.11"],
    "recreates the assistant session after navigation rebases the scope during reconciliation",
    async () => {
      const harnessRef: { current: ReturnType<typeof createHarness> | null } = { current: null };
      const submit = vi
        .fn<() => Promise<IpcResult<AssistantSubmitResponse>>>()
        .mockResolvedValueOnce(
          createOkResult({
            result: {
              kind: "execute",
              message: "Open Quarterly Council.",
              planSummary: "Open Quarterly Council.",
              plannedCalls: [
                {
                  callId: "call-1",
                  input: {
                    councilId: "00000000-0000-4000-8000-000000000010",
                  },
                  rationale: "Open the requested council.",
                  toolName: "openCouncilView",
                },
              ],
              sessionId: "session-1",
            },
          }),
        )
        .mockResolvedValueOnce(
          createOkResult({
            result: {
              destinationLabel: "Quarterly Council",
              error: null,
              executionResults: [
                {
                  callId: "call-1",
                  output: {
                    councilId: "00000000-0000-4000-8000-000000000010",
                    councilTitle: "Quarterly Council",
                  },
                  reconciliationState: "follow-up-refresh-in-progress",
                  status: "reconciling",
                  toolName: "openCouncilView",
                  userSummary: "Opened council view for Quarterly Council.",
                },
              ],
              kind: "result",
              message: "Waiting for 1 navigation step to finish loading visibly.",
              outcome: "partial",
              planSummary: null,
              plannedCalls: [],
              requiresUserAction: false,
              sessionId: "session-1",
            },
          }),
        )
        .mockResolvedValueOnce(
          createOkResult({
            result: {
              destinationLabel: null,
              error: null,
              executionResults: [],
              kind: "result",
              message: "Reviewed the council runtime.",
              outcome: "success",
              planSummary: null,
              plannedCalls: [],
              requiresUserAction: false,
              sessionId: "session-2",
            },
          }),
        );
      const createSession = vi
        .fn<() => Promise<IpcResult<AssistantCreateSessionResponse>>>()
        .mockResolvedValueOnce(createSessionResponse("councilsList"))
        .mockResolvedValueOnce(
          createOkResult({
            session: {
              createdAtUtc: "2026-03-12T00:00:10.000Z",
              lastUpdatedAtUtc: "2026-03-12T00:00:10.000Z",
              sessionId: "session-2",
              status: "open",
              viewKind: "councilView",
            },
          }),
        );
      const completeReconciliation = vi
        .fn<() => Promise<IpcResult<AssistantCompleteReconciliationResponse>>>()
        .mockResolvedValue(
          createOkResult({
            result: {
              destinationLabel: "Quarterly Council",
              error: null,
              executionResults: [
                {
                  callId: "call-1",
                  output: {
                    councilId: "00000000-0000-4000-8000-000000000010",
                    councilTitle: "Quarterly Council",
                  },
                  reconciliationState: "completed",
                  status: "success",
                  toolName: "openCouncilView",
                  userSummary: "Opened council view for Quarterly Council.",
                },
              ],
              kind: "result",
              message: "Opened council view for Quarterly Council.",
              outcome: "success",
              planSummary: null,
              plannedCalls: [],
              requiresUserAction: false,
              sessionId: "session-1",
            },
          }),
        );
      const applyPlanResultEffects = vi.fn(async () => {
        harnessRef.current?.setActiveScope(
          "councilView:00000000-0000-4000-8000-000000000010",
          createAssistantContext("councilView"),
        );
        harnessRef.current?.updateAssistantState((current) => ({
          ...current,
          pendingSessionRebase: {
            destinationScopeKey: "councilView:00000000-0000-4000-8000-000000000010",
            destinationViewKind: "councilView",
            sourceScopeKey: "home:councils",
            sourceSessionId: "session-1",
          },
          scopeKey: "councilView:00000000-0000-4000-8000-000000000010",
          sessionViewKind: "councilView",
        }));

        return [
          {
            callId: "call-1",
            toolName: "openCouncilView",
            status: "completed" as const,
            failureMessage: null,
          },
        ];
      });

      const harness = createHarness({
        applyPlanResultEffects,
        completeReconciliation,
        createSession,
        rebaseCurrentStateToActiveScope: false,
        submit,
      });
      harnessRef.current = harness;

      harness.updateAssistantState((current) => ({
        ...current,
        inputValue: "Open Quarterly Council",
      }));

      await harness.controller.submitAssistant({
        response: null,
        responseLabel: null,
        userMessageText: "Open Quarterly Council",
      });

      expect(harness.getState().phase.status).toBe("success");
      expect(harness.getState().scopeKey).toBe("councilView:00000000-0000-4000-8000-000000000010");
      expect(harness.getState().sessionViewKind).toBe("councilView");
      expect(harness.getState().sessionId).toBeNull();

      harness.updateAssistantState((current) => ({
        ...current,
        inputValue: "What is the runtime status of this council?",
      }));

      await harness.controller.submitAssistant({
        response: null,
        responseLabel: null,
        userMessageText: "What is the runtime status of this council?",
      });

      expect(createSession).toHaveBeenNthCalledWith(2, { viewKind: "councilView" });
      expect(submit).toHaveBeenLastCalledWith({
        context: createAssistantContext("councilView"),
        response: null,
        sessionId: "session-2",
        userRequest: "What is the runtime status of this council?",
      });
      expect(harness.closeSession).toHaveBeenCalledWith({ sessionId: "session-1" });
      expect(harness.getState().sessionId).toBe("session-2");
    },
  );

  itReq(
    ["R9.17", "R9.18", "R9.22", "U18.8", "U18.10", "U18.11"],
    "keeps the modal in failure when reconciliation completion fails",
    async () => {
      const submit = vi
        .fn<() => Promise<IpcResult<AssistantSubmitResponse>>>()
        .mockResolvedValueOnce(
          createOkResult({
            result: {
              kind: "execute",
              message: "Open Quarterly Council.",
              planSummary: "Open Quarterly Council.",
              plannedCalls: [
                {
                  callId: "call-1",
                  input: {
                    councilId: "00000000-0000-4000-8000-000000000010",
                  },
                  rationale: "Open the requested council.",
                  toolName: "openCouncilView",
                },
              ],
              sessionId: "session-1",
            },
          }),
        )
        .mockResolvedValueOnce(
          createOkResult({
            result: {
              destinationLabel: "Quarterly Council",
              error: null,
              executionResults: [
                {
                  callId: "call-1",
                  output: {
                    councilId: "00000000-0000-4000-8000-000000000010",
                    councilTitle: "Quarterly Council",
                  },
                  reconciliationState: "follow-up-refresh-in-progress",
                  status: "reconciling",
                  toolName: "openCouncilView",
                  userSummary: "Opened council view for Quarterly Council.",
                },
              ],
              kind: "result",
              message: "Waiting for 1 navigation step to finish loading visibly.",
              outcome: "partial",
              planSummary: null,
              plannedCalls: [],
              requiresUserAction: false,
              sessionId: "session-1",
            },
          }),
        );
      const harness = createHarness({
        applyPlanResultEffects: async () => [
          {
            callId: "call-1",
            toolName: "openCouncilView",
            status: "failed",
            failureMessage: "The requested council view never became visible.",
          },
        ],
        completeReconciliation: async () => ({
          ok: false,
          error: {
            kind: "StateViolationError",
            userMessage: "The requested council view never became visible.",
            devMessage: "Redacted",
          },
        }),
        submit,
      });

      harness.updateAssistantState((current) => ({
        ...current,
        inputValue: "Open Quarterly Council",
      }));

      await harness.controller.submitAssistant({
        response: null,
        responseLabel: null,
        userMessageText: "Open Quarterly Council",
      });

      expect(harness.getState().phase.status).toBe("failure");
      expect(harness.getState().messages.at(-1)?.text).toBe(
        "The requested council view never became visible.",
      );
    },
  );
});
