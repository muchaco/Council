import { describe, expect, vi } from "vitest";

import { createAssistantShellController } from "../../src/renderer/components/assistant/assistant-shell-controller";
import {
  type AssistantUiState,
  createInitialAssistantUiState,
  openAssistantForScope,
  rebaseAssistantForScopeChange,
} from "../../src/renderer/components/assistant/assistant-ui-state";
import type {
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
  createSession?: () => Promise<IpcResult<AssistantCreateSessionResponse>>;
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
  const submit = vi.fn(
    params?.submit ?? (async () => createSubmitResponse("Finished assistant work.")),
  );
  const restoreLauncherFocus = vi.fn();
  const pushErrorToast = vi.fn();

  const getCurrentAssistantState = (): AssistantUiState =>
    rebaseAssistantForScopeChange({ scopeKey: activeScopeKey, state });

  const updateAssistantState = (
    action: AssistantUiState | ((current: AssistantUiState) => AssistantUiState),
  ): AssistantUiState => {
    const currentState = getCurrentAssistantState();
    state = typeof action === "function" ? action(currentState) : action;
    return state;
  };

  const controller = createAssistantShellController({
    api: {
      cancelSession,
      closeSession,
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
});
