import { ResultAsync, okAsync } from "neverthrow";
import {
  COUNCIL_CONFIG_MAX_TAGS,
  normalizeTagsDraft,
  toModelRef,
} from "../../../shared/app-ui-helpers.js";
import {
  sanitizeAssistantContext,
  sanitizeAssistantPayload,
  summarizeAssistantUserRequest,
  summarizeAssistantUserTurnResponse,
} from "../../../shared/assistant/assistant-audit.js";
import {
  getAgentDraftEditGuardMessage,
  getCouncilDraftEditGuardMessage,
} from "../../../shared/assistant/assistant-draft-edit-guards.js";
import {
  attachAssistantSessionToPlanResult,
  buildAssistantPlannerPrompt,
  parseAssistantPlannerResponse,
} from "../../../shared/assistant/assistant-plan-schema.js";
import { tryBuildAssistantPlannerShortcut } from "../../../shared/assistant/assistant-planner-shortcuts.js";
import { resolveAssistantReconciliationState } from "../../../shared/assistant/assistant-reconciliation.js";
import {
  resolveAssistantConfirmationRequirement,
  validateAssistantPlannedCall,
} from "../../../shared/assistant/assistant-risk-policy.js";
import {
  ASSISTANT_TOOL_DEFINITIONS,
  getAssistantToolDefinition,
} from "../../../shared/assistant/assistant-tool-definitions.js";
import type { DomainError } from "../../../shared/domain/errors.js";
import type { ModelRef } from "../../../shared/domain/model-ref.js";
import type {
  AgentDto,
  AssistantCancelSessionResponse,
  AssistantCloseSessionResponse,
  AssistantCompleteReconciliationRequest,
  AssistantCompleteReconciliationResponse,
  AssistantConfirmationRequest,
  AssistantContextEnvelope,
  AssistantCreateSessionResponse,
  AssistantExecutionSnapshot,
  AssistantPlanResult,
  AssistantPlannedToolCall,
  AssistantSessionDto,
  AssistantSubmitRequest,
  AssistantSubmitResponse,
  AssistantToolExecutionError,
  AssistantToolExecutionResult,
  CouncilDto,
  GetAgentEditorViewResponse,
  GetCouncilEditorViewResponse,
  GetCouncilViewResponse,
  GetSettingsViewResponse,
  ListAgentsResponse,
  ListCouncilsResponse,
  SaveAgentRequest,
  SaveAgentResponse,
  SaveCouncilRequest,
  SaveCouncilResponse,
  ViewKind,
} from "../../../shared/ipc/dto.js";
import type { AssistantAuditService } from "../../services/assistant/assistant-audit-service.js";

type AssistantPlannerRequest = {
  sessionId: string;
  webContentsId: number;
  modelRef: ModelRef;
  prompt: string;
  userRequest: string;
  context: AssistantContextEnvelope;
  response: AssistantSubmitRequest["response"];
};

type AssistantSliceDependencies = {
  nowUtc: () => string;
  createSessionId: () => string;
  getSettingsView: (params: {
    webContentsId: number;
    viewKind: ViewKind;
  }) => ResultAsync<GetSettingsViewResponse, DomainError>;
  auditService: AssistantAuditService;
  listAgents: (params: {
    webContentsId: number;
    searchText: string;
    tagFilter: string;
    archivedFilter: "active" | "archived" | "all";
    sortBy: "createdAt" | "updatedAt";
    sortDirection: "asc" | "desc";
    page: number;
  }) => ResultAsync<ListAgentsResponse, DomainError>;
  getAgentEditorView: (params: {
    webContentsId: number;
    agentId: string | null;
  }) => ResultAsync<GetAgentEditorViewResponse, DomainError>;
  saveAgent: (params: {
    webContentsId: number;
    draft: SaveAgentRequest;
  }) => ResultAsync<SaveAgentResponse, DomainError>;
  listCouncils: (params: {
    webContentsId: number;
    searchText: string;
    tagFilter: string;
    archivedFilter: "active" | "archived" | "all";
    sortBy: "createdAt" | "updatedAt";
    sortDirection: "asc" | "desc";
    page: number;
  }) => ResultAsync<ListCouncilsResponse, DomainError>;
  getCouncilEditorView: (params: {
    webContentsId: number;
    councilId: string | null;
  }) => ResultAsync<GetCouncilEditorViewResponse, DomainError>;
  saveCouncil: (params: {
    webContentsId: number;
    draft: SaveCouncilRequest;
  }) => ResultAsync<SaveCouncilResponse, DomainError>;
  getCouncilView: (params: {
    webContentsId: number;
    councilId: string;
  }) => ResultAsync<GetCouncilViewResponse, DomainError>;
  planAssistantResponse?: (
    request: AssistantPlannerRequest,
    abortSignal: AbortSignal,
  ) => ResultAsync<string, DomainError>;
};

type PendingAssistantPlan = {
  kind: "confirm" | "execute";
  planSummary: string;
  plannedCalls: ReadonlyArray<AssistantPlannedToolCall>;
};

const toSavedAgentFields = (agent: AgentDto) => ({
  modelRefOrNull: agent.modelRefOrNull,
  name: agent.name,
  systemPrompt: agent.systemPrompt,
  tags: agent.tags,
  temperature: agent.temperature,
  verbosity: agent.verbosity,
});

const toSavedCouncilFields = (council: CouncilDto) => ({
  conductorModelRefOrNull: council.conductorModelRefOrNull,
  goal: council.goal,
  memberAgentIds: council.memberAgentIds,
  mode: council.mode,
  tags: council.tags,
  title: council.title,
  topic: council.topic,
});

type PendingAssistantClarification = {
  kind: "openCouncilView";
  originalRequest: string;
};

type AssistantSessionRecord = {
  session: AssistantSessionDto;
  webContentsId: number;
  closedAtUtc: string | null;
  pendingPlan: PendingAssistantPlan | null;
  pendingClarification: PendingAssistantClarification | null;
  pendingReconciliation: {
    executionResults: ReadonlyArray<AssistantToolExecutionResult>;
  } | null;
  activeExecution: {
    executionId: number;
    abortController: AbortController;
  } | null;
};

type AssistantToolSuccess = {
  output: Readonly<Record<string, unknown>>;
  userSummary: string;
};

type AssistantQueryDefaults = {
  archivedFilter: "active" | "archived" | "all";
  searchText: string;
  sortBy: "createdAt" | "updatedAt";
  sortDirection: "asc" | "desc";
  tagFilter: string;
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
  completeReconciliation: (params: {
    webContentsId: number;
    request: AssistantCompleteReconciliationRequest;
  }) => ResultAsync<AssistantCompleteReconciliationResponse, DomainError>;
  releaseWebContentsSessions: (webContentsId: number) => void;
};

const DEFAULT_AGENT_QUERY: AssistantQueryDefaults = {
  archivedFilter: "all",
  searchText: "",
  sortBy: "updatedAt",
  sortDirection: "desc",
  tagFilter: "",
};

