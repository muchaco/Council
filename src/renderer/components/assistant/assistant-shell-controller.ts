import type {
  AssistantContextEnvelope,
  AssistantCreateSessionResponse,
  AssistantSubmitResponse,
  IpcResult,
} from "../../../shared/ipc/dto.js";
import type { WindowApi } from "../../../shared/ipc/window-api.js";
import {
  type AssistantUiState,
  applyAssistantPlanResult,
  applyAssistantStopResult,
  beginAssistantPlanning,
  closeAssistantUi,
  rebaseAssistantForScopeChange,
  shouldApplyAssistantAsyncUpdate,
  shouldContinueAssistantPendingRequest,
} from "./assistant-ui-state";

type AssistantStateAction = AssistantUiState | ((current: AssistantUiState) => AssistantUiState);

type AssistantApi = Pick<
  WindowApi["assistant"],
  "cancelSession" | "closeSession" | "createSession" | "submit"
>;

type AssistantShellSubmitParams = {
  response:
    | {
        approved: boolean;
        kind: "confirmation";
      }
    | {
        kind: "clarification";
        text: string;
      }
    | null;
  responseLabel: string | null;
  userMessageText: string | null;
};

type AssistantShellControllerDeps = {
  api: AssistantApi;
  getActiveAssistantContext: () => AssistantContextEnvelope;
  getActiveAssistantScopeKey: () => string;
  getCurrentAssistantState: () => AssistantUiState;
  getStoredAssistantState: () => AssistantUiState;
  pushErrorToast: (message: string) => void;
  restoreLauncherFocus: () => void;
  updateAssistantState: (action: AssistantStateAction) => AssistantUiState;
};

const createAssistantFailureState = (params: {
  message: string;
  state: AssistantUiState;
}): AssistantUiState => ({
  ...params.state,
  messages: [
    ...params.state.messages,
    {
      id: crypto.randomUUID(),
      role: "assistant",
      text: params.message,
      tone: "destructive",
    },
  ],
  phase: {
    destinationLabel: null,
    plannedCalls: [],
    status: "failure",
    summary: params.message,
  },
});

const isOk = <T>(result: IpcResult<T>): result is { ok: true; value: T } => result.ok;

