import type {
  AssistantConfirmationRequest,
  AssistantPlanResult,
  AssistantPlannedToolCall,
  AssistantToolExecutionResult,
  ViewKind,
} from "../../../shared/ipc/dto.js";

export type AssistantConversationMessage = {
  id: string;
  role: "assistant" | "system" | "user";
  text: string;
  tone: "default" | "destructive" | "muted" | "success";
};

export type AssistantPhase =
  | { status: "idle" }
  | { requestText: string; status: "planning" }
  | { question: string; requestText: string; status: "clarify" }
  | {
      confirmation: AssistantConfirmationRequest;
      confirmationToken: string;
      plannedCalls: ReadonlyArray<AssistantPlannedToolCall>;
      requestText: string;
      status: "confirm";
      summary: string;
    }
  | {
      plannedCalls: ReadonlyArray<AssistantPlannedToolCall>;
      requestText: string;
      status: "executing";
      summary: string;
    }
  | {
      destinationLabel: string | null;
      executionResults: ReadonlyArray<AssistantToolExecutionResult>;
      plannedCalls: ReadonlyArray<AssistantPlannedToolCall>;
      status: "success" | "partial" | "failure" | "cancelled";
      summary: string;
    };

export type AssistantUiState = {
  activeRequestText: string | null;
  asyncToken: number;
  inputValue: string;
  isCloseConfirmOpen: boolean;
  isOpen: boolean;
  messages: ReadonlyArray<AssistantConversationMessage>;
  pendingSessionRebase: {
    destinationScopeKey: string;
    destinationViewKind: ViewKind;
    sourceScopeKey: string;
    sourceSessionId: string;
  } | null;
  phase: AssistantPhase;
  scopeKey: string | null;
  sessionId: string | null;
  sessionViewKind: ViewKind | null;
};

const createMessage = (
  role: AssistantConversationMessage["role"],
  text: string,
  tone: AssistantConversationMessage["tone"] = "default",
): AssistantConversationMessage => ({
  id: crypto.randomUUID(),
  role,
  text,
  tone,
});

export const createInitialAssistantUiState = (): AssistantUiState => ({
  activeRequestText: null,
  asyncToken: 0,
  inputValue: "",
  isCloseConfirmOpen: false,
  isOpen: false,
  messages: [],
  pendingSessionRebase: null,
  phase: { status: "idle" },
  scopeKey: null,
  sessionId: null,
  sessionViewKind: null,
});

const createInvalidatedAssistantUiState = (params: {
  inputValue: string;
  isOpen: boolean;
  scopeKey: string | null;
  state: AssistantUiState;
}): AssistantUiState => ({
  ...createInitialAssistantUiState(),
  asyncToken: params.state.asyncToken + 1,
  inputValue: params.inputValue,
  isOpen: params.isOpen,
  scopeKey: params.scopeKey,
});

export const openAssistantForScope = (params: {
  scopeKey: string;
  state: AssistantUiState;
}): AssistantUiState => {
  const rebasedState = rebaseAssistantForScopeChange({
    scopeKey: params.scopeKey,
    state: params.state,
  });

  return {
    ...rebasedState,
    isCloseConfirmOpen: false,
    isOpen: true,
    scopeKey: params.scopeKey,
  };
};

export const rebaseAssistantForScopeChange = (params: {
  scopeKey: string;
  state: AssistantUiState;
}): AssistantUiState => {
  if (params.state.scopeKey === params.scopeKey) {
    return params.state;
  }

  const nextInputValue = params.state.phase.status === "idle" ? params.state.inputValue : "";

  return createInvalidatedAssistantUiState({
    inputValue: nextInputValue,
    isOpen: params.state.isOpen,
    scopeKey: params.scopeKey,
    state: params.state,
  });
};

export const closeAssistantUi = (state: AssistantUiState): AssistantUiState => {
  return createInvalidatedAssistantUiState({
    inputValue: "",
    isOpen: false,
    scopeKey: null,
    state,
  });
};

const matchesPendingSessionRebase = (params: {
  asyncToken: number;
  requestScopeKey: string;
  sessionId: string;
  state: AssistantUiState;
}): boolean => {
  const pendingSessionRebase = params.state.pendingSessionRebase;

  return (
    pendingSessionRebase !== null &&
    params.state.asyncToken === params.asyncToken &&
    pendingSessionRebase.sourceScopeKey === params.requestScopeKey &&
    pendingSessionRebase.sourceSessionId === params.sessionId
  );
};

export const finalizeAssistantPendingSessionRebase = (
  state: AssistantUiState,
): AssistantUiState => {
  if (state.pendingSessionRebase === null) {
    return state;
  }

  return {
    ...state,
    pendingSessionRebase: null,
    scopeKey: state.pendingSessionRebase.destinationScopeKey,
    sessionId: null,
    sessionViewKind: state.pendingSessionRebase.destinationViewKind,
  };
};