const DEFAULT_COUNCIL_QUERY: AssistantQueryDefaults = {
  archivedFilter: "all",
  searchText: "",
  sortBy: "updatedAt",
  sortDirection: "desc",
  tagFilter: "",
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

const matchesOpenCouncilClarification = (params: {
  context: AssistantContextEnvelope;
  question: string;
  userRequest: string;
}): boolean => {
  if (params.context.viewKind !== "councilsList") {
    return false;
  }

  const normalizedRequest = params.userRequest.trim().toLowerCase();
  const normalizedQuestion = params.question.trim().toLowerCase();
  return (
    normalizedRequest.includes("open") &&
    normalizedRequest.includes("council") &&
    normalizedQuestion.includes("which council")
  );
};

const normalizeClarificationText = (text: string): string => text.trim().toLowerCase();

const matchesCurrentCouncilRuntimeStatusRequest = (params: {
  context: AssistantContextEnvelope;
  userRequest: string;
}): boolean => {
  if (params.context.viewKind !== "councilView" || params.context.activeEntityId === null) {
    return false;
  }

  const normalizedRequest = params.userRequest.trim().toLowerCase();
  const mentionsRuntime = normalizedRequest.includes("runtime");
  const mentionsStatus = normalizedRequest.includes("status");
  const mentionsCurrentCouncil =
    normalizedRequest.includes("this council") || normalizedRequest.includes("current council");

  return mentionsRuntime && mentionsStatus && mentionsCurrentCouncil;
};

const createInvalidConfigResult = (params: {
  developerMessage: string;
  sessionId: string;
  userMessage: string;
}): AssistantPlanResult => ({
  kind: "result",
  sessionId: params.sessionId,
  outcome: "failure",
  message: params.userMessage,
  planSummary: null,
  plannedCalls: [],
  executionResults: [],
  error: {
    kind: "InvalidConfigError",
    userMessage: params.userMessage,
    developerMessage: params.developerMessage,
    retryable: false,
    details: null,
  },
  requiresUserAction: true,
  destinationLabel: null,
});

const createCancelledResult = (params: {
  executionResults?: ReadonlyArray<AssistantToolExecutionResult>;
  sessionId: string;
}): AssistantPlanResult => ({
  kind: "result",
  sessionId: params.sessionId,
  outcome: "cancelled",
  message:
    (params.executionResults?.length ?? 0) > 0
      ? `Stopped after ${String(params.executionResults?.filter((result) => result.status === "success").length ?? 0)} completed assistant step(s).`
      : "Assistant work stopped before any tools ran.",
  planSummary: null,
  plannedCalls: [],
  executionResults: params.executionResults ?? [],
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

const createUnexpectedConfirmationResult = (sessionId: string): AssistantPlanResult => ({
  kind: "result",
  sessionId,
  outcome: "failure",
  message: "There is no assistant confirmation waiting right now.",
  planSummary: null,
  plannedCalls: [],
  executionResults: [],
  error: {
    kind: "StateViolationError",
    userMessage: "There is no assistant confirmation waiting right now.",
    developerMessage: `Assistant session ${sessionId} received a confirmation response without a pending confirmation plan.`,
    retryable: false,
    details: null,
  },
  requiresUserAction: true,
  destinationLabel: null,
});

const createRejectedConfirmationResult = (sessionId: string): AssistantPlanResult => ({
  kind: "result",
  sessionId,
  outcome: "cancelled",
  message: "Okay - I did not run that action.",
  planSummary: null,
  plannedCalls: [],
  executionResults: [],
  error: null,
  requiresUserAction: false,
  destinationLabel: null,
});

const isOwnedByWebContents = (record: AssistantSessionRecord, webContentsId: number): boolean => {
  return record.webContentsId === webContentsId;
};

const toAssistantToolError = (
  error: DomainError,
  developerMessage?: string,
): AssistantToolExecutionError => ({
  kind: error.kind,
  userMessage: error.userMessage,
  developerMessage: developerMessage ?? error.devMessage,
  retryable: error.kind === "ProviderError" || error.kind === "InternalError",
  details: error.details === undefined ? null : sanitizeAssistantPayload(error.details),
});

const createFailedToolResult = (params: {
  callId: string;
  error: AssistantToolExecutionError;
  toolName: string;
}): AssistantToolExecutionResult => ({
  callId: params.callId,
  toolName: params.toolName,
  status: "failed",
  error: params.error,
  userSummary: params.error.userMessage,
});

const createCancelledToolResult = (params: {
  callId: string;
  toolName: string;
}): AssistantToolExecutionResult => ({
  callId: params.callId,
  toolName: params.toolName,
  status: "cancelled",
  error: null,
  userSummary: "Stopped before this assistant step completed.",
});

const modelRefToLabel = (
  modelRefOrNull: AgentDto["modelRefOrNull"] | CouncilDto["conductorModelRefOrNull"],
): string | null => {
  if (modelRefOrNull === null) {
    return null;
  }

  return `${modelRefOrNull.providerId}:${modelRefOrNull.modelId}`;
};

const formatEntityList = (items: ReadonlyArray<string>): string => {
  if (items.length === 0) {
    return "none";
  }

  if (items.length === 1) {
    return items[0] ?? "none";
  }

  return `${items.slice(0, 3).join(", ")}${items.length > 3 ? `, and ${String(items.length - 3)} more` : ""}`;
};

const AGENT_DRAFT_FIELD_LABELS = {
  name: "name",
  systemPrompt: "system prompt",
  tags: "tags",
  temperature: "temperature",
  verbosity: "verbosity",
} as const;

const COUNCIL_DRAFT_FIELD_LABELS = {
  goal: "goal",
  mode: "mode",
  tags: "tags",
  title: "title",
  topic: "topic",
} as const;

const collectAppliedFieldLabels = <TFieldLabels extends Readonly<Record<string, string>>>(params: {
  fieldLabels: TFieldLabels;
  input: Readonly<Record<string, unknown>>;
}): ReadonlyArray<string> => {
  return Object.entries(params.fieldLabels).flatMap(([fieldName, label]) =>
    Object.hasOwn(params.input, fieldName) ? [label] : [],
  );
};

const summarizeDraftPatch = (params: {
  appliedFieldLabels: ReadonlyArray<string>;
  entityLabel: string;
}): string =>
  `Updated the current ${params.entityLabel} draft ${params.appliedFieldLabels.join(", ")}.`;

const parseAssistantAgentDraftForSave = (executionSnapshot: AssistantExecutionSnapshot | null) => {
  if (executionSnapshot?.kind !== "agent") {
    return {
      ok: false as const,
      message:
        "The current visible agent draft details are unavailable. Please try again from the agent editor.",
    };
  }

  const normalizedTagsResult = normalizeTagsDraft({
    tagsInput: executionSnapshot.draft.tagsInput,
    maxTags: COUNCIL_CONFIG_MAX_TAGS,
  });
  if (!normalizedTagsResult.ok) {
    return {
      ok: false as const,
      message: normalizedTagsResult.message,
    };
  }

  const parsedTemperature =
    executionSnapshot.draft.temperature.trim().length === 0
      ? null
      : Number.parseFloat(executionSnapshot.draft.temperature);
  if (Number.isNaN(parsedTemperature ?? 0)) {
    return {
      ok: false as const,
      message: "Temperature must be a valid number.",
    };
  }

  return {
    ok: true as const,
    draft: {
      viewKind: "agentEdit" as const,
      id: executionSnapshot.draft.id,
      name: executionSnapshot.draft.name,
      systemPrompt: executionSnapshot.draft.systemPrompt,
      verbosity:
        executionSnapshot.draft.verbosity.trim().length === 0
          ? null
          : executionSnapshot.draft.verbosity,
      temperature: parsedTemperature,
      tags: normalizedTagsResult.tags,
      modelRefOrNull: toModelRef(executionSnapshot.draft.modelSelection),
    } satisfies SaveAgentRequest,
  };
};

const parseAssistantCouncilDraftForSave = (
  executionSnapshot: AssistantExecutionSnapshot | null,
) => {
  if (executionSnapshot?.kind !== "council") {
    return {
      ok: false as const,
      message:
        "The current visible council draft details are unavailable. Please try again from the council editor.",
    };
  }

  if (executionSnapshot.draft.title.trim().length === 0) {
    return {
      ok: false as const,
      message: "Title is required.",
    };
  }
  if (executionSnapshot.draft.topic.trim().length === 0) {
    return {
      ok: false as const,
      message: "Topic is required before saving a council.",
    };
  }
  if (executionSnapshot.draft.selectedMemberIds.length === 0) {
    return {
      ok: false as const,
      message: "Select at least one member before saving.",
    };
  }

  const normalizedTagsResult = normalizeTagsDraft({
    tagsInput: executionSnapshot.draft.tagsInput,
    maxTags: COUNCIL_CONFIG_MAX_TAGS,
  });
  if (!normalizedTagsResult.ok) {
    return {
      ok: false as const,
      message: normalizedTagsResult.message,
    };
  }

  return {
    ok: true as const,
    draft: {
      viewKind: "councilCreate" as const,
      id: executionSnapshot.draft.id,
      title: executionSnapshot.draft.title,
      topic: executionSnapshot.draft.topic,
      goal: executionSnapshot.draft.goal.trim().length === 0 ? null : executionSnapshot.draft.goal,
      mode: executionSnapshot.draft.mode,
      tags: normalizedTagsResult.tags,
      memberAgentIds: executionSnapshot.draft.selectedMemberIds,
      memberColorsByAgentId: {},
      conductorModelRefOrNull: toModelRef(executionSnapshot.draft.conductorModelSelection),
    } satisfies SaveCouncilRequest,
  };
};

const applyExecutionSnapshotPatch = (params: {
  executionSnapshot: AssistantExecutionSnapshot | null;
  plannedCall: AssistantPlannedToolCall;
}): AssistantExecutionSnapshot | null => {
  switch (params.plannedCall.toolName) {
    case "setAgentDraftFields": {
      if (params.executionSnapshot?.kind !== "agent") {
        return params.executionSnapshot;
      }

      const patch = params.plannedCall.input as {
        modelRefOrNull?: { modelId: string; providerId: string } | null;
        name?: string;
        systemPrompt?: string;
        tags?: ReadonlyArray<string>;
        temperature?: number | null;
        verbosity?: string | null;
      };
      return {
        kind: "agent",
        draft: {
          ...params.executionSnapshot.draft,
          ...(patch.name === undefined ? {} : { name: patch.name }),
          ...(patch.systemPrompt === undefined ? {} : { systemPrompt: patch.systemPrompt }),
          ...(patch.verbosity === undefined ? {} : { verbosity: patch.verbosity ?? "" }),
          ...(patch.temperature === undefined
            ? {}
            : { temperature: patch.temperature === null ? "" : String(patch.temperature) }),
          ...(patch.tags === undefined ? {} : { tagsInput: patch.tags.join(", ") }),
          ...(patch.modelRefOrNull === undefined
            ? {}
            : {
                modelSelection:
                  patch.modelRefOrNull === null
                    ? ""
                    : `${patch.modelRefOrNull.providerId}:${patch.modelRefOrNull.modelId}`,
              }),
        },
      };
    }
    case "setCouncilDraftFields": {
      if (params.executionSnapshot?.kind !== "council") {
        return params.executionSnapshot;
      }

      const patch = params.plannedCall.input as {
        conductorModelRefOrNull?: { modelId: string; providerId: string } | null;
        goal?: string | null;
        memberAgentIds?: ReadonlyArray<string>;
        mode?: "autopilot" | "manual";
        tags?: ReadonlyArray<string>;
        title?: string;
        topic?: string;
      };
      return {
        kind: "council",
        draft: {
          ...params.executionSnapshot.draft,
          ...(patch.title === undefined ? {} : { title: patch.title }),
          ...(patch.topic === undefined ? {} : { topic: patch.topic }),
          ...(patch.goal === undefined ? {} : { goal: patch.goal ?? "" }),
          ...(patch.mode === undefined ? {} : { mode: patch.mode }),
          ...(patch.tags === undefined ? {} : { tagsInput: patch.tags.join(", ") }),
          ...(patch.memberAgentIds === undefined
            ? {}
            : { selectedMemberIds: [...patch.memberAgentIds] }),
          ...(patch.conductorModelRefOrNull === undefined
            ? {}
            : {
                conductorModelSelection:
                  patch.conductorModelRefOrNull === null
                    ? ""
                    : `${patch.conductorModelRefOrNull.providerId}:${patch.conductorModelRefOrNull.modelId}`,
              }),
        },
      };
    }
    default:
      return params.executionSnapshot;
  }
};

const buildDirtyDraftConfirmation = (params: {
  context: AssistantContextEnvelope;
  planSummary: string;
  plannedCalls: ReadonlyArray<AssistantPlannedToolCall>;
}): AssistantConfirmationRequest => {
  const changedFieldExamples = params.context.draftState?.changedFields.slice(0, 3) ?? [];
  return {
    summary: `This would replace the current unsaved ${params.context.draftState?.entityKind ?? "draft"} before finishing: ${params.planSummary}`,
    scopeDescription:
      params.context.draftState?.summary ??
      "The current editor has unsaved changes that would be displaced.",
    affectedCount: 1,
    examples:
      changedFieldExamples.length > 0 ? changedFieldExamples : [params.context.contextLabel],
    reversible: true,
    draftImpact: "replace-current-draft",
  };
};

const rewriteDirtyDraftPlannedCall = (params: {
  context: AssistantContextEnvelope;
  plannedCall: AssistantPlannedToolCall;
}): AssistantPlannedToolCall => {
  if (params.context.viewKind === "agentEdit") {
    if (params.plannedCall.toolName === "createAgent" && params.context.activeEntityId === null) {
      return {
        callId: params.plannedCall.callId,
        toolName: "saveAgentDraft",
        rationale: "Save the current visible agent draft through the normal editor flow.",
        input: {
          entityId: params.context.activeEntityId,
        },
      };
    }

    if (
      params.plannedCall.toolName === "updateAgent" &&
      params.plannedCall.input.agentId === params.context.activeEntityId
    ) {
      const { agentId: _agentId, ...remainingInput } = params.plannedCall.input as Readonly<
        Record<string, unknown>
      >;
      return {
        callId: params.plannedCall.callId,
        toolName: "setAgentDraftFields",
        rationale: "Patch the current visible agent draft in place.",
        input: {
          ...remainingInput,
          entityId: params.context.activeEntityId,
        },
      };
    }
  }

  if (params.context.viewKind === "councilCreate") {
    if (params.plannedCall.toolName === "createCouncil" && params.context.activeEntityId === null) {
      return {
        callId: params.plannedCall.callId,
        toolName: "saveCouncilDraft",
        rationale: "Save the current visible council draft through the normal editor flow.",
        input: {
          entityId: params.context.activeEntityId,
        },
      };
    }

    if (
      params.plannedCall.toolName === "updateCouncilConfig" &&
      params.plannedCall.input.councilId === params.context.activeEntityId
    ) {
      const { councilId: _councilId, ...remainingInput } = params.plannedCall.input as Readonly<
        Record<string, unknown>
      >;
      return {
        callId: params.plannedCall.callId,
        toolName: "setCouncilDraftFields",
        rationale: "Patch the current visible council draft in place.",
        input: {
          ...remainingInput,
          entityId: params.context.activeEntityId,
        },
      };
    }
  }

  return params.plannedCall;
};

const finalizePlannedDirective = (params: {
  context: AssistantContextEnvelope;
  plannedCalls: ReadonlyArray<AssistantPlannedToolCall>;
  preferConfirmation: boolean;
  sessionId: string;
  summary: string;
}): Extract<AssistantPlanResult, { kind: "confirm" | "execute" }> => {
  const plannedCalls = params.plannedCalls.map((plannedCall) =>
    rewriteDirtyDraftPlannedCall({
      context: params.context,
      plannedCall,
    }),
  );

  const dirtyDraftReplacement = plannedCalls.find((plannedCall) => {
    const validated = validateAssistantPlannedCall(plannedCall);
    if (!validated.ok) {
      return false;
    }

    return (
      resolveAssistantConfirmationRequirement({
        context: params.context,
        plannedCall,
        toolDefinition: validated.definition,
      }).reason === "dirty-draft-replacement"
    );
  });

  if (dirtyDraftReplacement !== undefined) {
    return {
      kind: "confirm",
      sessionId: params.sessionId,
      message: params.summary,
      planSummary: params.summary,
      plannedCalls,
      confirmation: buildDirtyDraftConfirmation({
        context: params.context,
        planSummary: params.summary,
        plannedCalls,
      }),
    };
  }

  if (params.preferConfirmation) {
    return {
      kind: "confirm",
      sessionId: params.sessionId,
      message: params.summary,
      planSummary: params.summary,
      plannedCalls,
      confirmation: {
        summary: params.summary,
        scopeDescription: params.summary,
        affectedCount: plannedCalls.length,
        examples: plannedCalls.map((plannedCall) => plannedCall.toolName).slice(0, 3),
        reversible: true,
        draftImpact: "none",
      },
    };
  }

  return {
    kind: "execute",
    sessionId: params.sessionId,
    message: params.summary,
    planSummary: params.summary,
    plannedCalls,
  };
};

const createSuccessResult = (params: {
  callId: string;
  output: Readonly<Record<string, unknown>>;
  toolName: string;
  userSummary: string;
}): AssistantToolExecutionResult => {
  const definition = getAssistantToolDefinition(params.toolName);
  if (definition === null) {
    return createFailedToolResult({
      callId: params.callId,
      toolName: params.toolName,
      error: {
        kind: "UnknownToolError",
        userMessage: "That assistant action is not available yet.",
        developerMessage: `Unknown assistant tool: ${params.toolName}`,
        retryable: false,
        details: null,
      },
    });
  }

  const parsed = definition.outputSchema.safeParse(params.output);
  if (!parsed.success) {
    return createFailedToolResult({
      callId: params.callId,
      toolName: params.toolName,
      error: {
        kind: "SchemaError",
        userMessage: "The assistant returned an invalid tool result.",
        developerMessage: `Invalid assistant tool output for ${params.toolName}`,
        retryable: false,
        details: null,
      },
    });
  }

  return {
    callId: params.callId,
    toolName: params.toolName,
    status: "success",
    output: sanitizeAssistantPayload(parsed.data),
    userSummary: params.userSummary,
    reconciliationState: resolveAssistantReconciliationState({
      reconciliation: definition.reconciliation,
      visibleStateAligned: definition.reconciliation === null,
      followUpRefreshPending: definition.reconciliation !== null,
    }),
  };
};

const createReconcilingResult = (params: {
  callId: string;
  output: Readonly<Record<string, unknown>>;
  toolName: string;
  userSummary: string;
}): AssistantToolExecutionResult => {
  const definition = getAssistantToolDefinition(params.toolName);
  if (definition === null) {
    return createFailedToolResult({
      callId: params.callId,
      toolName: params.toolName,
      error: {
        kind: "UnknownToolError",
        userMessage: "That assistant action is not available yet.",
        developerMessage: `Unknown assistant tool: ${params.toolName}`,
        retryable: false,
        details: null,
      },
    });
  }

  const parsed = definition.outputSchema.safeParse(params.output);
  if (!parsed.success) {
    return createFailedToolResult({
      callId: params.callId,
      toolName: params.toolName,
      error: {
        kind: "SchemaError",
        userMessage: "The assistant returned an invalid tool result.",
        developerMessage: `Invalid assistant tool output for ${params.toolName}`,
        retryable: false,
        details: null,
      },
    });
  }

  return {
    callId: params.callId,
    toolName: params.toolName,
    status: "reconciling",
    output: sanitizeAssistantPayload(parsed.data),
    userSummary: params.userSummary,
    reconciliationState: "follow-up-refresh-in-progress",
  };
};

const summarizeFinalResult = (
  executionResults: ReadonlyArray<AssistantToolExecutionResult>,
): string => {
  if (executionResults.length === 0) {
    return "Assistant work finished without running any supported tools.";
  }

  const successful = executionResults.filter((result) => result.status === "success");
  const failed = executionResults.find((result) => result.status === "failed");
  const cancelled = executionResults.find((result) => result.status === "cancelled");

  if (failed !== undefined) {
    return successful.length === 0
      ? failed.userSummary
      : `Completed ${String(successful.length)} assistant step(s), then stopped: ${failed.userSummary}`;
  }

  if (cancelled !== undefined) {
    return successful.length === 0
      ? cancelled.userSummary
      : `Completed ${String(successful.length)} assistant step(s) before stopping.`;
  }

  return successful.length === 1
    ? (successful[0]?.userSummary ?? "Assistant work completed.")
    : `Completed ${String(successful.length)} assistant step(s): ${successful.map((result) => result.userSummary).join(" ")}`;
};

const findDestinationLabel = (
  executionResults: ReadonlyArray<AssistantToolExecutionResult>,
): string | null => {
  for (let index = executionResults.length - 1; index >= 0; index -= 1) {
    const result = executionResults[index];
    if (result?.status !== "success") {
      continue;
    }

    switch (result.toolName) {
      case "openAgentEditor":
        return typeof result.output.agentName === "string" ? result.output.agentName : null;
      case "openCouncilEditor":
      case "openCouncilView":
        return typeof result.output.councilTitle === "string" ? result.output.councilTitle : null;
      case "navigateToHomeTab":
        return typeof result.output.tab === "string" ? result.output.tab : null;
      default:
        break;
    }
  }

  return null;
};

const toFinalPlanResult = (params: {
  executionResults: ReadonlyArray<AssistantToolExecutionResult>;
  sessionId: string;
}): AssistantPlanResult => {
  const executionResults = params.executionResults;
  const hasFailure = executionResults.some((result) => result.status === "failed");
  const hasCancelled = executionResults.some((result) => result.status === "cancelled");
  const successfulCount = executionResults.filter((result) => result.status === "success").length;
  const outcome = hasFailure
    ? successfulCount > 0
      ? "partial"
      : "failure"
    : hasCancelled
      ? successfulCount > 0
        ? "partial"
        : "cancelled"
      : "success";

  let firstFailureError: AssistantToolExecutionError | null = null;
  for (const result of executionResults) {
    if (result.status === "failed") {
      firstFailureError = result.error;
      break;
    }
  }

  return {
    kind: "result",
    sessionId: params.sessionId,
    outcome,
    message: summarizeFinalResult(executionResults),
    planSummary: null,
    plannedCalls: [],
    executionResults,
    error: firstFailureError,
    requiresUserAction: hasFailure,
    destinationLabel: findDestinationLabel(executionResults),
  };
};

const createPendingReconciliationResult = (params: {
  executionResults: ReadonlyArray<AssistantToolExecutionResult>;
  sessionId: string;
}): AssistantPlanResult => {
  const pendingCount = params.executionResults.filter(
    (result) => result.status === "reconciling",
  ).length;
  const successfulCount = params.executionResults.filter(
    (result) => result.status === "success",
  ).length;

  return {
    kind: "result",
    sessionId: params.sessionId,
    outcome: "partial",
    message:
      successfulCount === 0
        ? `Waiting for ${String(pendingCount)} assistant step(s) to finish visibly.`
        : `Completed ${String(successfulCount)} assistant step(s); waiting for ${String(pendingCount)} assistant step(s) to finish visibly.`,
    planSummary: null,
    plannedCalls: [],
    executionResults: params.executionResults,
    error: null,
    requiresUserAction: false,
    destinationLabel: findDestinationLabel(params.executionResults),
  };
};

const resolveAgentListQuery = (params: {
  context: AssistantContextEnvelope;
  input: Readonly<Record<string, unknown>>;
}) => {
  const contextList = params.context.viewKind === "agentsList" ? params.context.listState : null;
  return {
    archivedFilter:
      typeof params.input.archivedFilter === "string"
        ? (params.input.archivedFilter as "active" | "archived" | "all")
        : ((contextList?.archivedFilter as "active" | "archived" | "all" | null) ??
          DEFAULT_AGENT_QUERY.archivedFilter),
    searchText:
      typeof params.input.searchText === "string"
        ? params.input.searchText
        : (contextList?.searchText ?? DEFAULT_AGENT_QUERY.searchText),
    sortBy:
      contextList?.sortBy === "createdAt" || contextList?.sortBy === "updatedAt"
        ? contextList.sortBy
        : DEFAULT_AGENT_QUERY.sortBy,
    sortDirection:
      contextList?.sortDirection === "asc" || contextList?.sortDirection === "desc"
        ? contextList.sortDirection
        : DEFAULT_AGENT_QUERY.sortDirection,
    tagFilter:
      typeof params.input.tagFilter === "string"
        ? params.input.tagFilter
        : (contextList?.tagFilter ?? DEFAULT_AGENT_QUERY.tagFilter),
  };
};

const resolveCouncilListQuery = (params: {
  context: AssistantContextEnvelope;
  input: Readonly<Record<string, unknown>>;
}) => {
  const contextList = params.context.viewKind === "councilsList" ? params.context.listState : null;
  return {
    archivedFilter:
      typeof params.input.archivedFilter === "string"
        ? (params.input.archivedFilter as "active" | "archived" | "all")
        : ((contextList?.archivedFilter as "active" | "archived" | "all" | null) ??
          DEFAULT_COUNCIL_QUERY.archivedFilter),
    searchText:
      typeof params.input.searchText === "string"
        ? params.input.searchText
        : (contextList?.searchText ?? DEFAULT_COUNCIL_QUERY.searchText),
    sortBy:
      contextList?.sortBy === "createdAt" || contextList?.sortBy === "updatedAt"
        ? contextList.sortBy
        : DEFAULT_COUNCIL_QUERY.sortBy,
    sortDirection:
      contextList?.sortDirection === "asc" || contextList?.sortDirection === "desc"
        ? contextList.sortDirection
        : DEFAULT_COUNCIL_QUERY.sortDirection,
    tagFilter:
      typeof params.input.tagFilter === "string"
        ? params.input.tagFilter
        : (contextList?.tagFilter ?? DEFAULT_COUNCIL_QUERY.tagFilter),
  };
};

const resolveAgentId = (params: {
  context: AssistantContextEnvelope;
  input: Readonly<Record<string, unknown>>;
}): string | null => {
  if (typeof params.input.agentId === "string") {
    return params.input.agentId;
  }

  return params.context.viewKind === "agentEdit" ? params.context.activeEntityId : null;
};

const resolveCouncilId = (params: {
  context: AssistantContextEnvelope;
  input: Readonly<Record<string, unknown>>;
}): string | null => {
  if (typeof params.input.councilId === "string") {
    return params.input.councilId;
  }

  if (params.context.viewKind === "councilCreate" || params.context.viewKind === "councilView") {
    return params.context.activeEntityId;
  }

  return null;
};

const createValidationToolError = (message: string): AssistantToolExecutionError => ({
  kind: "ValidationError",
  userMessage: message,
  developerMessage: message,
  retryable: false,
  details: null,
});

const isCurrentDraftTarget = (params: {
  context: AssistantContextEnvelope;
  entityId: string | null;
  expectedViewKind: AssistantContextEnvelope["viewKind"];
}): boolean => {
  return (
    params.context.viewKind === params.expectedViewKind &&
    (params.entityId === null || params.context.activeEntityId === params.entityId)
  );
};

const createUnavailableCurrentDraftResult = (params: {
  callId: string;
  message: string;
  toolName: string;
}): AssistantToolExecutionResult => {
  return createFailedToolResult({
    callId: params.callId,
    toolName: params.toolName,
    error: createValidationToolError(params.message),
  });
};

const executeSupportedTool = async (params: {
  abortSignal: AbortSignal;
  context: AssistantContextEnvelope;
  dependencies: AssistantSliceDependencies;
  executionSnapshot: AssistantExecutionSnapshot | null;
  plannedCall: AssistantPlannedToolCall;
  webContentsId: number;
}): Promise<AssistantToolExecutionResult> => {
  if (params.abortSignal.aborted) {
    return createCancelledToolResult({
      callId: params.plannedCall.callId,
      toolName: params.plannedCall.toolName,
    });
  }

  const validated = validateAssistantPlannedCall(params.plannedCall);
  if (!validated.ok) {
    return createFailedToolResult({
      callId: params.plannedCall.callId,
      toolName: params.plannedCall.toolName,
      error: validated.error,
    });
  }

  const createSuccess = (success: AssistantToolSuccess): AssistantToolExecutionResult => {
    return createSuccessResult({
      callId: params.plannedCall.callId,
      toolName: params.plannedCall.toolName,
      output: success.output,
      userSummary: success.userSummary,
    });
  };

  const readResult = async <T>(
    resultAsync: ResultAsync<T, DomainError>,
  ): Promise<T | AssistantToolExecutionResult> => {
    const resolved = await resultAsync;
    if (resolved.isErr()) {
      return createFailedToolResult({
        callId: params.plannedCall.callId,
        toolName: params.plannedCall.toolName,
        error: toAssistantToolError(resolved.error),
      });
    }

    return resolved.value;
  };

  switch (validated.definition.name) {
    case "setAgentDraftFields": {
      const requestedEntityId =
        typeof params.plannedCall.input.entityId === "string"
          ? params.plannedCall.input.entityId
          : null;
      if (
        !isCurrentDraftTarget({
          context: params.context,
          entityId: requestedEntityId,
          expectedViewKind: "agentEdit",
        })
      ) {
        return createFailedToolResult({
          callId: params.plannedCall.callId,
          toolName: params.plannedCall.toolName,
          error: createValidationToolError("I can only update the current visible agent draft."),
        });
      }

      const { entityId: _entityId, ...patch } = validated.definition.inputSchema.parse(
        params.plannedCall.input,
      );
      const editorView = await readResult(
        params.dependencies.getAgentEditorView({
          webContentsId: params.webContentsId,
          agentId: params.context.activeEntityId,
        }),
      );
      if ("status" in editorView) {
        return editorView;
      }
      if (params.context.activeEntityId !== null && editorView.agent === null) {
        return createUnavailableCurrentDraftResult({
          callId: params.plannedCall.callId,
          toolName: params.plannedCall.toolName,
          message: "The current visible agent draft is no longer available.",
        });
      }

      const guardMessage = getAgentDraftEditGuardMessage({
        isArchived: editorView.agent?.archived === true,
      });
      if (guardMessage !== null) {
        return createUnavailableCurrentDraftResult({
          callId: params.plannedCall.callId,
          toolName: params.plannedCall.toolName,
          message: guardMessage,
        });
      }

      const appliedFieldLabels = collectAppliedFieldLabels({
        fieldLabels: AGENT_DRAFT_FIELD_LABELS,
        input: patch,
      });

      return createReconcilingResult({
        callId: params.plannedCall.callId,
        toolName: params.plannedCall.toolName,
        output: {
          appliedFieldLabels,
          entityId: params.context.activeEntityId,
          patch,
        },
        userSummary: summarizeDraftPatch({
          appliedFieldLabels,
          entityLabel: "agent",
        }),
      });
    }
    case "setCouncilDraftFields": {
      const requestedEntityId =
        typeof params.plannedCall.input.entityId === "string"
          ? params.plannedCall.input.entityId
          : null;
      if (
        !isCurrentDraftTarget({
          context: params.context,
          entityId: requestedEntityId,
          expectedViewKind: "councilCreate",
        })
      ) {
        return createFailedToolResult({
          callId: params.plannedCall.callId,
          toolName: params.plannedCall.toolName,
          error: createValidationToolError("I can only update the current visible council draft."),
        });
      }

      const { entityId: _entityId, ...patch } = validated.definition.inputSchema.parse(
        params.plannedCall.input,
      );
      const editorView = await readResult(
        params.dependencies.getCouncilEditorView({
          webContentsId: params.webContentsId,
          councilId: params.context.activeEntityId,
        }),
      );
      if ("status" in editorView) {
        return editorView;
      }
      if (params.context.activeEntityId !== null && editorView.council === null) {
        return createUnavailableCurrentDraftResult({
          callId: params.plannedCall.callId,
          toolName: params.plannedCall.toolName,
          message: "The current visible council draft is no longer available.",
        });
      }

      const guardMessage = getCouncilDraftEditGuardMessage({
        isArchived: editorView.council?.archived === true,
        isExistingCouncil: editorView.council !== null,
        patch,
      });
      if (guardMessage !== null) {
        return createUnavailableCurrentDraftResult({
          callId: params.plannedCall.callId,
          toolName: params.plannedCall.toolName,
          message: guardMessage,
        });
      }

      const appliedFieldLabels = collectAppliedFieldLabels({
        fieldLabels: COUNCIL_DRAFT_FIELD_LABELS,
        input: patch,
      });

      return createReconcilingResult({
        callId: params.plannedCall.callId,
        toolName: params.plannedCall.toolName,
        output: {
          appliedFieldLabels,
          entityId: params.context.activeEntityId,
          patch,
        },
        userSummary: summarizeDraftPatch({
          appliedFieldLabels,
          entityLabel: "council",
        }),
      });
    }
    case "saveAgentDraft": {
      const requestedEntityId =
        typeof params.plannedCall.input.entityId === "string"
          ? params.plannedCall.input.entityId
          : null;
      if (
        !isCurrentDraftTarget({
          context: params.context,
          entityId: requestedEntityId,
          expectedViewKind: "agentEdit",
        })
      ) {
        return createFailedToolResult({
          callId: params.plannedCall.callId,
          toolName: params.plannedCall.toolName,
          error: createValidationToolError("I can only save the current visible agent draft."),
        });
      }

      const editorView = await readResult(
        params.dependencies.getAgentEditorView({
          webContentsId: params.webContentsId,
          agentId: params.context.activeEntityId,
        }),
      );
      if ("status" in editorView) {
        return editorView;
      }

      const guardMessage = getAgentDraftEditGuardMessage({
        isArchived: editorView.agent?.archived === true,
      });
      if (guardMessage !== null) {
        return createUnavailableCurrentDraftResult({
          callId: params.plannedCall.callId,
          toolName: params.plannedCall.toolName,
          message: guardMessage,
        });
      }

      const parsedDraft = parseAssistantAgentDraftForSave(params.executionSnapshot);
      if (!parsedDraft.ok) {
        return createFailedToolResult({
          callId: params.plannedCall.callId,
          toolName: params.plannedCall.toolName,
          error: createValidationToolError(parsedDraft.message),
        });
      }

      const response = await readResult(
        params.dependencies.saveAgent({
          webContentsId: params.webContentsId,
          draft: parsedDraft.draft,
        }),
      );
      if ("status" in response) {
        return response;
      }

      return createReconcilingResult({
        callId: params.plannedCall.callId,
        toolName: params.plannedCall.toolName,
        output: {
          agentId: response.agent.id,
          agentName: response.agent.name,
          savedFields: toSavedAgentFields(response.agent),
        },
        userSummary: `Saved ${response.agent.name}.`,
      });
    }
    case "saveCouncilDraft": {
      const requestedEntityId =
        typeof params.plannedCall.input.entityId === "string"
          ? params.plannedCall.input.entityId
          : null;
      if (
        !isCurrentDraftTarget({
          context: params.context,
          entityId: requestedEntityId,
          expectedViewKind: "councilCreate",
        })
      ) {
        return createFailedToolResult({
          callId: params.plannedCall.callId,
          toolName: params.plannedCall.toolName,
          error: createValidationToolError("I can only save the current visible council draft."),
        });
      }

      const editorView = await readResult(
        params.dependencies.getCouncilEditorView({
          webContentsId: params.webContentsId,
          councilId: params.context.activeEntityId,
        }),
      );
      if ("status" in editorView) {
        return editorView;
      }

      const guardMessage = getCouncilDraftEditGuardMessage({
        isArchived: editorView.council?.archived === true,
        isExistingCouncil: editorView.council !== null,
        patch: {},
      });
      if (guardMessage !== null) {
        return createUnavailableCurrentDraftResult({
          callId: params.plannedCall.callId,
          toolName: params.plannedCall.toolName,
          message: guardMessage,
        });
      }

      const parsedDraft = parseAssistantCouncilDraftForSave(params.executionSnapshot);
      if (!parsedDraft.ok) {
        return createFailedToolResult({
          callId: params.plannedCall.callId,
          toolName: params.plannedCall.toolName,
          error: createValidationToolError(parsedDraft.message),
        });
      }

      const response = await readResult(
        params.dependencies.saveCouncil({
          webContentsId: params.webContentsId,
          draft: parsedDraft.draft,
        }),
      );
      if ("status" in response) {
        return response;
      }

      return createReconcilingResult({
        callId: params.plannedCall.callId,
        toolName: params.plannedCall.toolName,
        output: {
          councilId: response.council.id,
          councilTitle: response.council.title,
          savedFields: toSavedCouncilFields(response.council),
        },
        userSummary: `Saved ${response.council.title}.`,
      });
    }
    case "createAgent": {
      const response = await readResult(
        params.dependencies.saveAgent({
          webContentsId: params.webContentsId,
          draft: {
            viewKind: "agentEdit",
            id: null,
            name: params.plannedCall.input.name as string,
            systemPrompt: params.plannedCall.input.systemPrompt as string,
            verbosity: (params.plannedCall.input.verbosity as string | null | undefined) ?? null,
            temperature:
              (params.plannedCall.input.temperature as number | null | undefined) ?? null,
            tags: (params.plannedCall.input.tags as ReadonlyArray<string> | undefined) ?? [],
            modelRefOrNull:
              (params.plannedCall.input.modelRefOrNull as
                | SaveAgentRequest["modelRefOrNull"]
                | undefined) ?? null,
          },
        }),
      );
      if ("status" in response) {
        return response;
      }

      return createReconcilingResult({
        callId: params.plannedCall.callId,
        toolName: params.plannedCall.toolName,
        output: {
          agentId: response.agent.id,
          agentName: response.agent.name,
          savedFields: toSavedAgentFields(response.agent),
        },
        userSummary: `Created ${response.agent.name}.`,
      });
    }
    case "createCouncil": {
      const response = await readResult(
        params.dependencies.saveCouncil({
          webContentsId: params.webContentsId,
          draft: {
            viewKind: "councilCreate",
            id: null,
            title: params.plannedCall.input.title as string,
            topic: params.plannedCall.input.topic as string,
            goal: (params.plannedCall.input.goal as string | null | undefined) ?? null,
            mode:
              (params.plannedCall.input.mode as SaveCouncilRequest["mode"] | undefined) ?? "manual",
            tags: (params.plannedCall.input.tags as ReadonlyArray<string> | undefined) ?? [],
            memberAgentIds: params.plannedCall.input.memberAgentIds as ReadonlyArray<string>,
            memberColorsByAgentId: {},
            conductorModelRefOrNull:
              (params.plannedCall.input.conductorModelRefOrNull as
                | SaveCouncilRequest["conductorModelRefOrNull"]
                | undefined) ?? null,
          },
        }),
      );
      if ("status" in response) {
        return response;
      }

      return createReconcilingResult({
        callId: params.plannedCall.callId,
        toolName: params.plannedCall.toolName,
        output: {
          councilId: response.council.id,
          councilTitle: response.council.title,
          savedFields: toSavedCouncilFields(response.council),
        },
        userSummary: `Created ${response.council.title}.`,
      });
    }
    case "updateAgent": {
      const parsedInput = validated.definition.inputSchema.parse(params.plannedCall.input);
      const existing = await readResult(
        params.dependencies.getAgentEditorView({
          webContentsId: params.webContentsId,
          agentId: parsedInput.agentId,
        }),
      );
      if ("status" in existing) {
        return existing;
      }
      if (existing.agent === null) {
        return createFailedToolResult({
          callId: params.plannedCall.callId,
          toolName: params.plannedCall.toolName,
          error: createValidationToolError("I could not find that agent."),
        });
      }

      const response = await readResult(
        params.dependencies.saveAgent({
          webContentsId: params.webContentsId,
          draft: {
            viewKind: "agentEdit",
            id: existing.agent.id,
            name: parsedInput.name ?? existing.agent.name,
            systemPrompt: parsedInput.systemPrompt ?? existing.agent.systemPrompt,
            verbosity:
              parsedInput.verbosity === undefined
                ? existing.agent.verbosity
                : parsedInput.verbosity,
            temperature:
              parsedInput.temperature === undefined
                ? existing.agent.temperature
                : parsedInput.temperature,
            tags: parsedInput.tags ?? existing.agent.tags,
            modelRefOrNull:
              parsedInput.modelRefOrNull === undefined
                ? existing.agent.modelRefOrNull
                : parsedInput.modelRefOrNull,
          },
        }),
      );
      if ("status" in response) {
        return response;
      }

      return createReconcilingResult({
        callId: params.plannedCall.callId,
        toolName: params.plannedCall.toolName,
        output: {
          agentId: response.agent.id,
          agentName: response.agent.name,
          savedFields: toSavedAgentFields(response.agent),
        },
        userSummary: `Updated ${response.agent.name}.`,
      });
    }
    case "updateCouncilConfig": {
      const parsedInput = validated.definition.inputSchema.parse(params.plannedCall.input);
      const existing = await readResult(
        params.dependencies.getCouncilEditorView({
          webContentsId: params.webContentsId,
          councilId: parsedInput.councilId,
        }),
      );
      if ("status" in existing) {
        return existing;
      }
      if (existing.council === null) {
        return createFailedToolResult({
          callId: params.plannedCall.callId,
          toolName: params.plannedCall.toolName,
          error: createValidationToolError("I could not find that council."),
        });
      }

      const response = await readResult(
        params.dependencies.saveCouncil({
          webContentsId: params.webContentsId,
          draft: {
            viewKind: "councilView",
            id: existing.council.id,
            title: parsedInput.title ?? existing.council.title,
            topic: parsedInput.topic ?? existing.council.topic,
            goal: parsedInput.goal === undefined ? existing.council.goal : parsedInput.goal,
            mode: parsedInput.mode ?? existing.council.mode,
            tags: parsedInput.tags ?? existing.council.tags,
            memberAgentIds: parsedInput.memberAgentIds ?? existing.council.memberAgentIds,
            memberColorsByAgentId: existing.council.memberColorsByAgentId,
            conductorModelRefOrNull:
              parsedInput.conductorModelRefOrNull === undefined
                ? existing.council.conductorModelRefOrNull
                : parsedInput.conductorModelRefOrNull,
          },
        }),
      );
      if ("status" in response) {
        return response;
      }

      return createReconcilingResult({
        callId: params.plannedCall.callId,
        toolName: params.plannedCall.toolName,
        output: {
          councilId: response.council.id,
          councilTitle: response.council.title,
          savedFields: toSavedCouncilFields(response.council),
        },
        userSummary: `Updated ${response.council.title}.`,
      });
    }
    case "navigateToHomeTab": {
      const tab = params.plannedCall.input.tab;
      return createReconcilingResult({
        callId: params.plannedCall.callId,
        toolName: params.plannedCall.toolName,
        output: { tab },
        userSummary:
          tab === "settings"
            ? "Opened Home / Settings."
            : `Opened Home / ${tab === "agentsList" ? "Agents" : "Councils"}.`,
      });
    }
    case "openAgentEditor": {
      const response = await readResult(
        params.dependencies.getAgentEditorView({
          webContentsId: params.webContentsId,
          agentId: params.plannedCall.input.agentId as string,
        }),
      );
      if ("status" in response) {
        return response;
      }
      if (response.agent === null) {
        return createFailedToolResult({
          callId: params.plannedCall.callId,
          toolName: params.plannedCall.toolName,
          error: createValidationToolError("I could not find that agent."),
        });
      }
      return createReconcilingResult({
        callId: params.plannedCall.callId,
        toolName: params.plannedCall.toolName,
        output: {
          agentId: response.agent.id,
          agentName: response.agent.name,
        },
        userSummary: `Opened agent editor for ${response.agent.name}.`,
      });
    }
    case "openCouncilEditor": {
      const response = await readResult(
        params.dependencies.getCouncilEditorView({
          webContentsId: params.webContentsId,
          councilId: params.plannedCall.input.councilId as string,
        }),
      );
      if ("status" in response) {
        return response;
      }
      if (response.council === null) {
        return createFailedToolResult({
          callId: params.plannedCall.callId,
          toolName: params.plannedCall.toolName,
          error: createValidationToolError("I could not find that council."),
        });
      }
      return createReconcilingResult({
        callId: params.plannedCall.callId,
        toolName: params.plannedCall.toolName,
        output: {
          councilId: response.council.id,
          councilTitle: response.council.title,
        },
        userSummary: `Opened council editor for ${response.council.title}.`,
      });
    }
    case "openCouncilView": {
      const response = await readResult(
        params.dependencies.getCouncilView({
          webContentsId: params.webContentsId,
          councilId: params.plannedCall.input.councilId as string,
        }),
      );
      if ("status" in response) {
        return response;
      }
      return createReconcilingResult({
        callId: params.plannedCall.callId,
        toolName: params.plannedCall.toolName,
        output: {
          councilId: response.council.id,
          councilTitle: response.council.title,
        },
        userSummary: `Opened council view for ${response.council.title}.`,
      });
    }
    case "listAgents": {
      const query = resolveAgentListQuery({
        context: params.context,
        input: params.plannedCall.input,
      });
      const response = await readResult(
        params.dependencies.listAgents({
          webContentsId: params.webContentsId,
          page: 1,
          ...query,
        }),
      );
      if ("status" in response) {
        return response;
      }
      const items = response.items.slice(0, 10).map((agent) => ({
        archived: agent.archived,
        id: agent.id,
        invalidConfig: agent.invalidConfig,
        name: agent.name,
        tags: agent.tags,
      }));
      return createSuccess({
        output: {
          archivedFilter: query.archivedFilter,
          searchText: query.searchText,
          tagFilter: query.tagFilter,
          total: response.total,
          items,
        },
        userSummary:
          response.total === 0
            ? "No agents matched that query."
            : `Found ${String(response.total)} agent(s): ${formatEntityList(items.map((item) => item.name))}.`,
      });
    }
    case "listCouncils": {
      const query = resolveCouncilListQuery({
        context: params.context,
        input: params.plannedCall.input,
      });
      const response = await readResult(
        params.dependencies.listCouncils({
          webContentsId: params.webContentsId,
          page: 1,
          ...query,
        }),
      );
      if ("status" in response) {
        return response;
      }
      const items = response.items.slice(0, 10).map((council) => ({
        archived: council.archived,
        id: council.id,
        invalidConfig: council.invalidConfig,
        mode: council.mode,
        title: council.title,
      }));
      return createSuccess({
        output: {
          archivedFilter: query.archivedFilter,
          searchText: query.searchText,
          tagFilter: query.tagFilter,
          total: response.total,
          items,
        },
        userSummary:
          response.total === 0
            ? "No councils matched that query."
            : `Found ${String(response.total)} council(s): ${formatEntityList(items.map((item) => item.title))}.`,
      });
    }
    case "getAgent": {
      const agentId = resolveAgentId({
        context: params.context,
        input: params.plannedCall.input,
      });
      if (agentId === null) {
        return createFailedToolResult({
          callId: params.plannedCall.callId,
          toolName: params.plannedCall.toolName,
          error: createValidationToolError("I need an agent to inspect first."),
        });
      }
      const response = await readResult(
        params.dependencies.getAgentEditorView({
          webContentsId: params.webContentsId,
          agentId,
        }),
      );
      if ("status" in response) {
        return response;
      }
      if (response.agent === null) {
        return createFailedToolResult({
          callId: params.plannedCall.callId,
          toolName: params.plannedCall.toolName,
          error: createValidationToolError("I could not find that agent."),
        });
      }
      return createSuccess({
        output: {
          agentId: response.agent.id,
          archived: response.agent.archived,
          invalidConfig: response.agent.invalidConfig,
          modelRefLabel: modelRefToLabel(response.agent.modelRefOrNull),
          name: response.agent.name,
          tags: response.agent.tags,
          temperature: response.agent.temperature,
          verbosity: response.agent.verbosity,
        },
        userSummary: `${response.agent.name} has ${response.agent.tags.length} tag(s) and ${response.agent.invalidConfig ? "needs model configuration" : "has a valid model configuration"}.`,
      });
    }
    case "getCouncil": {
      const councilId = resolveCouncilId({
        context: params.context,
        input: params.plannedCall.input,
      });
      if (councilId === null) {
        return createFailedToolResult({
          callId: params.plannedCall.callId,
          toolName: params.plannedCall.toolName,
          error: createValidationToolError("I need a council to inspect first."),
        });
      }
      const response = await readResult(
        params.dependencies.getCouncilEditorView({
          webContentsId: params.webContentsId,
          councilId,
        }),
      );
      if ("status" in response) {
        return response;
      }
      if (response.council === null) {
        return createFailedToolResult({
          callId: params.plannedCall.callId,
          toolName: params.plannedCall.toolName,
          error: createValidationToolError("I could not find that council."),
        });
      }
      return createSuccess({
        output: {
          archived: response.council.archived,
          councilId: response.council.id,
          invalidConfig: response.council.invalidConfig,
          memberCount: response.council.memberAgentIds.length,
          mode: response.council.mode,
          paused: response.council.paused,
          started: response.council.started,
          title: response.council.title,
          turnCount: response.council.turnCount,
        },
        userSummary: `${response.council.title} has ${String(response.council.memberAgentIds.length)} member(s) and ${response.council.turnCount} turn(s).`,
      });
    }
    case "getCouncilRuntimeState": {
      const councilId = resolveCouncilId({
        context: params.context,
        input: params.plannedCall.input,
      });
      if (councilId === null) {
        return createFailedToolResult({
          callId: params.plannedCall.callId,
          toolName: params.plannedCall.toolName,
          error: createValidationToolError("I need a council to inspect first."),
        });
      }
      const response = await readResult(
        params.dependencies.getCouncilView({
          webContentsId: params.webContentsId,
          councilId,
        }),
      );
      if ("status" in response) {
        return response;
      }
      const runtimeStatus = response.council.started
        ? response.council.paused
          ? "paused"
          : "running"
        : "idle";
      return createSuccess({
        output: {
          councilId: response.council.id,
          councilTitle: response.council.title,
          messageCount: response.messages.length,
          paused: response.council.paused,
          plannedNextSpeakerAgentId: response.generation.plannedNextSpeakerAgentId,
          runtimeStatus,
          started: response.council.started,
          turnCount: response.council.turnCount,
        },
        userSummary: `${response.council.title} is ${runtimeStatus} with ${response.council.turnCount} turn(s) and ${response.messages.length} message(s).`,
      });
    }
    default:
      return createFailedToolResult({
        callId: params.plannedCall.callId,
        toolName: params.plannedCall.toolName,
        error: {
          kind: "UnknownToolError",
          userMessage: "That assistant action is not available yet.",
          developerMessage: `Unsupported assistant tool: ${validated.definition.name}`,
          retryable: false,
          details: null,
        },
      });
  }
};

export const createAssistantSlice = (dependencies: AssistantSliceDependencies): AssistantSlice => {
  const sessions = new Map<string, AssistantSessionRecord>();
  let nextExecutionId = 0;

  const withSession = (sessionId: string): AssistantSessionRecord | null => {
    return sessions.get(sessionId) ?? null;
  };

  const clearPendingPlan = (record: AssistantSessionRecord): void => {
    record.pendingPlan = null;
  };

  const clearPendingClarification = (record: AssistantSessionRecord): void => {
    record.pendingClarification = null;
  };

  const clearPendingReconciliation = (record: AssistantSessionRecord): void => {
    record.pendingReconciliation = null;
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

  const executePendingPlan = (params: {
    abortController: AbortController;
    context: AssistantContextEnvelope;
    executionSnapshot: AssistantExecutionSnapshot | null;
    record: AssistantSessionRecord;
    sessionId: string;
    webContentsId: number;
  }): ResultAsync<AssistantSubmitResponse, DomainError> => {
    return ResultAsync.fromPromise(
      (async () => {
        const executionResults: Array<AssistantToolExecutionResult> = [];
        const pendingPlan = params.record.pendingPlan;
        let executionSnapshot = params.executionSnapshot;
        clearPendingPlan(params.record);

        if (pendingPlan === null) {
          return {
            result: createPlaceholderResult(
              params.sessionId,
              "There is no assistant plan ready to execute.",
            ),
          };
        }

        dependencies.auditService.record({
          eventType: "execution-started",
          sessionId: params.sessionId,
          occurredAtUtc: dependencies.nowUtc(),
          payload: {
            plannedCalls: pendingPlan.plannedCalls,
            planSummary: pendingPlan.planSummary,
          },
        });

        for (const plannedCall of pendingPlan.plannedCalls) {
          if (params.abortController.signal.aborted || params.record.closedAtUtc !== null) {
            executionResults.push(
              createCancelledToolResult({
                callId: plannedCall.callId,
                toolName: plannedCall.toolName,
              }),
            );
            break;
          }

          const result = await executeSupportedTool({
            abortSignal: params.abortController.signal,
            context: params.context,
            dependencies,
            executionSnapshot,
            plannedCall,
            webContentsId: params.webContentsId,
          });
          executionResults.push(result);

          if (result.status === "success" || result.status === "reconciling") {
            executionSnapshot = applyExecutionSnapshotPatch({
              executionSnapshot,
              plannedCall,
            });
          }

          if (result.status !== "success") {
            if (result.status === "reconciling") {
              continue;
            }
            break;
          }
        }

        if (executionResults.some((result) => result.status === "reconciling")) {
          params.record.pendingReconciliation = {
            executionResults,
          };

          return {
            result: createPendingReconciliationResult({
              sessionId: params.sessionId,
              executionResults,
            }),
          };
        }

        const finalResult = (
          params.abortController.signal.aborted
            ? createCancelledResult({
                sessionId: params.sessionId,
                executionResults,
              })
            : toFinalPlanResult({
                sessionId: params.sessionId,
                executionResults,
              })
        ) as Extract<AssistantPlanResult, { kind: "result" }>;

        dependencies.auditService.record({
          eventType: "execution-finished",
          sessionId: params.sessionId,
          occurredAtUtc: dependencies.nowUtc(),
          payload: {
            executionResults,
            outcome: finalResult.outcome,
          },
        });

        return { result: finalResult };
      })(),
      (error) => ({
        kind: "InternalError",
        devMessage: error instanceof Error ? error.message : "Unknown assistant execution failure",
        userMessage: "Assistant execution could not complete safely.",
      }),
    );
  };

  const planAssistantRequest = (params: {
    abortController: AbortController;
    context: AssistantContextEnvelope;
    record: AssistantSessionRecord;
    request: AssistantSubmitRequest;
    sessionId: string;
    webContentsId: number;
  }): ResultAsync<AssistantSubmitResponse, DomainError> => {
    return dependencies
      .getSettingsView({
        webContentsId: params.webContentsId,
        viewKind: params.record.session.viewKind,
      })
      .andThen((settingsView) => {
        if (
          settingsView.globalDefaultModelRef === null ||
          settingsView.globalDefaultModelInvalidConfig
        ) {
          clearPendingPlan(params.record);
          clearPendingClarification(params.record);
          clearPendingReconciliation(params.record);
          return okAsync<AssistantSubmitResponse, DomainError>({
            result: createInvalidConfigResult({
              sessionId: params.sessionId,
              userMessage: "Assistant needs a valid global default model before it can plan.",
              developerMessage:
                settingsView.globalDefaultModelRef === null
                  ? "Assistant planning blocked because the global default model is not configured."
                  : "Assistant planning blocked because the global default model is invalid for the current catalog.",
            }),
          });
        }

        const pendingClarification = params.record.pendingClarification;
        if (
          pendingClarification?.kind === "openCouncilView" &&
          params.request.response?.kind === "clarification"
        ) {
          const clarificationText = params.request.response.text.trim();
          if (clarificationText.length === 0) {
            return okAsync({
              result: attachAssistantSessionToPlanResult({
                sessionId: params.sessionId,
                plannerResponse: {
                  kind: "clarify",
                  question: "Please provide the council name or ID to open.",
                },
              }),
            });
          }

          return dependencies
            .listCouncils({
              webContentsId: params.webContentsId,
              ...DEFAULT_COUNCIL_QUERY,
              page: 1,
              searchText: clarificationText,
            })
            .map((councils) => {
              const normalizedClarification = normalizeClarificationText(clarificationText);
              const exactMatches = councils.items.filter(
                (council) =>
                  normalizeClarificationText(council.id) === normalizedClarification ||
                  normalizeClarificationText(council.title) === normalizedClarification,
              );
              const matchedCouncil =
                exactMatches.length === 1
                  ? (exactMatches[0] ?? null)
                  : exactMatches.length === 0 && councils.items.length === 1
                    ? (councils.items[0] ?? null)
                    : null;

              if (matchedCouncil === null) {
                params.record.pendingPlan = null;
                params.record.pendingClarification = pendingClarification;
                return {
                  result: attachAssistantSessionToPlanResult({
                    sessionId: params.sessionId,
                    plannerResponse: {
                      kind: "clarify",
                      question: "I still need the exact council name or ID to open.",
                    },
                  }),
                };
              }

              const plannedCalls: ReadonlyArray<AssistantPlannedToolCall> = [
                {
                  callId: `open-council-view-${params.sessionId}`,
                  toolName: "openCouncilView",
                  rationale: "Open the council identified by the clarification.",
                  input: {
                    councilId: matchedCouncil.id,
                  },
                },
              ];

              const finalizedPlan = finalizePlannedDirective({
                context: params.context,
                plannedCalls,
                preferConfirmation: false,
                sessionId: params.sessionId,
                summary: `Open ${matchedCouncil.title}.`,
              });
              params.record.pendingPlan = {
                kind: finalizedPlan.kind,
                planSummary: finalizedPlan.planSummary,
                plannedCalls: finalizedPlan.plannedCalls,
              };
              clearPendingClarification(params.record);

              return {
                result: finalizedPlan,
              };
            });
        }

        if (
          params.request.response === null &&
          matchesCurrentCouncilRuntimeStatusRequest({
            context: params.context,
            userRequest: params.request.userRequest,
          })
        ) {
          const plannedCalls: ReadonlyArray<AssistantPlannedToolCall> = [
            {
              callId: `get-council-runtime-state-${params.sessionId}`,
              toolName: "getCouncilRuntimeState",
              rationale: "Read the current runtime status for the open council.",
              input: {
                councilId: params.context.activeEntityId,
              },
            },
          ];

          const finalizedPlan = finalizePlannedDirective({
            context: params.context,
            plannedCalls,
            preferConfirmation: false,
            sessionId: params.sessionId,
            summary: "Check the current council runtime status.",
          });
          params.record.pendingPlan = {
            kind: finalizedPlan.kind,
            planSummary: finalizedPlan.planSummary,
            plannedCalls: finalizedPlan.plannedCalls,
          };
          clearPendingClarification(params.record);

          return okAsync({
            result: finalizedPlan,
          });
        }

        if (params.request.response === null) {
          const shortcutPlan = tryBuildAssistantPlannerShortcut({
            context: params.context,
            sessionId: params.sessionId,
            userRequest: params.request.userRequest,
          });
          if (shortcutPlan !== null) {
            const finalizedPlan = finalizePlannedDirective({
              context: params.context,
              plannedCalls: shortcutPlan.plannedCalls,
              preferConfirmation: false,
              sessionId: params.sessionId,
              summary: shortcutPlan.summary,
            });
            params.record.pendingPlan = {
              kind: finalizedPlan.kind,
              planSummary: finalizedPlan.planSummary,
              plannedCalls: finalizedPlan.plannedCalls,
            };
            clearPendingClarification(params.record);

            return okAsync({
              result: finalizedPlan,
            });
          }
        }

        const prompt = buildAssistantPlannerPrompt({
          userRequest: params.request.userRequest,
          response: params.request.response,
          context: params.context,
          tools: ASSISTANT_TOOL_DEFINITIONS,
        });

        if (
          dependencies.planAssistantResponse === undefined ||
          ASSISTANT_TOOL_DEFINITIONS.length === 0
        ) {
          clearPendingPlan(params.record);
          clearPendingClarification(params.record);
          return okAsync<AssistantSubmitResponse, DomainError>({
            result: createPlaceholderResult(
              params.sessionId,
              "Assistant planning foundation is registered, but no assistant tools are enabled yet.",
            ),
          });
        }

        return dependencies
          .planAssistantResponse(
            {
              sessionId: params.sessionId,
              webContentsId: params.webContentsId,
              modelRef: settingsView.globalDefaultModelRef,
              prompt,
              userRequest: params.request.userRequest,
              context: params.context,
              response: params.request.response,
            },
            params.abortController.signal,
          )
          .map((rawPlannerResponse) => {
            if (params.abortController.signal.aborted || params.record.closedAtUtc !== null) {
              clearPendingPlan(params.record);
              clearPendingClarification(params.record);
              return { result: createCancelledResult({ sessionId: params.sessionId }) };
            }

            const parsed = parseAssistantPlannerResponse(rawPlannerResponse);
            if (parsed === null) {
              clearPendingPlan(params.record);
              clearPendingClarification(params.record);
              return {
                result: createPlaceholderResult(
                  params.sessionId,
                  "Assistant planner returned an invalid structured response.",
                ),
              };
            }

            switch (parsed.kind) {
              case "clarify":
                clearPendingPlan(params.record);
                params.record.pendingClarification = matchesOpenCouncilClarification({
                  context: params.context,
                  question: parsed.question,
                  userRequest: params.request.userRequest,
                })
                  ? {
                      kind: "openCouncilView",
                      originalRequest: params.request.userRequest,
                    }
                  : null;
                break;
              case "confirm": {
                const finalizedPlan = finalizePlannedDirective({
                  context: params.context,
                  plannedCalls: parsed.plannedCalls,
                  preferConfirmation: true,
                  sessionId: params.sessionId,
                  summary: parsed.summary,
                });
                clearPendingClarification(params.record);
                params.record.pendingPlan = {
                  kind: finalizedPlan.kind,
                  planSummary: finalizedPlan.planSummary,
                  plannedCalls: finalizedPlan.plannedCalls,
                };
                break;
              }
              case "execute": {
                const finalizedPlan = finalizePlannedDirective({
                  context: params.context,
                  plannedCalls: parsed.plannedCalls,
                  preferConfirmation: false,
                  sessionId: params.sessionId,
                  summary: parsed.summary,
                });
                clearPendingClarification(params.record);
                params.record.pendingPlan = {
                  kind: finalizedPlan.kind,
                  planSummary: finalizedPlan.planSummary,
                  plannedCalls: finalizedPlan.plannedCalls,
                };
                break;
              }
            }

            dependencies.auditService.record({
              eventType: "planner-returned",
              sessionId: params.sessionId,
              occurredAtUtc: dependencies.nowUtc(),
              payload: {
                plannerKind: parsed.kind,
                plannedCalls: "plannedCalls" in parsed ? parsed.plannedCalls : [],
              },
            });

            if (parsed.kind === "clarify") {
              return {
                result: attachAssistantSessionToPlanResult({
                  sessionId: params.sessionId,
                  plannerResponse: parsed,
                }),
              };
            }

            return {
              result: finalizePlannedDirective({
                context: params.context,
                plannedCalls: parsed.plannedCalls,
                preferConfirmation: parsed.kind === "confirm",
                sessionId: params.sessionId,
                summary: parsed.summary,
              }),
            };
          })
          .orElse(() => {
            clearPendingPlan(params.record);
            clearPendingClarification(params.record);
            if (params.abortController.signal.aborted || params.record.closedAtUtc !== null) {
              return okAsync({ result: createCancelledResult({ sessionId: params.sessionId }) });
            }

            return okAsync({
              result: createPlaceholderResult(
                params.sessionId,
                "Assistant planning could not complete safely.",
              ),
            });
          });
      });
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
      pendingPlan: null,
      pendingClarification: null,
      pendingReconciliation: null,
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

    if (request.response?.kind === "confirmation" && record.pendingPlan === null) {
      return okAsync({ result: createUnexpectedConfirmationResult(request.sessionId) });
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

    const operation =
      record.pendingPlan?.kind === "execute" && request.response === null
        ? executePendingPlan({
            abortController,
            context: sanitizedContext,
            executionSnapshot: request.executionSnapshot ?? null,
            record,
            sessionId: request.sessionId,
            webContentsId,
          })
        : record.pendingPlan?.kind === "confirm" && request.response?.kind === "confirmation"
          ? request.response.approved
            ? executePendingPlan({
                abortController,
                context: sanitizedContext,
                executionSnapshot: request.executionSnapshot ?? null,
                record,
                sessionId: request.sessionId,
                webContentsId,
              })
            : okAsync({ result: createRejectedConfirmationResult(request.sessionId) }).map(
                (response) => {
                  clearPendingPlan(record);
                  clearPendingClarification(record);
                  return response;
                },
              )
          : planAssistantRequest({
              abortController,
              context: sanitizedContext,
              record,
              request,
              sessionId: request.sessionId,
              webContentsId,
            });

    return operation
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

  const completeReconciliation: AssistantSlice["completeReconciliation"] = ({
    webContentsId,
    request,
  }) => {
    const record = withSession(request.sessionId);
    if (record === null || record.webContentsId !== webContentsId || record.closedAtUtc !== null) {
      return okAsync({ result: createMissingSessionResult(request.sessionId) });
    }

    const pendingReconciliation = record.pendingReconciliation;
    if (pendingReconciliation === null) {
      return okAsync({
        result: createPlaceholderResult(
          request.sessionId,
          "There is no assistant reconciliation waiting for visible confirmation.",
        ),
      });
    }

    const acknowledgements = new Map(
      request.reconciliations.map((reconciliation) => [
        `${reconciliation.callId}:${reconciliation.toolName}`,
        reconciliation,
      ]),
    );

    const finalizedResults: ReadonlyArray<AssistantToolExecutionResult> =
      pendingReconciliation.executionResults.map((result) => {
        if (result.status !== "reconciling") {
          return result;
        }

        const acknowledgement = acknowledgements.get(`${result.callId}:${result.toolName}`);
        if (acknowledgement === undefined) {
          return createFailedToolResult({
            callId: result.callId,
            toolName: result.toolName,
            error: {
              kind: "StateViolationError",
              userMessage: "The requested destination never became visible.",
              developerMessage: `Missing reconciliation acknowledgement for ${result.toolName}:${result.callId}.`,
              retryable: false,
              details: null,
            },
          });
        }

        if (acknowledgement.status === "failed") {
          const failureMessage =
            acknowledgement.failureMessage ?? "The requested destination never became visible.";
          return createFailedToolResult({
            callId: result.callId,
            toolName: result.toolName,
            error: {
              kind: "StateViolationError",
              userMessage: failureMessage,
              developerMessage: failureMessage,
              retryable: false,
              details: null,
            },
          });
        }

        const definition = getAssistantToolDefinition(result.toolName);
        if (definition === null) {
          return createFailedToolResult({
            callId: result.callId,
            toolName: result.toolName,
            error: {
              kind: "UnknownToolError",
              userMessage: "That assistant action is not available yet.",
              developerMessage: `Unknown assistant tool: ${result.toolName}`,
              retryable: false,
              details: null,
            },
          });
        }

        const completedOutput = acknowledgement.completion?.output ?? result.output;
        const parsedOutput = definition.outputSchema.safeParse(completedOutput);
        if (!parsedOutput.success) {
          return createFailedToolResult({
            callId: result.callId,
            toolName: result.toolName,
            error: {
              kind: "SchemaError",
              userMessage: "The assistant returned an invalid tool result.",
              developerMessage: `Invalid assistant reconciliation output for ${result.toolName}:${result.callId}`,
              retryable: false,
              details: null,
            },
          });
        }

        return {
          ...result,
          output: sanitizeAssistantPayload(parsedOutput.data),
          status: "success" as const,
          userSummary: acknowledgement.completion?.userSummary ?? result.userSummary,
          reconciliationState: "completed" as const,
        };
      });

    clearPendingReconciliation(record);
    clearPendingClarification(record);
    const occurredAtUtc = dependencies.nowUtc();
    record.session.lastUpdatedAtUtc = occurredAtUtc;
    const finalResult = toFinalPlanResult({
      sessionId: request.sessionId,
      executionResults: finalizedResults,
    }) as Extract<AssistantPlanResult, { kind: "result" }>;

    dependencies.auditService.record({
      eventType: "execution-finished",
      sessionId: request.sessionId,
      occurredAtUtc,
      payload: {
        executionResults: finalizedResults,
        outcome: finalResult.outcome,
        reconciliationCompleted: true,
      },
    });

    return okAsync({ result: finalResult });
  };

  const cancelSession: AssistantSlice["cancelSession"] = ({ sessionId, webContentsId }) => {
    const record = withSession(sessionId);
    if (record === null || !isOwnedByWebContents(record, webContentsId)) {
      return okAsync({ cancelled: false });
    }

    const cancelled = cancelActiveWork(record);
    clearPendingReconciliation(record);
    clearPendingClarification(record);
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
    clearPendingPlan(record);
    clearPendingClarification(record);
    clearPendingReconciliation(record);
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
    completeReconciliation,
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
