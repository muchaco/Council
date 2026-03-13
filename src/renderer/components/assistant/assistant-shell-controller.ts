import type {
  AssistantCompleteReconciliationResponse,
  AssistantContextEnvelope,
  AssistantCreateSessionResponse,
  AssistantExecutionSnapshot,
  AssistantPlanResult,
  AssistantSubmitRequest,
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
  finalizeAssistantPendingSessionRebase,
  rebaseAssistantForScopeChange,
  shouldApplyAssistantAsyncUpdate,
  shouldContinueAssistantPendingRequest,
} from "./assistant-ui-state";

type AssistantStateAction = AssistantUiState | ((current: AssistantUiState) => AssistantUiState);

type AssistantApi = Pick<
  WindowApi["assistant"],
  "cancelSession" | "closeSession" | "completeReconciliation" | "createSession" | "submit"
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
  applyPlanResultEffects: (result: AssistantPlanResult) => Promise<
    ReadonlyArray<{
      callId: string;
      toolName: string;
      status: "completed" | "failed";
      failureMessage: string | null;
      completion?: {
        output: Readonly<Record<string, unknown>> | null;
        userSummary: string | null;
      } | null;
    }>
  >;
  api: AssistantApi;
  getActiveAssistantContext: () => AssistantContextEnvelope;
  getActiveAssistantExecutionSnapshot: () => AssistantExecutionSnapshot | null;
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
}): AssistantUiState => {
  const finalizedState = finalizeAssistantPendingSessionRebase(params.state);

  return {
    ...finalizedState,
    messages: [
      ...finalizedState.messages,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: params.message,
        tone: "destructive",
      },
    ],
    phase: {
      destinationLabel: null,
      executionResults: [],
      plannedCalls: [],
      status: "failure",
      summary: params.message,
    },
  };
};

const isOk = <T>(result: IpcResult<T>): result is { ok: true; value: T } => result.ok;

export const createAssistantShellController = (deps: AssistantShellControllerDeps) => {
  const shouldHoldPendingRebaseSession = (params: {
    activeAssistantScopeKey: string;
    state: AssistantUiState;
  }): boolean => {
    const pendingSessionRebase = params.state.pendingSessionRebase;
    if (pendingSessionRebase === null) {
      return false;
    }

    return (
      params.activeAssistantScopeKey === pendingSessionRebase.sourceScopeKey ||
      params.activeAssistantScopeKey === pendingSessionRebase.destinationScopeKey
    );
  };

  const applyResultUpdate = async (params: {
    asyncToken: number;
    requestScopeKey: string;
    requestText: string;
    result: AssistantPlanResult;
    sessionId: string;
  }): Promise<void> => {
    const nextResult = params.result;

    if (
      !shouldApplyAssistantAsyncUpdate({
        asyncToken: params.asyncToken,
        requestScopeKey: params.requestScopeKey,
        sessionId: params.sessionId,
        state: deps.getCurrentAssistantState(),
      })
    ) {
      return;
    }

    deps.updateAssistantState((current) =>
      !shouldApplyAssistantAsyncUpdate({
        asyncToken: params.asyncToken,
        requestScopeKey: params.requestScopeKey,
        sessionId: params.sessionId,
        state: current,
      })
        ? current
        : applyAssistantPlanResult({
            requestText: params.requestText,
            result: nextResult,
            state: current,
          }),
    );
  };

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
      if (
        currentState.scopeKey === null ||
        currentState.scopeKey === activeAssistantScopeKey ||
        shouldHoldPendingRebaseSession({
          activeAssistantScopeKey,
          state: currentState,
        })
      ) {
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
      const normalizedResponse: AssistantSubmitRequest["response"] =
        params.response?.kind === "confirmation"
          ? currentState.phase.status === "confirm"
            ? {
                ...params.response,
                confirmationToken: currentState.phase.confirmationToken,
              }
            : null
          : params.response;

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
        executionSnapshot: deps.getActiveAssistantExecutionSnapshot(),
        response: normalizedResponse,
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

      if (result.value.result.kind === "execute") {
        const isCurrentReconciliationRequest = (): boolean =>
          shouldApplyAssistantAsyncUpdate({
            asyncToken,
            requestScopeKey,
            sessionId,
            state: deps.getCurrentAssistantState(),
          });

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

        const finalResult = await deps.api.submit({
          context: requestContext,
          executionSnapshot: deps.getActiveAssistantExecutionSnapshot(),
          response: null,
          sessionId,
          userRequest: initialRequest,
        });

        if (!isOk(finalResult)) {
          deps.pushErrorToast(finalResult.error.userMessage);
          deps.updateAssistantState((current) =>
            !shouldApplyAssistantAsyncUpdate({
              asyncToken,
              requestScopeKey,
              sessionId,
              state: current,
            })
              ? current
              : createAssistantFailureState({
                  message: finalResult.error.userMessage,
                  state: current,
                }),
          );
          return;
        }

        let resultToApply = finalResult.value.result;
        if (!isCurrentReconciliationRequest()) {
          return;
        }

        const reconciliations = await deps.applyPlanResultEffects(resultToApply);
        if (!isCurrentReconciliationRequest()) {
          return;
        }

        if (reconciliations.length > 0) {
          const shouldRecreateSessionForDestination =
            deps.getCurrentAssistantState().pendingSessionRebase?.sourceSessionId === sessionId;
          const completedReconciliation: IpcResult<AssistantCompleteReconciliationResponse> =
            await deps.api.completeReconciliation({
              sessionId,
              reconciliations: reconciliations.map((reconciliation) => ({
                ...reconciliation,
                completion: reconciliation.completion ?? null,
              })),
            });

          if (!isCurrentReconciliationRequest()) {
            return;
          }

          if (!isOk(completedReconciliation)) {
            deps.pushErrorToast(completedReconciliation.error.userMessage);
            deps.updateAssistantState((current) =>
              !shouldApplyAssistantAsyncUpdate({
                asyncToken,
                requestScopeKey,
                sessionId,
                state: current,
              })
                ? current
                : createAssistantFailureState({
                    message: completedReconciliation.error.userMessage,
                    state: current,
                  }),
            );
            return;
          }

          resultToApply = completedReconciliation.value.result;

          if (shouldRecreateSessionForDestination) {
            void deps.api.closeSession({ sessionId });
          }
        }

        await applyResultUpdate({
          asyncToken,
          requestScopeKey,
          requestText: initialRequest,
          result: resultToApply,
          sessionId,
        });
        return;
      }

      await applyResultUpdate({
        asyncToken,
        requestScopeKey,
        requestText: initialRequest,
        result: result.value.result,
        sessionId,
      });
    },
  };
};

export type AssistantShellController = ReturnType<typeof createAssistantShellController>;
export type { AssistantShellSubmitParams };