export const markAssistantPendingSessionRebase = (params: {
  destinationScopeKey: string;
  destinationViewKind: ViewKind;
  sessionId: string;
  state: AssistantUiState;
}): AssistantUiState => {
  const sourceScopeKey = params.state.pendingSessionRebase?.sourceScopeKey ?? params.state.scopeKey;
  if (sourceScopeKey === null) {
    return params.state;
  }

  return {
    ...params.state,
    pendingSessionRebase: {
      destinationScopeKey: params.destinationScopeKey,
      destinationViewKind: params.destinationViewKind,
      sourceScopeKey,
      sourceSessionId: params.sessionId,
    },
    scopeKey: params.destinationScopeKey,
    sessionViewKind: params.destinationViewKind,
  };
};

export const shouldApplyAssistantAsyncUpdate = (params: {
  asyncToken: number;
  requestScopeKey: string;
  sessionId: string;
  state: AssistantUiState;
}): boolean => {
  return (
    (shouldContinueAssistantPendingRequest(params) &&
      params.state.sessionId === params.sessionId) ||
    matchesPendingSessionRebase(params)
  );
};

export const shouldContinueAssistantPendingRequest = (params: {
  asyncToken: number;
  requestScopeKey: string;
  state: AssistantUiState;
}): boolean => {
  return (
    params.state.asyncToken === params.asyncToken &&
    params.state.scopeKey === params.requestScopeKey
  );
};

export const applyAssistantStopResult = (params: {
  asyncToken: number;
  requestScopeKey: string;
  sessionId: string | null;
  state: AssistantUiState;
}): AssistantUiState => {
  if (
    !shouldContinueAssistantPendingRequest({
      asyncToken: params.asyncToken,
      requestScopeKey: params.requestScopeKey,
      state: params.state,
    }) ||
    (params.sessionId !== null && params.state.sessionId !== params.sessionId)
  ) {
    return params.state;
  }

  return {
    ...params.state,
    activeRequestText: null,
    asyncToken: params.state.asyncToken + 1,
    messages: [
      ...params.state.messages,
      createMessage("assistant", "Stopped the current assistant request.", "muted"),
    ],
    phase: {
      destinationLabel: null,
      executionResults: [],
      plannedCalls: [],
      status: "cancelled",
      summary: "Stopped the current assistant request.",
    },
  };
};

export const isAssistantBusy = (phase: AssistantPhase): boolean =>
  phase.status === "planning" || phase.status === "executing";

export const shouldSubmitAssistantInput = (params: {
  key: string;
  shiftKey: boolean;
}): boolean => params.key === "Enter" && !params.shiftKey;

export const requiresAssistantCloseConfirmation = (phase: AssistantPhase): boolean =>
  isAssistantBusy(phase);

export const beginAssistantPlanning = (params: {
  requestText: string;
  responseLabel: string | null;
  state: AssistantUiState;
  userMessageText: string | null;
}): AssistantUiState => ({
  ...params.state,
  activeRequestText: params.requestText,
  asyncToken: params.state.asyncToken + 1,
  inputValue: "",
  messages:
    params.userMessageText === null
      ? params.responseLabel === null
        ? params.state.messages
        : [...params.state.messages, createMessage("system", params.responseLabel, "muted")]
      : [...params.state.messages, createMessage("user", params.userMessageText)],
  phase: {
    requestText: params.requestText,
    status: "planning",
  },
});

export const applyAssistantPlanResult = (params: {
  requestText: string;
  result: AssistantPlanResult;
  state: AssistantUiState;
}): AssistantUiState => {
  switch (params.result.kind) {
    case "clarify":
      return {
        ...params.state,
        activeRequestText: params.requestText,
        messages: [...params.state.messages, createMessage("assistant", params.result.message)],
        phase: {
          question: params.result.message,
          requestText: params.requestText,
          status: "clarify",
        },
      };
    case "confirm":
      return {
        ...params.state,
        activeRequestText: params.requestText,
        messages: [...params.state.messages, createMessage("assistant", params.result.message)],
        phase: {
          confirmation: params.result.confirmation,
          confirmationToken: params.result.confirmationToken,
          plannedCalls: params.result.plannedCalls,
          requestText: params.requestText,
          status: "confirm",
          summary: params.result.planSummary,
        },
      };
    case "execute":
      return {
        ...params.state,
        activeRequestText: params.requestText,
        messages: [...params.state.messages, createMessage("assistant", params.result.message)],
        phase: {
          plannedCalls: params.result.plannedCalls,
          requestText: params.requestText,
          status: "executing",
          summary: params.result.planSummary,
        },
      };
    case "result": {
      const baseState = finalizeAssistantPendingSessionRebase(params.state);
      const tone =
        params.result.outcome === "success"
          ? "success"
          : params.result.outcome === "failure"
            ? "destructive"
            : "default";

      return {
        ...baseState,
        activeRequestText: null,
        messages: [...baseState.messages, createMessage("assistant", params.result.message, tone)],
        phase: {
          destinationLabel: params.result.destinationLabel,
          executionResults: params.result.executionResults,
          plannedCalls: params.result.plannedCalls,
          status: params.result.outcome,
          summary: params.result.message,
        },
      };
    }
  }
};
