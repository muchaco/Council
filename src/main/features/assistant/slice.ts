import { type ResultAsync, errAsync, okAsync } from "neverthrow";
import {
  sanitizeAssistantContext,
  summarizeAssistantUserRequest,
  summarizeAssistantUserTurnResponse,
} from "../../../shared/assistant/assistant-audit.js";
import {
  attachAssistantSessionToPlanResult,
  buildAssistantPlannerPrompt,
  parseAssistantPlannerResponse,
} from "../../../shared/assistant/assistant-plan-schema.js";
import { ASSISTANT_TOOL_DEFINITIONS } from "../../../shared/assistant/assistant-tool-definitions.js";
import type { DomainError } from "../../../shared/domain/errors.js";
import type { ModelRef } from "../../../shared/domain/model-ref.js";
import type {
  AssistantCancelSessionResponse,
  AssistantCloseSessionResponse,
  AssistantContextEnvelope,
  AssistantCreateSessionResponse,
  AssistantPlanResult,
  AssistantSessionDto,
  AssistantSubmitRequest,
  AssistantSubmitResponse,
  GetSettingsViewResponse,
  ViewKind,
} from "../../../shared/ipc/dto.js";
import type { AssistantAuditService } from "../../services/assistant/assistant-audit-service.js";

type AssistantPlannerRequest = {
  sessionId: string;
  modelRef: ModelRef;
  prompt: string;
  userRequest: string;
  context: AssistantContextEnvelope;
};

type AssistantSliceDependencies = {
  nowUtc: () => string;
  createSessionId: () => string;
  getSettingsView: (params: {
    webContentsId: number;
    viewKind: ViewKind;
  }) => ResultAsync<GetSettingsViewResponse, DomainError>;
  auditService: AssistantAuditService;
  planAssistantResponse?: (
    request: AssistantPlannerRequest,
    abortSignal: AbortSignal,
  ) => ResultAsync<string, DomainError>;
};

type AssistantSessionRecord = {
  session: AssistantSessionDto;
  webContentsId: number;
  closedAtUtc: string | null;
  activeExecution: {
    executionId: number;
    abortController: AbortController;
  } | null;
};

export type AssistantSlice = {
  createSession: (params: {
    webContentsId: number;
    viewKind: ViewKind;
  }) => ResultAsync<AssistantCreateSessionResponse, DomainError>;
  submitRequest: (params: {
    webContentsId: number;
    request: AssistantSubmitRequest;
  }) => ResultAsync<AssistantSubmitResponse, DomainError>;
  cancelSession: (params: {
    sessionId: string;
    webContentsId: number;
  }) => ResultAsync<AssistantCancelSessionResponse, DomainError>;
  closeSession: (params: {
    sessionId: string;
    webContentsId: number;
  }) => ResultAsync<AssistantCloseSessionResponse, DomainError>;
  releaseWebContentsSessions: (webContentsId: number) => void;
};

const createMissingSessionResult = (sessionId: string): AssistantPlanResult => ({
  kind: "result",
  sessionId,
  outcome: "failure",
  message: "That assistant session is no longer available.",
  planSummary: null,
  plannedCalls: [],
  executionResults: [],
  error: {
    kind: "StateViolationError",
    userMessage: "That assistant session is no longer available.",
    developerMessage: `Assistant session ${sessionId} was not found.`,
    retryable: false,
    details: null,
  },
  requiresUserAction: true,
  destinationLabel: null,
});

const createPlaceholderResult = (sessionId: string, message: string): AssistantPlanResult => ({
  kind: "result",
  sessionId,
  outcome: "failure",
  message,
  planSummary: null,
  plannedCalls: [],
  executionResults: [],
  error: {
    kind: "PolicyError",
    userMessage: message,
    developerMessage: message,
    retryable: false,
    details: null,
  },
  requiresUserAction: false,
  destinationLabel: null,
});

const createCancelledResult = (sessionId: string): AssistantPlanResult => ({
  kind: "result",
  sessionId,
  outcome: "cancelled",
  message: "Assistant work stopped before any tools ran.",
  planSummary: null,
  plannedCalls: [],
  executionResults: [],
  error: null,
  requiresUserAction: false,
  destinationLabel: null,
});