export const createAssistantShellController = (deps: AssistantShellControllerDeps) => {
  const ensureAssistantSession = async (params: {
    asyncToken: number;
    requestScopeKey: string;
    viewKind: AssistantContextEnvelope["viewKind"];
  }): Promise<string | null> => {
    const isRequestCurrent = (): boolean =>
      shouldContinueAssistantPendingRequest({
        asyncToken: params.asyncToken,
        requestScopeKey: params.requestScopeKey,
        state: deps.getCurrentAssistantState(),
      });

    const currentState = deps.getCurrentAssistantState();
    if (!isRequestCurrent()) {
      return null;
    }

    if (
      currentState.sessionId !== null &&
      currentState.scopeKey === params.requestScopeKey &&
      currentState.sessionViewKind === params.viewKind
    ) {
      return currentState.sessionId;
    }

    if (currentState.sessionId !== null) {
      await deps.api.closeSession({ sessionId: currentState.sessionId });
    }

    if (!isRequestCurrent()) {
      return null;
    }

    const created = await deps.api.createSession({
      viewKind: params.viewKind,
    });
    if (!isOk(created)) {
      if (!isRequestCurrent()) {
        return null;
      }

      deps.pushErrorToast(created.error.userMessage);
      deps.updateAssistantState((current) =>
        createAssistantFailureState({
          message: created.error.userMessage,
          state: current,
        }),
      );
      return null;
    }

    if (!isRequestCurrent()) {
      await deps.api.closeSession({ sessionId: created.value.session.sessionId });
      return null;
    }

    deps.updateAssistantState((current) => ({
      ...current,
      scopeKey: params.requestScopeKey,
      sessionId: created.value.session.sessionId,
      sessionViewKind: created.value.session.viewKind,
    }));
    return created.value.session.sessionId;
  };

  return {
    async closeAssistantSession(): Promise<void> {
      const currentState = deps.getCurrentAssistantState();
      const sessionId = currentState.sessionId;

      deps.updateAssistantState(closeAssistantUi(currentState));
      deps.restoreLauncherFocus();

      if (sessionId !== null) {
        await deps.api.closeSession({ sessionId });
      }
    },

    async rebaseToActiveScope(): Promise<void> {
      const currentState = deps.getStoredAssistantState();
      const activeAssistantScopeKey = deps.getActiveAssistantScopeKey();
      if (currentState.scopeKey === null || currentState.scopeKey === activeAssistantScopeKey) {
        return;
      }

      const sessionId = currentState.sessionId;
      deps.updateAssistantState(
        rebaseAssistantForScopeChange({
          scopeKey: activeAssistantScopeKey,
          state: currentState,
        }),
      );

      if (sessionId !== null) {
        await deps.api.closeSession({ sessionId });
      }
    },

    async stopAssistant(): Promise<void> {
      const currentState = deps.getCurrentAssistantState();
      if (currentState.scopeKey === null) {
        return;
      }

      const { asyncToken, scopeKey, sessionId } = currentState;

      deps.updateAssistantState((current) =>
        applyAssistantStopResult({
          asyncToken,
          requestScopeKey: scopeKey,
          sessionId,
          state: current,
        }),
      );

      if (sessionId !== null) {
        await deps.api.cancelSession({ sessionId });
      }
    },

    async submitAssistant(params: AssistantShellSubmitParams): Promise<void> {
      const currentState = deps.getCurrentAssistantState();
      const requestContext = deps.getActiveAssistantContext();
      const requestScopeKey = deps.getActiveAssistantScopeKey();
      const asyncToken = currentState.asyncToken + 1;
      const initialRequest =
        currentState.phase.status === "clarify" || currentState.phase.status === "confirm"
          ? currentState.activeRequestText
          : currentState.inputValue.trim();

      if (initialRequest === null || initialRequest.length === 0) {
        return;
      }

      deps.updateAssistantState((current) =>
        current.scopeKey !== requestScopeKey
          ? current
          : beginAssistantPlanning({
              requestText: initialRequest,
              responseLabel: params.responseLabel,
              state: current,
              userMessageText: params.userMessageText,
            }),
      );

      const sessionId = await ensureAssistantSession({
        asyncToken,
        requestScopeKey,
        viewKind: requestContext.viewKind,
      });
      if (sessionId === null) {
        return;
      }

      if (
        !shouldApplyAssistantAsyncUpdate({
          asyncToken,
          requestScopeKey,
          sessionId,
          state: deps.getCurrentAssistantState(),
        })
      ) {
        return;
      }

      const result = await deps.api.submit({
        context: requestContext,
        response: params.response,
        sessionId,
        userRequest: initialRequest,
      });

      if (
        !shouldApplyAssistantAsyncUpdate({
          asyncToken,
          requestScopeKey,
          sessionId,
          state: deps.getCurrentAssistantState(),
        })
      ) {
        return;
      }

      if (!isOk(result)) {
        deps.pushErrorToast(result.error.userMessage);
        deps.updateAssistantState((current) =>
          !shouldApplyAssistantAsyncUpdate({
            asyncToken,
            requestScopeKey,
            sessionId,
            state: current,
          })
            ? current
            : createAssistantFailureState({
                message: result.error.userMessage,
                state: current,
              }),
        );
        return;
      }

      deps.updateAssistantState((current) =>
        !shouldApplyAssistantAsyncUpdate({
          asyncToken,
          requestScopeKey,
          sessionId,
          state: current,
        })
          ? current
          : applyAssistantPlanResult({
              requestText: initialRequest,
              result: result.value.result,
              state: current,
            }),
      );
    },
  };
};

export type AssistantShellController = ReturnType<typeof createAssistantShellController>;
export type { AssistantShellSubmitParams };