const createViewScopeMismatchResult = (sessionId: string): AssistantPlanResult => ({
  kind: "result",
  sessionId,
  outcome: "failure",
  message: "That assistant session belongs to a different view.",
  planSummary: null,
  plannedCalls: [],
  executionResults: [],
  error: {
    kind: "StateViolationError",
    userMessage: "That assistant session belongs to a different view.",
    developerMessage: `Assistant session ${sessionId} was submitted with a mismatched view scope.`,
    retryable: false,
    details: null,
  },
  requiresUserAction: true,
  destinationLabel: null,
});

const createConcurrentSubmitResult = (sessionId: string): AssistantPlanResult => ({
  kind: "result",
  sessionId,
  outcome: "failure",
  message: "Assistant is already working on this session.",
  planSummary: null,
  plannedCalls: [],
  executionResults: [],
  error: {
    kind: "StateViolationError",
    userMessage: "Assistant is already working on this session.",
    developerMessage: `Assistant session ${sessionId} rejected a concurrent submit.`,
    retryable: false,
    details: null,
  },
  requiresUserAction: true,
  destinationLabel: null,
});

export const createAssistantSlice = (dependencies: AssistantSliceDependencies): AssistantSlice => {
  const sessions = new Map<string, AssistantSessionRecord>();
  let nextExecutionId = 0;

  const withSession = (sessionId: string): AssistantSessionRecord | null => {
    return sessions.get(sessionId) ?? null;
  };

  const isOwnedByWebContents = (record: AssistantSessionRecord, webContentsId: number): boolean => {
    return record.webContentsId === webContentsId;
  };

  const createSession: AssistantSlice["createSession"] = ({ webContentsId, viewKind }) => {
    const createdAtUtc = dependencies.nowUtc();
    const session: AssistantSessionDto = {
      sessionId: dependencies.createSessionId(),
      status: "open",
      viewKind,
      createdAtUtc,
      lastUpdatedAtUtc: createdAtUtc,
    };

    sessions.set(session.sessionId, {
      session,
      webContentsId,
      closedAtUtc: null,
      activeExecution: null,
    });

    dependencies.auditService.record({
      eventType: "session-created",
      sessionId: session.sessionId,
      occurredAtUtc: createdAtUtc,
      payload: {
        viewKind,
        webContentsId,
      },
    });

    return okAsync({ session });
  };

  const cancelActiveWork = (record: AssistantSessionRecord): boolean => {
    if (record.activeExecution === null) {
      return false;
    }

    record.activeExecution.abortController.abort();
    record.activeExecution = null;
    return true;
  };

  const clearActiveExecution = (record: AssistantSessionRecord, executionId: number): boolean => {
    if (record.activeExecution?.executionId !== executionId) {
      return false;
    }

    record.activeExecution = null;
    return true;
  };

  const submitRequest: AssistantSlice["submitRequest"] = ({ webContentsId, request }) => {
    const record = withSession(request.sessionId);
    if (record === null) {
      return okAsync({ result: createMissingSessionResult(request.sessionId) });
    }

    if (record.webContentsId !== webContentsId || record.closedAtUtc !== null) {
      return okAsync({ result: createMissingSessionResult(request.sessionId) });
    }

    if (record.session.viewKind !== request.context.viewKind) {
      return okAsync({ result: createViewScopeMismatchResult(request.sessionId) });
    }

    if (record.activeExecution !== null) {
      return okAsync({ result: createConcurrentSubmitResult(request.sessionId) });
    }

    const sanitizedContext = sanitizeAssistantContext(request.context);
    const submittedAtUtc = dependencies.nowUtc();
    const abortController = new AbortController();
    const executionId = nextExecutionId + 1;
    nextExecutionId = executionId;
    record.activeExecution = {
      executionId,
      abortController,
    };
    record.session.lastUpdatedAtUtc = submittedAtUtc;

    dependencies.auditService.record({
      eventType: "submit-started",
      sessionId: request.sessionId,
      occurredAtUtc: submittedAtUtc,
      payload: {
        requestSummary: summarizeAssistantUserRequest(request.userRequest),
        responseSummary: summarizeAssistantUserTurnResponse(request.response),
        context: sanitizedContext,
      },
    });

    return dependencies
      .getSettingsView({
        webContentsId,
        viewKind: record.session.viewKind,
      })
      .andThen((settingsView) => {
        if (
          settingsView.globalDefaultModelRef === null ||
          settingsView.globalDefaultModelInvalidConfig
        ) {
          return okAsync<AssistantSubmitResponse, DomainError>({
            result: createPlaceholderResult(
              request.sessionId,
              "Assistant planning requires a valid global default model.",
            ),
          });
        }

        const prompt = buildAssistantPlannerPrompt({
          userRequest: request.userRequest,
          context: sanitizedContext,
          tools: ASSISTANT_TOOL_DEFINITIONS,
        });

        if (
          dependencies.planAssistantResponse === undefined ||
          ASSISTANT_TOOL_DEFINITIONS.length === 0
        ) {
          return okAsync<AssistantSubmitResponse, DomainError>({
            result: createPlaceholderResult(
              request.sessionId,
              "Assistant planning foundation is registered, but no assistant tools are enabled yet.",
            ),
          });
        }

        return dependencies
          .planAssistantResponse(
            {
              sessionId: request.sessionId,
              modelRef: settingsView.globalDefaultModelRef,
              prompt,
              userRequest: request.userRequest,
              context: sanitizedContext,
            },
            abortController.signal,
          )
          .map((rawPlannerResponse) => {
            if (abortController.signal.aborted || record.closedAtUtc !== null) {
              return { result: createCancelledResult(request.sessionId) };
            }

            const parsed = parseAssistantPlannerResponse(rawPlannerResponse);
            if (parsed === null) {
              return {
                result: createPlaceholderResult(
                  request.sessionId,
                  "Assistant planner returned an invalid structured response.",
                ),
              };
            }

            return {
              result: attachAssistantSessionToPlanResult({
                sessionId: request.sessionId,
                plannerResponse: parsed,
              }),
            };
          })
          .orElse(() => {
            if (abortController.signal.aborted || record.closedAtUtc !== null) {
              return okAsync({ result: createCancelledResult(request.sessionId) });
            }

            return okAsync({
              result: createPlaceholderResult(
                request.sessionId,
                "Assistant planning could not complete safely.",
              ),
            });
          });
      })
      .map((response) => {
        const occurredAtUtc = dependencies.nowUtc();
        if (clearActiveExecution(record, executionId)) {
          record.session.lastUpdatedAtUtc = occurredAtUtc;
        }

        dependencies.auditService.record({
          eventType: "submit-finished",
          sessionId: request.sessionId,
          occurredAtUtc,
          payload: {
            result: response.result,
          },
        });

        return response;
      })
      .mapErr((error) => {
        if (clearActiveExecution(record, executionId)) {
          record.session.lastUpdatedAtUtc = dependencies.nowUtc();
        }

        return error;
      });
  };

  const cancelSession: AssistantSlice["cancelSession"] = ({ sessionId, webContentsId }) => {
    const record = withSession(sessionId);
    if (record === null || !isOwnedByWebContents(record, webContentsId)) {
      return okAsync({ cancelled: false });
    }

    const cancelled = cancelActiveWork(record);
    const occurredAtUtc = dependencies.nowUtc();
    record.session.lastUpdatedAtUtc = occurredAtUtc;

    dependencies.auditService.record({
      eventType: "session-cancelled",
      sessionId,
      occurredAtUtc,
      payload: { cancelled },
    });

    return okAsync({ cancelled });
  };

  const closeSession: AssistantSlice["closeSession"] = ({ sessionId, webContentsId }) => {
    const record = withSession(sessionId);
    if (record === null || !isOwnedByWebContents(record, webContentsId)) {
      return okAsync({ closed: false, cancelledInFlightWork: false });
    }

    const cancelledInFlightWork = cancelActiveWork(record);
    const occurredAtUtc = dependencies.nowUtc();
    record.closedAtUtc = occurredAtUtc;
    record.session.status = "closed";
    record.session.lastUpdatedAtUtc = occurredAtUtc;

    dependencies.auditService.record({
      eventType: "session-closed",
      sessionId,
      occurredAtUtc,
      payload: { cancelledInFlightWork },
    });

    sessions.delete(sessionId);

    return okAsync({ closed: true, cancelledInFlightWork });
  };

  return {
    createSession,
    submitRequest,
    cancelSession,
    closeSession,
    releaseWebContentsSessions: (webContentsId: number): void => {
      for (const record of sessions.values()) {
        if (record.webContentsId !== webContentsId) {
          continue;
        }

        void closeSession({ sessionId: record.session.sessionId, webContentsId });
      }
    },
  };
};
