import { type ResultAsync, errAsync, okAsync } from "neverthrow";
import {
  type ConductorDecision,
  type ConductorOpeningDecision,
  type RuntimeConversationMessage,
  buildAutopilotOpeningPrompt,
  buildConductorDecisionPrompt,
  parseAutopilotOpeningDecision,
  parseConductorDecision,
} from "../../../shared/council-runtime-conductor.js";
import {
  DEFAULT_CONTEXT_LAST_N,
  normalizeContextLastN,
  selectLastNContextMessages,
} from "../../../shared/council-runtime-context-window.js";
import { type DomainError, domainError } from "../../../shared/domain/errors.js";
import {
  type AgentId,
  type CouncilId,
  asAgentId,
  asCouncilId,
} from "../../../shared/domain/ids.js";
import {
  type ModelRef,
  buildAvailableModelKeys,
  isModelConfigInvalid,
} from "../../../shared/domain/model-ref.js";
import { type Tag, addTag } from "../../../shared/domain/tag.js";
import type {
  AdvanceAutopilotTurnResponse,
  CancelCouncilGenerationResponse,
  CouncilAgentOptionDto,
  CouncilDto,
  CouncilGenerationStateDto,
  CouncilMessageDto,
  CouncilRuntimeBriefingDto,
  DeleteCouncilResponse,
  ExportCouncilTranscriptResponse,
  GenerateManualCouncilTurnResponse,
  GetCouncilEditorViewResponse,
  GetCouncilViewResponse,
  InjectConductorMessageResponse,
  ListCouncilsResponse,
  ModelCatalogSnapshotDto,
  PauseCouncilAutopilotResponse,
  RefreshModelCatalogResponse,
  ResumeCouncilAutopilotResponse,
  SaveCouncilRequest,
  SaveCouncilResponse,
  SetCouncilArchivedResponse,
  StartCouncilResponse,
} from "../../../shared/ipc/dto.js";
import type { AiService, ExportService } from "../../services/interfaces.js";

type CouncilMode = "autopilot" | "manual";

type CouncilRecord = {
  id: CouncilId;
  title: string;
  topic: string;
  goal: string | null;
  mode: CouncilMode;
  tags: ReadonlyArray<Tag>;
  memberAgentIds: ReadonlyArray<AgentId>;
  memberColorsByAgentId: Readonly<Record<string, string>>;
  conductorModelRefOrNull: ModelRef | null;
  archivedAtUtc: string | null;
  startedAtUtc: string | null;
  autopilotPaused: boolean;
  autopilotMaxTurns: number | null;
  autopilotTurnsCompleted: number;
  turnCount: number;
  createdAtUtc: string;
  updatedAtUtc: string;
};

type CouncilModelContext = {
  modelCatalog: ModelCatalogSnapshotDto;
  globalDefaultModelRef: ModelRef | null;
  canRefreshModels: boolean;
};

type CouncilMessageRecord = {
  id: string;
  councilId: CouncilId;
  sequenceNumber: number;
  senderKind: "member" | "conductor";
  senderAgentId: AgentId | null;
  senderName: string;
  senderColor: string | null;
  content: string;
  createdAtUtc: string;
};

type CouncilRuntimeBriefingRecord = {
  councilId: CouncilId;
  briefing: string;
  goalReached: boolean;
  updatedAtUtc: string;
};

type InFlightGenerationRecord = {
  requestId: string;
  kind: "manualMemberTurn" | "autopilotStep" | "conductorBriefing" | "autopilotOpening";
  controller: AbortController;
  memberAgentId: AgentId | null;
};

type CouncilsSliceDependencies = {
  nowUtc: () => string;
  createCouncilId: () => CouncilId;
  pageSize: number;
  logger?: {
    info: (component: string, operation: string, context?: Record<string, unknown>) => void;
    error: (
      component: string,
      operation: string,
      error: Error | string,
      context?: Record<string, unknown>,
    ) => void;
  };
  getModelContext: (params: {
    webContentsId: number;
    viewKind: "councilsList" | "councilCreate" | "councilView";
  }) => ResultAsync<CouncilModelContext, DomainError>;
  refreshModelCatalog: (params: {
    webContentsId: number;
    viewKind: "councilsList" | "councilCreate" | "councilView";
  }) => ResultAsync<RefreshModelCatalogResponse, DomainError>;
  listAvailableAgents: (params: {
    webContentsId: number;
    viewKind: "councilCreate" | "councilView";
  }) => ResultAsync<ReadonlyArray<CouncilAgentOptionDto>, DomainError>;
  loadPersistedCouncils?: () => ResultAsync<ReadonlyArray<CouncilRecord>, DomainError>;
  persistCouncil?: (council: CouncilRecord) => ResultAsync<void, DomainError>;
  persistCouncilDeletion?: (councilId: CouncilId) => ResultAsync<void, DomainError>;
  loadCouncilMessages?: (
    councilId: CouncilId,
  ) => ResultAsync<ReadonlyArray<CouncilMessageRecord>, DomainError>;
  appendCouncilMessage?: (
    message: Omit<CouncilMessageRecord, "sequenceNumber">,
  ) => ResultAsync<CouncilMessageRecord, DomainError>;
  loadCouncilRuntimeBriefing?: (
    councilId: CouncilId,
  ) => ResultAsync<CouncilRuntimeBriefingRecord | null, DomainError>;
  persistCouncilRuntimeBriefing?: (
    briefing: CouncilRuntimeBriefingRecord,
  ) => ResultAsync<void, DomainError>;
  aiService: Pick<AiService, "generateText">;
  createMessageId: () => string;
  createGenerationRequestId: () => string;
  getContextLastN?: () => number;
  exportService: Pick<ExportService, "saveMarkdownFile">;
};

type CouncilsSlice = {
  listCouncils: (params: {
    webContentsId: number;
    searchText: string;
    tagFilter: string;
    archivedFilter: "active" | "archived" | "all";
    sortBy: "createdAt" | "updatedAt";
    sortDirection: "asc" | "desc";
    page: number;
  }) => ResultAsync<ListCouncilsResponse, DomainError>;
  getEditorView: (params: {
    webContentsId: number;
    councilId: string | null;
  }) => ResultAsync<GetCouncilEditorViewResponse, DomainError>;
  getCouncilView: (params: {
    webContentsId: number;
    councilId: string;
  }) => ResultAsync<GetCouncilViewResponse, DomainError>;
  saveCouncil: (params: {
    webContentsId: number;
    draft: SaveCouncilRequest;
  }) => ResultAsync<SaveCouncilResponse, DomainError>;
  deleteCouncil: (params: { id: string }) => ResultAsync<DeleteCouncilResponse, DomainError>;
  setArchived: (params: {
    webContentsId: number;
    id: string;
    archived: boolean;
  }) => ResultAsync<SetCouncilArchivedResponse, DomainError>;
  startCouncil: (params: {
    webContentsId: number;
    id: string;
    maxTurns: number | null;
  }) => ResultAsync<StartCouncilResponse, DomainError>;
  pauseCouncilAutopilot: (params: { webContentsId: number; id: string }) => ResultAsync<
    PauseCouncilAutopilotResponse,
    DomainError
  >;
  resumeCouncilAutopilot: (params: {
    webContentsId: number;
    id: string;
    maxTurns: number | null;
  }) => ResultAsync<ResumeCouncilAutopilotResponse, DomainError>;
  generateManualTurn: (params: {
    webContentsId: number;
    id: string;
    memberAgentId: string;
  }) => ResultAsync<GenerateManualCouncilTurnResponse, DomainError>;
  injectConductorMessage: (params: {
    webContentsId: number;
    id: string;
    content: string;
  }) => ResultAsync<InjectConductorMessageResponse, DomainError>;
  advanceAutopilotTurn: (params: {
    webContentsId: number;
    id: string;
  }) => ResultAsync<AdvanceAutopilotTurnResponse, DomainError>;
  cancelGeneration: (params: { id: string }) => ResultAsync<
    CancelCouncilGenerationResponse,
    DomainError
  >;
  exportTranscript: (params: {
    webContentsId: number;
    id: string;
  }) => ResultAsync<ExportCouncilTranscriptResponse, DomainError>;
  countCouncilsUsingAgent: (agentId: AgentId) => ResultAsync<number, DomainError>;
  refreshModelCatalog: (params: {
    webContentsId: number;
    viewKind: "councilsList" | "councilCreate" | "councilView";
  }) => ResultAsync<RefreshModelCatalogResponse, DomainError>;
};

const validationError = (devMessage: string, userMessage: string): DomainError =>
  domainError("ValidationError", devMessage, userMessage);

const notFoundError = (devMessage: string, userMessage: string): DomainError =>
  domainError("NotFoundError", devMessage, userMessage);

const stateError = (devMessage: string, userMessage: string): DomainError =>
  domainError("StateViolationError", devMessage, userMessage);

const normalizeNullable = (value: string | null): string | null => {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const normalizeAutopilotMaxTurns = (maxTurns: number | null): number | null => {
  if (maxTurns === null) {
    return null;
  }

  return Number.isInteger(maxTurns) && maxTurns >= 1 && maxTurns <= 200 ? maxTurns : null;
};

const normalizeTags = (
  rawTags: ReadonlyArray<string>,
): ResultAsync<ReadonlyArray<Tag>, DomainError> => {
  let tags: ReadonlyArray<Tag> = [];

  for (const rawTag of rawTags) {
    const next = addTag(tags, rawTag);
    if (next.isErr()) {
      return errAsync(
        validationError(
          `Council tag validation failed with ${next.error}`,
          "Tags must be unique, non-empty, and at most 3 per council.",
        ),
      );
    }
    tags = next.value;
  }

  return okAsync(tags);
};

const includesInsensitive = (text: string, query: string): boolean =>
  text.toLowerCase().includes(query.toLowerCase());

const toCouncilDto = (params: {
  record: CouncilRecord;
  availableModelKeys: ReadonlySet<string>;
  globalDefaultModelRef: ModelRef | null;
}): CouncilDto => ({
  id: params.record.id,
  title: params.record.title,
  topic: params.record.topic,
  goal: params.record.goal,
  tags: [...params.record.tags],
  mode: params.record.mode,
  memberAgentIds: [...params.record.memberAgentIds],
  memberColorsByAgentId: { ...params.record.memberColorsByAgentId },
  conductorModelRefOrNull: params.record.conductorModelRefOrNull,
  invalidConfig: isModelConfigInvalid({
    modelRefOrNull: params.record.conductorModelRefOrNull,
    globalDefaultModelRef: params.globalDefaultModelRef,
    availableModelKeys: params.availableModelKeys,
  }),
  archived: params.record.archivedAtUtc !== null,
  started: params.record.startedAtUtc !== null,
  paused: params.record.mode === "autopilot" ? params.record.autopilotPaused : false,
  autopilotMaxTurns: params.record.mode === "autopilot" ? params.record.autopilotMaxTurns : null,
  autopilotTurnsCompleted:
    params.record.mode === "autopilot" ? params.record.autopilotTurnsCompleted : 0,
  turnCount: params.record.turnCount,
  createdAtUtc: params.record.createdAtUtc,
  updatedAtUtc: params.record.updatedAtUtc,
});

const toCouncilMessageDto = (message: CouncilMessageRecord): CouncilMessageDto => ({
  id: message.id,
  councilId: message.councilId,
  sequenceNumber: message.sequenceNumber,
  senderKind: message.senderKind,
  senderAgentId: message.senderAgentId,
  senderName: message.senderName,
  senderColor: message.senderColor,
  content: message.content,
  createdAtUtc: message.createdAtUtc,
});

const toCouncilRuntimeBriefingDto = (
  briefing: CouncilRuntimeBriefingRecord | null,
): CouncilRuntimeBriefingDto | null => {
  if (briefing === null) {
    return null;
  }

  return {
    briefing: briefing.briefing,
    goalReached: briefing.goalReached,
    updatedAtUtc: briefing.updatedAtUtc,
  };
};

const toRuntimeConversationMessage = (
  message: CouncilMessageRecord,
): RuntimeConversationMessage => ({
  senderName: message.senderName,
  senderKind: message.senderKind,
  content: message.content,
});

const toTranscriptMarkdown = (params: {
  council: CouncilRecord;
  messages: ReadonlyArray<CouncilMessageRecord>;
}): string => {
  const header = [
    `# ${params.council.title}`,
    "",
    `- Topic: ${params.council.topic}`,
    `- Goal: ${params.council.goal ?? "(none)"}`,
    "",
    "## Messages",
  ];

  const messageLines = params.messages.flatMap((message) => [
    "",
    `### ${message.sequenceNumber}. ${message.senderName}`,
    `- Sender kind: ${message.senderKind}`,
    `- Timestamp: ${message.createdAtUtc}`,
    "",
    message.content,
  ]);

  return [...header, ...messageLines, ""].join("\n");
};

export const createCouncilsSlice = (
  dependencies: CouncilsSliceDependencies,
  initialCouncils: ReadonlyArray<CouncilRecord> = [],
): CouncilsSlice => {
  const records = new Map<CouncilId, CouncilRecord>(
    initialCouncils.map((council) => [council.id, council]),
  );
  const loadPersistedCouncils = dependencies.loadPersistedCouncils ?? (() => okAsync([]));
  const persistCouncil = dependencies.persistCouncil ?? (() => okAsync(undefined));
  const persistCouncilDeletion = dependencies.persistCouncilDeletion ?? (() => okAsync(undefined));
  const loadCouncilMessages = dependencies.loadCouncilMessages ?? (() => okAsync([]));
  const appendCouncilMessage =
    dependencies.appendCouncilMessage ??
    ((message: Omit<CouncilMessageRecord, "sequenceNumber">) =>
      okAsync({
        ...message,
        sequenceNumber: 1,
      }));
  const loadCouncilRuntimeBriefing =
    dependencies.loadCouncilRuntimeBriefing ?? (() => okAsync(null));
  const persistCouncilRuntimeBriefing =
    dependencies.persistCouncilRuntimeBriefing ?? (() => okAsync(undefined));
  let hydrated = dependencies.loadPersistedCouncils === undefined;
  const messageCacheByCouncilId = new Map<CouncilId, ReadonlyArray<CouncilMessageRecord>>();
  const briefingCacheByCouncilId = new Map<CouncilId, CouncilRuntimeBriefingRecord | null>();
  const inFlightGenerationByCouncilId = new Map<CouncilId, InFlightGenerationRecord>();
  const plannedNextSpeakerByCouncilId = new Map<CouncilId, AgentId>();
  const getContextLastN = (): number =>
    normalizeContextLastN(
      dependencies.getContextLastN?.() ?? DEFAULT_CONTEXT_LAST_N,
      DEFAULT_CONTEXT_LAST_N,
    );

  const mapProviderError = (message: string): DomainError =>
    domainError("ProviderError", message, "Message generation failed.");

  const toGenerationStateDto = (councilId: CouncilId): CouncilGenerationStateDto => {
    const inFlight = inFlightGenerationByCouncilId.get(councilId);
    const plannedNextSpeakerAgentId = plannedNextSpeakerByCouncilId.get(councilId) ?? null;
    if (inFlight === undefined) {
      return {
        status: "idle",
        kind: null,
        activeMemberAgentId: null,
        plannedNextSpeakerAgentId,
      };
    }

    return {
      status: "running",
      kind: inFlight.kind,
      activeMemberAgentId: inFlight.memberAgentId,
      plannedNextSpeakerAgentId,
    };
  };

  const hydrate = (): ResultAsync<void, DomainError> => {
    if (hydrated) {
      return okAsync(undefined);
    }

    return loadPersistedCouncils().map((persistedCouncils) => {
      records.clear();
      for (const council of persistedCouncils) {
        records.set(council.id, council);
      }
      hydrated = true;
    });
  };

  const getExistingCouncil = (councilId: string): ResultAsync<CouncilRecord, DomainError> => {
    const existing = records.get(asCouncilId(councilId));
    if (existing === undefined) {
      return errAsync(notFoundError(`Council ${councilId} not found`, "Council not found."));
    }

    return okAsync(existing);
  };

  const loadCouncilWithModelContext = (params: {
    webContentsId: number;
    councilId: string;
    viewKind: "councilCreate" | "councilView";
  }): ResultAsync<
    {
      council: CouncilRecord;
      modelContext: CouncilModelContext;
      availableModelKeys: ReadonlySet<string>;
    },
    DomainError
  > =>
    hydrate()
      .andThen(() => getExistingCouncil(params.councilId))
      .andThen((council) =>
        dependencies
          .getModelContext({
            webContentsId: params.webContentsId,
            viewKind: params.viewKind,
          })
          .map((modelContext) => ({
            council,
            modelContext,
            availableModelKeys: buildAvailableModelKeys(modelContext.modelCatalog.modelsByProvider),
          })),
      );

  const getCouncilMessages = (
    councilId: CouncilId,
  ): ResultAsync<ReadonlyArray<CouncilMessageRecord>, DomainError> => {
    const cached = messageCacheByCouncilId.get(councilId);
    if (cached !== undefined) {
      return okAsync(cached);
    }

    return loadCouncilMessages(councilId).map((messages) => {
      messageCacheByCouncilId.set(councilId, messages);
      return messages;
    });
  };

  const getRuntimeBriefing = (
    councilId: CouncilId,
  ): ResultAsync<CouncilRuntimeBriefingRecord | null, DomainError> => {
    if (briefingCacheByCouncilId.has(councilId)) {
      return okAsync(briefingCacheByCouncilId.get(councilId) ?? null);
    }

    return loadCouncilRuntimeBriefing(councilId).map((briefing) => {
      briefingCacheByCouncilId.set(councilId, briefing);
      return briefing;
    });
  };

  const appendMessage = (
    message: Omit<CouncilMessageRecord, "sequenceNumber">,
  ): ResultAsync<CouncilMessageRecord, DomainError> =>
    appendCouncilMessage(message).map((savedMessage) => {
      const existing = messageCacheByCouncilId.get(savedMessage.councilId) ?? [];
      messageCacheByCouncilId.set(savedMessage.councilId, [...existing, savedMessage]);
      return savedMessage;
    });

  const persistBriefing = (
    briefing: CouncilRuntimeBriefingRecord,
  ): ResultAsync<CouncilRuntimeBriefingRecord, DomainError> =>
    persistCouncilRuntimeBriefing(briefing).map(() => {
      briefingCacheByCouncilId.set(briefing.councilId, briefing);
      return briefing;
    });

  const ensureNoActiveGeneration = (councilId: CouncilId): ResultAsync<void, DomainError> => {
    if (inFlightGenerationByCouncilId.has(councilId)) {
      return errAsync(
        stateError(
          `Council ${councilId} already has an in-flight generation`,
          "A generation is already running.",
        ),
      );
    }
    return okAsync(undefined);
  };

  const cancelInFlightGeneration = (councilId: CouncilId): boolean => {
    const inFlight = inFlightGenerationByCouncilId.get(councilId);
    if (inFlight === undefined) {
      return false;
    }

    inFlight.controller.abort();
    inFlightGenerationByCouncilId.delete(councilId);
    return true;
  };

  const generateTextForCouncil = (params: {
    council: CouncilRecord;
    modelContext: CouncilModelContext;
    kind: InFlightGenerationRecord["kind"];
    memberAgentId: AgentId | null;
    promptRole: "member" | "conductor";
    promptContent: string;
  }): ResultAsync<string, DomainError> => {
    const requestId = dependencies.createGenerationRequestId();
    const controller = new AbortController();
    inFlightGenerationByCouncilId.set(params.council.id, {
      requestId,
      kind: params.kind,
      controller,
      memberAgentId: params.memberAgentId,
    });

    const resolvedModelRef =
      params.council.conductorModelRefOrNull ?? params.modelContext.globalDefaultModelRef;
    if (resolvedModelRef === null) {
      inFlightGenerationByCouncilId.delete(params.council.id);
      dependencies.logger?.error(
        "council-generation",
        "generateTextForCouncil",
        "No resolved model",
        {
          councilId: params.council.id,
          kind: params.kind,
          memberAgentId: params.memberAgentId,
          promptRole: params.promptRole,
          hasConductorModel: params.council.conductorModelRefOrNull !== null,
          hasGlobalDefault: params.modelContext.globalDefaultModelRef !== null,
        },
      );
      return errAsync(
        stateError(
          `Council ${params.council.id} has no resolved model for generation`,
          "Cannot generate because model configuration is invalid.",
        ),
      );
    }

    dependencies.logger?.info("council-generation", "generateTextForCouncilStart", {
      councilId: params.council.id,
      requestId,
      kind: params.kind,
      memberAgentId: params.memberAgentId,
      promptRole: params.promptRole,
      providerId: resolvedModelRef.providerId,
      modelId: resolvedModelRef.modelId,
      promptLength: params.promptContent.length,
    });

    return dependencies.aiService
      .generateText(
        {
          providerId: resolvedModelRef.providerId,
          modelId: resolvedModelRef.modelId,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: "Council runtime generation skeleton.",
            },
            {
              role: "user",
              content: `${params.promptRole}: ${params.promptContent}`,
            },
          ],
        },
        controller.signal,
      )
      .mapErr((providerError) => {
        const inFlight = inFlightGenerationByCouncilId.get(params.council.id);
        if (inFlight?.requestId === requestId) {
          inFlightGenerationByCouncilId.delete(params.council.id);
        }

        dependencies.logger?.error(
          "council-generation",
          "generateTextForCouncilError",
          providerError.message,
          {
            councilId: params.council.id,
            requestId,
            kind: params.kind,
            memberAgentId: params.memberAgentId,
            promptRole: params.promptRole,
            providerId: providerError.providerId,
            modelId: providerError.modelId,
            errorMessage: providerError.message,
            wasAborted: controller.signal.aborted,
          },
        );

        return controller.signal.aborted
          ? stateError(
              `Council ${params.council.id} generation cancelled`,
              "Generation was cancelled.",
            )
          : domainError(
              "ProviderError",
              `Generation failed for council ${params.council.id}: ${providerError.message}`,
              `Generation failed (${providerError.providerId}/${providerError.modelId}): ${providerError.message}`,
            );
      })
      .andThen((response) => {
        const inFlight = inFlightGenerationByCouncilId.get(params.council.id);
        const wasCancelled =
          inFlight === undefined || inFlight.requestId !== requestId || controller.signal.aborted;
        if (wasCancelled) {
          return errAsync(
            stateError(
              `Council ${params.council.id} generation cancelled`,
              "Generation was cancelled.",
            ),
          );
        }

        inFlightGenerationByCouncilId.delete(params.council.id);
        const text = response.text.trim();
        if (text.length === 0) {
          dependencies.logger?.error(
            "council-generation",
            "generateTextForCouncilError",
            "Generation returned empty text",
            {
              councilId: params.council.id,
              requestId,
              kind: params.kind,
              memberAgentId: params.memberAgentId,
              promptRole: params.promptRole,
              providerId: resolvedModelRef.providerId,
              modelId: resolvedModelRef.modelId,
            },
          );
          return errAsync(
            mapProviderError(`Generation returned empty text for council ${params.council.id}`),
          );
        }

        dependencies.logger?.info("council-generation", "generateTextForCouncilSuccess", {
          councilId: params.council.id,
          requestId,
          kind: params.kind,
          memberAgentId: params.memberAgentId,
          promptRole: params.promptRole,
          providerId: resolvedModelRef.providerId,
          modelId: resolvedModelRef.modelId,
          textLength: text.length,
        });

        return okAsync(text);
      });
  };

  const generateTextWithRefreshRetry = (params: {
    webContentsId: number;
    council: CouncilRecord;
    modelContext: CouncilModelContext;
    kind: InFlightGenerationRecord["kind"];
    memberAgentId: AgentId | null;
    promptRole: "member" | "conductor";
    promptContent: string;
  }): ResultAsync<string, DomainError> =>
    generateTextForCouncil(params).orElse((firstError) => {
      if (firstError.kind !== "ProviderError") {
        return errAsync(firstError);
      }

      return dependencies
        .refreshModelCatalog({
          webContentsId: params.webContentsId,
          viewKind: "councilView",
        })
        .map((refreshResult) => ({
          ...params.modelContext,
          modelCatalog: refreshResult.modelCatalog,
          canRefreshModels: true,
        }))
        .orElse(() => okAsync(params.modelContext))
        .andThen((nextModelContext) =>
          generateTextForCouncil({
            ...params,
            modelContext: nextModelContext,
          }),
        );
    });

  const pauseAutopilotAfterError = (params: {
    council: CouncilRecord;
    error: DomainError;
  }): ResultAsync<DomainError, DomainError> => {
    if (params.council.mode !== "autopilot" || params.council.startedAtUtc === null) {
      return okAsync(params.error);
    }

    if (params.council.autopilotPaused) {
      return okAsync(params.error);
    }

    const now = dependencies.nowUtc();
    const pausedCouncil: CouncilRecord = {
      ...params.council,
      autopilotPaused: true,
      updatedAtUtc: now,
    };

    return persistCouncil(pausedCouncil)
      .map(() => {
        records.set(pausedCouncil.id, pausedCouncil);
        return params.error;
      })
      .orElse(() => okAsync(params.error));
  };

  const runConductorBriefingDecision = (params: {
    webContentsId: number;
    council: CouncilRecord;
    modelContext: CouncilModelContext;
    previousBriefing: CouncilRuntimeBriefingRecord | null;
    messages: ReadonlyArray<CouncilMessageRecord>;
    mode: CouncilMode;
    eligibleMemberAgentIds: ReadonlyArray<AgentId>;
  }): ResultAsync<ConductorDecision, DomainError> => {
    const contextWindow = selectLastNContextMessages(params.messages, getContextLastN());
    const prompt = buildConductorDecisionPrompt({
      mode: params.mode,
      topic: params.council.topic,
      goal: params.council.goal,
      previousBriefing: params.previousBriefing?.briefing ?? null,
      messages: contextWindow.messages.map(toRuntimeConversationMessage),
      omittedMessageCount: contextWindow.omittedCount,
      eligibleMemberAgentIds: params.eligibleMemberAgentIds,
    });

    return generateTextWithRefreshRetry({
      webContentsId: params.webContentsId,
      council: params.council,
      modelContext: params.modelContext,
      kind: "conductorBriefing",
      memberAgentId: null,
      promptRole: "conductor",
      promptContent: prompt,
    }).andThen((text) => {
      const parsed = parseConductorDecision({
        text,
        mode: params.mode,
        eligibleMemberAgentIds: params.eligibleMemberAgentIds,
      });
      if (parsed.isErr()) {
        return errAsync(
          mapProviderError(
            `Conductor decision parse failed for council ${params.council.id}: ${parsed.error}`,
          ),
        );
      }

      return okAsync(parsed.value);
    });
  };

  const runAutopilotOpeningDecision = (params: {
    webContentsId: number;
    council: CouncilRecord;
    modelContext: CouncilModelContext;
  }): ResultAsync<ConductorOpeningDecision, DomainError> => {
    const prompt = buildAutopilotOpeningPrompt({
      topic: params.council.topic,
      goal: params.council.goal,
      memberAgentIds: params.council.memberAgentIds,
    });

    return generateTextWithRefreshRetry({
      webContentsId: params.webContentsId,
      council: params.council,
      modelContext: params.modelContext,
      kind: "autopilotOpening",
      memberAgentId: null,
      promptRole: "conductor",
      promptContent: prompt,
    }).andThen((text) => {
      const parsed = parseAutopilotOpeningDecision({
        text,
        memberAgentIds: params.council.memberAgentIds,
      });
      if (parsed.isErr()) {
        return errAsync(
          mapProviderError(
            `Conductor opening parse failed for council ${params.council.id}: ${parsed.error}`,
          ),
        );
      }

      return okAsync(parsed.value);
    });
  };

  const buildMemberTurnPrompt = (params: {
    council: CouncilRecord;
    speakerName: string;
    previousBriefing: CouncilRuntimeBriefingRecord | null;
    messages: ReadonlyArray<CouncilMessageRecord>;
  }): string => {
    const contextWindow = selectLastNContextMessages(params.messages, getContextLastN());
    const briefingSection = params.previousBriefing?.briefing ?? "(none)";
    const conversationSection =
      contextWindow.messages.length === 0
        ? "(none)"
        : contextWindow.messages
            .map(
              (message, index) =>
                `${index + 1}. [${message.senderKind}] ${message.senderName}: ${message.content}`,
            )
            .join("\n");

    return [
      "You are a council member responding in an ongoing council discussion.",
      `Council: ${params.council.title}`,
      `Topic: ${params.council.topic}`,
      `Goal: ${params.council.goal ?? "(none)"}`,
      `Speaker: ${params.speakerName}`,
      `Current briefing: ${briefingSection}`,
      `Earlier messages omitted: ${contextWindow.omittedCount}`,
      "Recent conversation:",
      conversationSection,
      "Respond with only the speaker's next message.",
    ].join("\n");
  };

  const listCouncils: CouncilsSlice["listCouncils"] = ({
    webContentsId,
    searchText,
    tagFilter,
    archivedFilter,
    sortBy,
    sortDirection,
    page,
  }) =>
    hydrate()
      .andThen(() =>
        dependencies.getModelContext({
          webContentsId,
          viewKind: "councilsList",
        }),
      )
      .andThen((modelContext) => {
        const availableModelKeys = buildAvailableModelKeys(
          modelContext.modelCatalog.modelsByProvider,
        );
        const normalizedSearch = searchText.trim().toLowerCase();
        const normalizedTagFilter = tagFilter.trim().toLowerCase();

        const filtered = Array.from(records.values())
          .filter((council) => {
            if (archivedFilter === "active" && council.archivedAtUtc !== null) {
              return false;
            }

            if (archivedFilter === "archived" && council.archivedAtUtc === null) {
              return false;
            }

            const matchesSearch =
              normalizedSearch.length === 0 ||
              includesInsensitive(council.title, normalizedSearch) ||
              includesInsensitive(council.topic, normalizedSearch);
            const matchesTag =
              normalizedTagFilter.length === 0 ||
              council.tags.some((tag) => tag.toLowerCase() === normalizedTagFilter);

            return matchesSearch && matchesTag;
          })
          .sort((left, right) => {
            const leftValue = sortBy === "createdAt" ? left.createdAtUtc : left.updatedAtUtc;
            const rightValue = sortBy === "createdAt" ? right.createdAtUtc : right.updatedAtUtc;
            const order = leftValue.localeCompare(rightValue);
            return sortDirection === "asc" ? order : -order;
          });

        const start = (page - 1) * dependencies.pageSize;
        const paged = filtered.slice(start, start + dependencies.pageSize);

        return okAsync({
          items: paged.map((record) =>
            toCouncilDto({
              record,
              availableModelKeys,
              globalDefaultModelRef: modelContext.globalDefaultModelRef,
            }),
          ),
          page,
          pageSize: dependencies.pageSize,
          total: filtered.length,
          hasMore: start + dependencies.pageSize < filtered.length,
          modelCatalog: modelContext.modelCatalog,
          globalDefaultModelRef: modelContext.globalDefaultModelRef,
        } satisfies ListCouncilsResponse);
      });

  const getEditorView: CouncilsSlice["getEditorView"] = ({ webContentsId, councilId }) =>
    hydrate().andThen(() =>
      dependencies
        .getModelContext({
          webContentsId,
          viewKind: "councilCreate",
        })
        .andThen((modelContext) =>
          dependencies
            .listAvailableAgents({
              webContentsId,
              viewKind: "councilCreate",
            })
            .andThen((availableAgents) => {
              const availableModelKeys = buildAvailableModelKeys(
                modelContext.modelCatalog.modelsByProvider,
              );

              if (councilId === null) {
                return okAsync({
                  council: null,
                  availableAgents,
                  modelCatalog: modelContext.modelCatalog,
                  globalDefaultModelRef: modelContext.globalDefaultModelRef,
                  canRefreshModels: modelContext.canRefreshModels,
                } satisfies GetCouncilEditorViewResponse);
              }

              const existing = records.get(asCouncilId(councilId));
              if (existing === undefined) {
                return errAsync(
                  notFoundError(`Council ${councilId} not found`, "Council not found."),
                );
              }

              return okAsync({
                council: toCouncilDto({
                  record: existing,
                  availableModelKeys,
                  globalDefaultModelRef: modelContext.globalDefaultModelRef,
                }),
                availableAgents,
                modelCatalog: modelContext.modelCatalog,
                globalDefaultModelRef: modelContext.globalDefaultModelRef,
                canRefreshModels: modelContext.canRefreshModels,
              } satisfies GetCouncilEditorViewResponse);
            }),
        ),
    );

  const getCouncilView: CouncilsSlice["getCouncilView"] = ({ webContentsId, councilId }) =>
    hydrate().andThen(() =>
      dependencies
        .getModelContext({
          webContentsId,
          viewKind: "councilView",
        })
        .andThen((modelContext) =>
          dependencies
            .listAvailableAgents({
              webContentsId,
              viewKind: "councilCreate",
            })
            .andThen((availableAgents) => {
              const existing = records.get(asCouncilId(councilId));
              if (existing === undefined) {
                return errAsync(
                  notFoundError(`Council ${councilId} not found`, "Council not found."),
                );
              }

              const availableModelKeys = buildAvailableModelKeys(
                modelContext.modelCatalog.modelsByProvider,
              );

              return getCouncilMessages(existing.id).andThen((messages) =>
                getRuntimeBriefing(existing.id).map(
                  (briefing) =>
                    ({
                      council: toCouncilDto({
                        record: existing,
                        availableModelKeys,
                        globalDefaultModelRef: modelContext.globalDefaultModelRef,
                      }),
                      availableAgents,
                      messages: messages.map(toCouncilMessageDto),
                      briefing: toCouncilRuntimeBriefingDto(briefing),
                      generation: toGenerationStateDto(existing.id),
                      modelCatalog: modelContext.modelCatalog,
                      globalDefaultModelRef: modelContext.globalDefaultModelRef,
                      canRefreshModels: modelContext.canRefreshModels,
                    }) satisfies GetCouncilViewResponse,
                ),
              );
            }),
        ),
    );

  const validateCouncilMemberMutations = (params: {
    existing: CouncilRecord;
    viewKind: "councilCreate" | "councilView";
    normalizedMemberAgentIds: ReadonlyArray<AgentId>;
  }): ResultAsync<void, DomainError> => {
    if (params.viewKind !== "councilView") {
      return okAsync(undefined);
    }

    const previousMemberIds = new Set(params.existing.memberAgentIds);
    const nextMemberIds = new Set(params.normalizedMemberAgentIds);
    const addedMembers = params.normalizedMemberAgentIds.filter(
      (memberId) => !previousMemberIds.has(memberId),
    );
    const removedMembers = params.existing.memberAgentIds.filter(
      (memberId) => !nextMemberIds.has(memberId),
    );

    if (addedMembers.length > 0) {
      const canAddMembers =
        params.existing.startedAtUtc === null ||
        params.existing.autopilotPaused ||
        params.existing.mode === "manual";
      if (!canAddMembers) {
        return errAsync(
          stateError(
            `Council ${params.existing.id} cannot add members in current runtime state`,
            "Members can be added only before start, while paused, or in Manual mode.",
          ),
        );
      }
    }

    if (removedMembers.length === 0) {
      return okAsync(undefined);
    }

    const removedMemberIds = new Set(removedMembers);
    return getCouncilMessages(params.existing.id).andThen((messages) => {
      const removingMemberWithHistory = messages.some(
        (message) =>
          message.senderKind === "member" &&
          message.senderAgentId !== null &&
          removedMemberIds.has(message.senderAgentId),
      );
      if (!removingMemberWithHistory) {
        return okAsync(undefined);
      }

      return errAsync(
        validationError(
          `Council ${params.existing.id} attempted to remove member with message history`,
          "Members who already sent messages cannot be removed.",
        ),
      );
    });
  };

  const saveCouncil: CouncilsSlice["saveCouncil"] = ({ webContentsId, draft }) => {
    const normalizedTitle = draft.title.trim();
    const normalizedTopic = draft.topic.trim();
    const normalizedGoal = normalizeNullable(draft.goal);

    if (normalizedTitle.length === 0 || normalizedTopic.length === 0) {
      return errAsync(
        validationError(
          "Council save failed due to empty required fields",
          "Title, Topic, and Members are required.",
        ),
      );
    }

    if (draft.memberAgentIds.length === 0) {
      return errAsync(
        validationError("Council has no members", "Title, Topic, and Members are required."),
      );
    }

    const normalizedMemberAgentIds = Array.from(new Set(draft.memberAgentIds)).map((id) =>
      asAgentId(id),
    );

    return hydrate()
      .andThen(() => normalizeTags(draft.tags))
      .andThen((tags) =>
        dependencies
          .listAvailableAgents({
            webContentsId,
            viewKind: draft.viewKind,
          })
          .map((availableAgents) => ({
            tags,
            availableAgents,
          })),
      )
      .andThen(({ tags, availableAgents }) => {
        const availableAgentIds = new Set(availableAgents.map((agent) => agent.id));
        const unknownMembers = normalizedMemberAgentIds.filter(
          (agentId) => !availableAgentIds.has(agentId),
        );
        if (unknownMembers.length > 0) {
          return errAsync(
            validationError(
              `Unknown member ids: ${unknownMembers.join(",")}`,
              "One or more selected members no longer exist.",
            ),
          );
        }

        const existingId = draft.id === null ? null : asCouncilId(draft.id);
        const existing = existingId === null ? undefined : records.get(existingId);
        if (draft.id !== null && existing === undefined) {
          return errAsync(notFoundError(`Council ${draft.id} not found`, "Council not found."));
        }

        if (existing !== undefined && existing.mode !== draft.mode) {
          return errAsync(
            stateError(
              `Council ${draft.id} mode changed from ${existing.mode} to ${draft.mode}`,
              "Council mode cannot be changed after creation.",
            ),
          );
        }

        if (existing !== undefined && existing.archivedAtUtc !== null) {
          return errAsync(
            stateError(
              `Council ${draft.id} is archived and read-only`,
              "Archived councils are read-only. Restore it before editing.",
            ),
          );
        }

        const validateMemberMutationsResult =
          existing === undefined
            ? okAsync(undefined)
            : validateCouncilMemberMutations({
                existing,
                viewKind: draft.viewKind,
                normalizedMemberAgentIds,
              });

        return validateMemberMutationsResult.andThen(() => {
          return dependencies
            .getModelContext({
              webContentsId,
              viewKind: draft.viewKind,
            })
            .andThen((modelContext) => {
              const availableModelKeys = buildAvailableModelKeys(
                modelContext.modelCatalog.modelsByProvider,
              );
              const now = dependencies.nowUtc();
              const id = existingId ?? dependencies.createCouncilId();
              const memberColorsByAgentId = normalizedMemberAgentIds.reduce<Record<string, string>>(
                (acc, agentId) => {
                  const color = draft.memberColorsByAgentId[agentId];
                  if (typeof color === "string" && color.trim().length > 0) {
                    acc[agentId] = color.trim();
                  }
                  return acc;
                },
                {},
              );

              const record: CouncilRecord = {
                id,
                title: normalizedTitle,
                topic: normalizedTopic,
                goal: normalizedGoal,
                mode: draft.mode,
                tags,
                memberAgentIds: normalizedMemberAgentIds,
                memberColorsByAgentId,
                conductorModelRefOrNull: draft.conductorModelRefOrNull,
                archivedAtUtc: existing?.archivedAtUtc ?? null,
                startedAtUtc: existing?.startedAtUtc ?? null,
                autopilotPaused: existing?.autopilotPaused ?? true,
                autopilotMaxTurns: existing?.autopilotMaxTurns ?? null,
                autopilotTurnsCompleted: existing?.autopilotTurnsCompleted ?? 0,
                turnCount: existing?.turnCount ?? 0,
                createdAtUtc: existing?.createdAtUtc ?? now,
                updatedAtUtc: now,
              };

              return persistCouncil(record).andThen(() => {
                records.set(id, record);
                return okAsync({
                  council: toCouncilDto({
                    record,
                    availableModelKeys,
                    globalDefaultModelRef: modelContext.globalDefaultModelRef,
                  }),
                } satisfies SaveCouncilResponse);
              });
            });
        });
      });
  };

  const deleteCouncil: CouncilsSlice["deleteCouncil"] = ({ id }) =>
    hydrate().andThen(() => {
      const councilId = asCouncilId(id);
      const existing = records.get(councilId);
      if (existing === undefined) {
        return errAsync(notFoundError(`Council ${id} not found`, "Council not found."));
      }

      return persistCouncilDeletion(councilId).andThen(() => {
        cancelInFlightGeneration(councilId);
        messageCacheByCouncilId.delete(councilId);
        briefingCacheByCouncilId.delete(councilId);
        plannedNextSpeakerByCouncilId.delete(councilId);
        records.delete(councilId);
        return okAsync({ deletedId: id } satisfies DeleteCouncilResponse);
      });
    });

  const setArchived: CouncilsSlice["setArchived"] = ({ webContentsId, id, archived }) =>
    hydrate().andThen(() => {
      const councilId = asCouncilId(id);
      const existing = records.get(councilId);
      if (existing === undefined) {
        return errAsync(notFoundError(`Council ${id} not found`, "Council not found."));
      }

      if (
        archived &&
        existing.mode === "autopilot" &&
        existing.startedAtUtc !== null &&
        !existing.autopilotPaused
      ) {
        return errAsync(
          stateError(
            `Council ${id} cannot be archived while autopilot is running`,
            "Pause Autopilot before archiving this council.",
          ),
        );
      }

      const now = dependencies.nowUtc();
      const next: CouncilRecord = {
        ...existing,
        archivedAtUtc: archived ? (existing.archivedAtUtc ?? now) : null,
        updatedAtUtc: now,
      };

      if (archived) {
        cancelInFlightGeneration(councilId);
        plannedNextSpeakerByCouncilId.delete(councilId);
      }

      return dependencies
        .getModelContext({
          webContentsId,
          viewKind: "councilsList",
        })
        .andThen((modelContext) => {
          const availableModelKeys = buildAvailableModelKeys(
            modelContext.modelCatalog.modelsByProvider,
          );
          return persistCouncil(next).andThen(() => {
            records.set(councilId, next);
            return okAsync({
              council: toCouncilDto({
                record: next,
                availableModelKeys,
                globalDefaultModelRef: modelContext.globalDefaultModelRef,
              }),
            } satisfies SetCouncilArchivedResponse);
          });
        });
    });

  const startCouncil: CouncilsSlice["startCouncil"] = ({ webContentsId, id, maxTurns }) =>
    loadCouncilWithModelContext({
      webContentsId,
      councilId: id,
      viewKind: "councilView",
    }).andThen(({ council, modelContext, availableModelKeys }) =>
      dependencies
        .listAvailableAgents({
          webContentsId,
          viewKind: "councilView",
        })
        .andThen((availableAgents) => {
          const availableAgentById = new Map(availableAgents.map((agent) => [agent.id, agent]));
          const hasInvalidMemberConfig = council.memberAgentIds.some(
            (memberAgentId) => availableAgentById.get(memberAgentId)?.invalidConfig === true,
          );
          if (hasInvalidMemberConfig) {
            return errAsync(
              stateError(
                `Council ${id} includes member agents with invalid model configuration`,
                "Cannot start because one or more council members have invalid model configuration.",
              ),
            );
          }

          if (council.topic.trim().length === 0) {
            return errAsync(
              validationError(
                `Council ${id} cannot start without a topic`,
                "Topic is required before starting the council.",
              ),
            );
          }

          if (council.memberAgentIds.length === 0) {
            return errAsync(
              validationError(
                `Council ${id} cannot start without members`,
                "At least one member is required before starting the council.",
              ),
            );
          }

          if (council.archivedAtUtc !== null) {
            return errAsync(
              stateError(`Council ${id} is archived`, "Archived councils are read-only."),
            );
          }

          if (
            isModelConfigInvalid({
              modelRefOrNull: council.conductorModelRefOrNull,
              globalDefaultModelRef: modelContext.globalDefaultModelRef,
              availableModelKeys,
            })
          ) {
            return errAsync(
              stateError(
                `Council ${id} has invalid model configuration`,
                "Cannot start because model configuration is invalid.",
              ),
            );
          }

          if (council.startedAtUtc !== null) {
            return errAsync(
              stateError(`Council ${id} already started`, "Council is already started."),
            );
          }

          const normalizedMaxTurns = normalizeAutopilotMaxTurns(maxTurns);
          const now = dependencies.nowUtc();
          const next: CouncilRecord = {
            ...council,
            startedAtUtc: now,
            autopilotPaused: council.mode === "autopilot" ? false : council.autopilotPaused,
            autopilotMaxTurns: council.mode === "autopilot" ? normalizedMaxTurns : null,
            autopilotTurnsCompleted:
              council.mode === "autopilot" ? 0 : council.autopilotTurnsCompleted,
            updatedAtUtc: now,
          };

          return persistCouncil(next).andThen(() => {
            records.set(next.id, next);
            plannedNextSpeakerByCouncilId.delete(next.id);
            if (next.mode !== "autopilot") {
              return okAsync({
                council: toCouncilDto({
                  record: next,
                  availableModelKeys,
                  globalDefaultModelRef: modelContext.globalDefaultModelRef,
                }),
              } satisfies StartCouncilResponse);
            }

            return runAutopilotOpeningDecision({
              webContentsId,
              council: next,
              modelContext,
            })
              .andThen((opening) => {
                const openingTimestamp = dependencies.nowUtc();

                return appendMessage({
                  id: dependencies.createMessageId(),
                  councilId: next.id,
                  senderKind: "conductor",
                  senderAgentId: null,
                  senderName: "Conductor",
                  senderColor: null,
                  content: opening.openingMessage,
                  createdAtUtc: openingTimestamp,
                }).andThen(() =>
                  persistBriefing({
                    councilId: next.id,
                    briefing: opening.briefing,
                    goalReached: opening.goalReached,
                    updatedAtUtc: openingTimestamp,
                  }).andThen(() => {
                    plannedNextSpeakerByCouncilId.set(
                      next.id,
                      asAgentId(opening.firstSpeakerAgentId),
                    );

                    const finalCouncil: CouncilRecord = {
                      ...next,
                      autopilotPaused: opening.goalReached,
                      updatedAtUtc: openingTimestamp,
                    };

                    return persistCouncil(finalCouncil).map(() => {
                      records.set(finalCouncil.id, finalCouncil);
                      return {
                        council: toCouncilDto({
                          record: finalCouncil,
                          availableModelKeys,
                          globalDefaultModelRef: modelContext.globalDefaultModelRef,
                        }),
                      } satisfies StartCouncilResponse;
                    });
                  }),
                );
              })
              .orElse((error) =>
                pauseAutopilotAfterError({ council: next, error }).andThen((pausedError) =>
                  errAsync(pausedError),
                ),
              );
          });
        }),
    );

  const pauseCouncilAutopilot: CouncilsSlice["pauseCouncilAutopilot"] = ({ webContentsId, id }) =>
    loadCouncilWithModelContext({
      webContentsId,
      councilId: id,
      viewKind: "councilView",
    }).andThen(({ council, modelContext, availableModelKeys }) => {
      if (council.mode !== "autopilot") {
        return errAsync(
          stateError(`Council ${id} is not autopilot`, "Only Autopilot councils can be paused."),
        );
      }

      if (council.startedAtUtc === null) {
        return errAsync(
          stateError(`Council ${id} is not started`, "Start the council before pausing."),
        );
      }

      if (council.autopilotPaused) {
        return errAsync(stateError(`Council ${id} already paused`, "Autopilot is already paused."));
      }

      const now = dependencies.nowUtc();
      cancelInFlightGeneration(council.id);
      const next: CouncilRecord = {
        ...council,
        autopilotPaused: true,
        updatedAtUtc: now,
      };

      return persistCouncil(next).andThen(() => {
        records.set(next.id, next);
        return okAsync({
          council: toCouncilDto({
            record: next,
            availableModelKeys,
            globalDefaultModelRef: modelContext.globalDefaultModelRef,
          }),
        } satisfies PauseCouncilAutopilotResponse);
      });
    });

  const resumeCouncilAutopilot: CouncilsSlice["resumeCouncilAutopilot"] = ({
    webContentsId,
    id,
    maxTurns,
  }) =>
    loadCouncilWithModelContext({
      webContentsId,
      councilId: id,
      viewKind: "councilView",
    }).andThen(({ council, modelContext, availableModelKeys }) =>
      dependencies
        .listAvailableAgents({
          webContentsId,
          viewKind: "councilView",
        })
        .andThen((availableAgents) => {
          const availableAgentById = new Map(availableAgents.map((agent) => [agent.id, agent]));
          const hasInvalidMemberConfig = council.memberAgentIds.some(
            (memberAgentId) => availableAgentById.get(memberAgentId)?.invalidConfig === true,
          );
          if (hasInvalidMemberConfig) {
            return errAsync(
              stateError(
                `Council ${id} includes member agents with invalid model configuration`,
                "Cannot resume because one or more council members have invalid model configuration.",
              ),
            );
          }

          if (council.topic.trim().length === 0) {
            return errAsync(
              validationError(
                `Council ${id} cannot resume without a topic`,
                "Topic is required before resuming the council.",
              ),
            );
          }

          if (council.memberAgentIds.length === 0) {
            return errAsync(
              validationError(
                `Council ${id} cannot resume without members`,
                "At least one member is required before resuming the council.",
              ),
            );
          }

          if (council.mode !== "autopilot") {
            return errAsync(
              stateError(
                `Council ${id} is not autopilot`,
                "Only Autopilot councils can be resumed.",
              ),
            );
          }

          if (council.archivedAtUtc !== null) {
            return errAsync(
              stateError(`Council ${id} is archived`, "Archived councils are read-only."),
            );
          }

          if (council.startedAtUtc === null) {
            return errAsync(
              stateError(`Council ${id} is not started`, "Start the council before resuming."),
            );
          }

          if (!council.autopilotPaused) {
            return errAsync(
              stateError(`Council ${id} is already running`, "Autopilot is already running."),
            );
          }

          if (
            isModelConfigInvalid({
              modelRefOrNull: council.conductorModelRefOrNull,
              globalDefaultModelRef: modelContext.globalDefaultModelRef,
              availableModelKeys,
            })
          ) {
            return errAsync(
              stateError(
                `Council ${id} has invalid model configuration`,
                "Cannot resume because model configuration is invalid.",
              ),
            );
          }

          const normalizedMaxTurns = normalizeAutopilotMaxTurns(maxTurns);
          const now = dependencies.nowUtc();
          const next: CouncilRecord = {
            ...council,
            autopilotPaused: false,
            autopilotMaxTurns: normalizedMaxTurns,
            autopilotTurnsCompleted: 0,
            updatedAtUtc: now,
          };

          return persistCouncil(next).andThen(() => {
            records.set(next.id, next);
            return okAsync({
              council: toCouncilDto({
                record: next,
                availableModelKeys,
                globalDefaultModelRef: modelContext.globalDefaultModelRef,
              }),
            } satisfies ResumeCouncilAutopilotResponse);
          });
        }),
    );

  const generateManualTurn: CouncilsSlice["generateManualTurn"] = ({
    webContentsId,
    id,
    memberAgentId,
  }) =>
    loadCouncilWithModelContext({
      webContentsId,
      councilId: id,
      viewKind: "councilView",
    }).andThen(({ council, modelContext, availableModelKeys }) => {
      if (council.mode !== "manual") {
        return errAsync(
          stateError(
            `Council ${id} is not manual`,
            "Manual speaker selection is only available in Manual mode.",
          ),
        );
      }
      if (council.archivedAtUtc !== null) {
        return errAsync(
          stateError(`Council ${id} is archived`, "Archived councils are read-only."),
        );
      }
      if (council.startedAtUtc === null) {
        return errAsync(
          stateError(`Council ${id} is not started`, "Start the council before generating turns."),
        );
      }

      const selectedMemberId = asAgentId(memberAgentId);
      if (!council.memberAgentIds.includes(selectedMemberId)) {
        return errAsync(
          validationError(
            `Member ${memberAgentId} is not part of council ${id}`,
            "Selected member does not belong to this council.",
          ),
        );
      }

      const availableAgentById = new Map<string, CouncilAgentOptionDto>();
      return dependencies
        .listAvailableAgents({
          webContentsId,
          viewKind: "councilCreate",
        })
        .andThen((availableAgents) => {
          for (const agent of availableAgents) {
            availableAgentById.set(agent.id, agent);
          }
          return ensureNoActiveGeneration(council.id).andThen(() =>
            getRuntimeBriefing(council.id).andThen((previousBriefing) =>
              getCouncilMessages(council.id).map((existingMessages) => ({
                previousBriefing,
                existingMessages,
              })),
            ),
          );
        })
        .andThen(({ previousBriefing, existingMessages }) => {
          const speakerName = availableAgentById.get(memberAgentId)?.name ?? memberAgentId;

          return generateTextWithRefreshRetry({
            webContentsId,
            council,
            modelContext,
            kind: "manualMemberTurn",
            memberAgentId: selectedMemberId,
            promptRole: "member",
            promptContent: buildMemberTurnPrompt({
              council,
              speakerName,
              previousBriefing,
              messages: existingMessages,
            }),
          }).andThen((generatedText) => okAsync({ generatedText, previousBriefing }));
        })
        .andThen(({ generatedText, previousBriefing }) => {
          const now = dependencies.nowUtc();
          const nextCouncil: CouncilRecord = {
            ...council,
            turnCount: council.turnCount + 1,
            updatedAtUtc: now,
          };

          return persistCouncil(nextCouncil).andThen(() => {
            records.set(nextCouncil.id, nextCouncil);
            return appendMessage({
              id: dependencies.createMessageId(),
              councilId: council.id,
              senderKind: "member",
              senderAgentId: selectedMemberId,
              senderName: availableAgentById.get(memberAgentId)?.name ?? memberAgentId,
              senderColor: council.memberColorsByAgentId[memberAgentId] ?? null,
              content: generatedText,
              createdAtUtc: now,
            }).andThen((message) =>
              getCouncilMessages(council.id).andThen((allMessages) =>
                runConductorBriefingDecision({
                  webContentsId,
                  council: nextCouncil,
                  modelContext,
                  previousBriefing,
                  messages: allMessages,
                  mode: "manual",
                  eligibleMemberAgentIds: [],
                }).andThen((decision) =>
                  persistBriefing({
                    councilId: council.id,
                    briefing: decision.briefing,
                    goalReached: decision.goalReached,
                    updatedAtUtc: now,
                  }).map(
                    () =>
                      ({
                        council: toCouncilDto({
                          record: nextCouncil,
                          availableModelKeys,
                          globalDefaultModelRef: modelContext.globalDefaultModelRef,
                        }),
                        message: toCouncilMessageDto(message),
                      }) satisfies GenerateManualCouncilTurnResponse,
                  ),
                ),
              ),
            );
          });
        })
        .orElse((error) => {
          if (error.kind !== "ProviderError") {
            return errAsync(error);
          }

          return pauseAutopilotAfterError({ council, error }).andThen((pausedError) =>
            errAsync(pausedError),
          );
        });
    });

  const injectConductorMessage: CouncilsSlice["injectConductorMessage"] = ({
    webContentsId,
    id,
    content,
  }) =>
    loadCouncilWithModelContext({
      webContentsId,
      councilId: id,
      viewKind: "councilView",
    }).andThen(({ council, modelContext, availableModelKeys }) => {
      if (council.archivedAtUtc !== null) {
        return errAsync(
          stateError(`Council ${id} is archived`, "Archived councils are read-only."),
        );
      }
      if (council.startedAtUtc === null) {
        return errAsync(
          stateError(`Council ${id} is not started`, "Start the council before posting messages."),
        );
      }

      const normalizedContent = content.trim();
      if (normalizedContent.length === 0) {
        return errAsync(
          validationError(`Council ${id} empty conductor message`, "Message cannot be empty."),
        );
      }

      const now = dependencies.nowUtc();
      return getRuntimeBriefing(council.id).andThen((previousBriefing) =>
        appendMessage({
          id: dependencies.createMessageId(),
          councilId: council.id,
          senderKind: "conductor",
          senderAgentId: null,
          senderName: "Conductor",
          senderColor: null,
          content: normalizedContent,
          createdAtUtc: now,
        }).andThen((message) =>
          getCouncilMessages(council.id).andThen((allMessages) =>
            runConductorBriefingDecision({
              webContentsId,
              council,
              modelContext,
              previousBriefing,
              messages: allMessages,
              mode: "manual",
              eligibleMemberAgentIds: [],
            }).andThen((decision) =>
              persistBriefing({
                councilId: council.id,
                briefing: decision.briefing,
                goalReached: decision.goalReached,
                updatedAtUtc: now,
              }).map(
                () =>
                  ({
                    council: toCouncilDto({
                      record: council,
                      availableModelKeys,
                      globalDefaultModelRef: modelContext.globalDefaultModelRef,
                    }),
                    message: toCouncilMessageDto(message),
                  }) satisfies InjectConductorMessageResponse,
              ),
            ),
          ),
        ),
      );
    });

  const advanceAutopilotTurn: CouncilsSlice["advanceAutopilotTurn"] = ({ webContentsId, id }) => {
    const startTime = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    dependencies.logger?.info("autopilot", "advanceTurnStart", {
      requestId,
      councilId: id,
    });

    return loadCouncilWithModelContext({
      webContentsId,
      councilId: id,
      viewKind: "councilView",
    }).andThen(({ council, modelContext, availableModelKeys }) => {
      dependencies.logger?.info("autopilot", "advanceTurnCouncilState", {
        requestId,
        councilId: id,
        mode: council.mode,
        started: council.startedAtUtc !== null,
        paused: council.autopilotPaused,
        archived: council.archivedAtUtc !== null,
        turnsCompleted: council.autopilotTurnsCompleted,
        maxTurns: council.autopilotMaxTurns,
      });

      if (council.mode !== "autopilot") {
        return errAsync(
          stateError(
            `Council ${id} is not autopilot`,
            "Autopilot turn advance is only available in Autopilot mode.",
          ),
        );
      }
      if (council.archivedAtUtc !== null) {
        return errAsync(
          stateError(`Council ${id} is archived`, "Archived councils are read-only."),
        );
      }
      if (council.startedAtUtc === null) {
        return errAsync(
          stateError(`Council ${id} is not started`, "Start the council before advancing turns."),
        );
      }
      if (council.autopilotPaused) {
        return errAsync(
          stateError(`Council ${id} is paused`, "Resume Autopilot before advancing turns."),
        );
      }

      if (
        council.autopilotMaxTurns !== null &&
        council.autopilotTurnsCompleted >= council.autopilotMaxTurns
      ) {
        const now = dependencies.nowUtc();
        const pausedByLimitCouncil: CouncilRecord = {
          ...council,
          autopilotPaused: true,
          updatedAtUtc: now,
        };

        return persistCouncil(pausedByLimitCouncil).andThen(() => {
          records.set(pausedByLimitCouncil.id, pausedByLimitCouncil);
          plannedNextSpeakerByCouncilId.delete(pausedByLimitCouncil.id);
          return errAsync(
            stateError(
              `Council ${id} reached configured max turns`,
              "Autopilot reached its turn limit. Resume with a new limit to continue.",
            ),
          );
        });
      }

      return ensureNoActiveGeneration(council.id)
        .andThen(() => getRuntimeBriefing(council.id))
        .andThen((previousBriefing) =>
          getCouncilMessages(council.id).andThen((messages) => {
            const lastMemberMessage = [...messages]
              .reverse()
              .find((message) => message.senderKind === "member");
            const eligibleMembers =
              lastMemberMessage === undefined
                ? council.memberAgentIds
                : council.memberAgentIds.filter(
                    (memberId) => memberId !== lastMemberMessage.senderAgentId,
                  );
            const plannedSpeaker = plannedNextSpeakerByCouncilId.get(council.id);
            const selectedMember =
              plannedSpeaker !== undefined && eligibleMembers.includes(plannedSpeaker)
                ? plannedSpeaker
                : (eligibleMembers[0] ?? council.memberAgentIds[0]);
            if (selectedMember === undefined) {
              return errAsync(
                validationError(
                  `Council ${id} has no members`,
                  "Council has no members to generate turns.",
                ),
              );
            }

            return dependencies
              .listAvailableAgents({
                webContentsId,
                viewKind: "councilCreate",
              })
              .andThen((availableAgents) => {
                const memberName =
                  availableAgents.find((agent) => agent.id === selectedMember)?.name ??
                  selectedMember;

                return generateTextWithRefreshRetry({
                  webContentsId,
                  council,
                  modelContext,
                  kind: "autopilotStep",
                  memberAgentId: selectedMember,
                  promptRole: "member",
                  promptContent: buildMemberTurnPrompt({
                    council,
                    speakerName: memberName,
                    previousBriefing,
                    messages,
                  }),
                }).andThen((generatedText) => {
                  const now = dependencies.nowUtc();

                  return appendMessage({
                    id: dependencies.createMessageId(),
                    councilId: council.id,
                    senderKind: "member",
                    senderAgentId: selectedMember,
                    senderName: memberName,
                    senderColor: council.memberColorsByAgentId[selectedMember] ?? null,
                    content: generatedText,
                    createdAtUtc: now,
                  }).andThen((message) =>
                    getCouncilMessages(council.id).andThen((allMessages) => {
                      const nextEligibleMembers = council.memberAgentIds.filter(
                        (memberId) => memberId !== selectedMember,
                      );
                      const normalizedEligibleMembers =
                        nextEligibleMembers.length > 0 ? nextEligibleMembers : [selectedMember];

                      return runConductorBriefingDecision({
                        webContentsId,
                        council,
                        modelContext,
                        previousBriefing,
                        messages: allMessages,
                        mode: "autopilot",
                        eligibleMemberAgentIds: normalizedEligibleMembers,
                      }).andThen((decision) => {
                        const plannedNextSpeaker =
                          normalizedEligibleMembers.length === 1
                            ? normalizedEligibleMembers[0]
                            : decision.nextSpeakerAgentId;
                        if (plannedNextSpeaker === null || plannedNextSpeaker === undefined) {
                          return errAsync(
                            stateError(
                              `Conductor returned null next speaker for autopilot council ${id}`,
                              "Autopilot could not select the next speaker.",
                            ),
                          );
                        }

                        const nextAutopilotTurnsCompleted = council.autopilotTurnsCompleted + 1;
                        const reachedTurnLimit =
                          council.autopilotMaxTurns !== null &&
                          nextAutopilotTurnsCompleted >= council.autopilotMaxTurns;

                        if (decision.goalReached || reachedTurnLimit) {
                          plannedNextSpeakerByCouncilId.delete(council.id);
                        } else {
                          plannedNextSpeakerByCouncilId.set(
                            council.id,
                            asAgentId(plannedNextSpeaker),
                          );
                        }

                        const nextCouncil: CouncilRecord = {
                          ...council,
                          turnCount: council.turnCount + 1,
                          autopilotTurnsCompleted: nextAutopilotTurnsCompleted,
                          autopilotPaused:
                            decision.goalReached || reachedTurnLimit
                              ? true
                              : council.autopilotPaused,
                          updatedAtUtc: now,
                        };

                        return persistBriefing({
                          councilId: council.id,
                          briefing: decision.briefing,
                          goalReached: decision.goalReached,
                          updatedAtUtc: now,
                        }).andThen(() =>
                          persistCouncil(nextCouncil).map(() => {
                            records.set(nextCouncil.id, nextCouncil);
                            const durationMs = Date.now() - startTime;
                            dependencies.logger?.info("autopilot", "advanceTurnSuccess", {
                              requestId,
                              councilId: id,
                              durationMs,
                              outcome: "success",
                              turnsCompleted: nextAutopilotTurnsCompleted,
                              goalReached: decision.goalReached,
                              reachedTurnLimit,
                            });
                            return {
                              council: toCouncilDto({
                                record: nextCouncil,
                                availableModelKeys,
                                globalDefaultModelRef: modelContext.globalDefaultModelRef,
                              }),
                              message: toCouncilMessageDto(message),
                              selectedMemberAgentId: selectedMember,
                            } satisfies AdvanceAutopilotTurnResponse;
                          }),
                        );
                      });
                    }),
                  );
                });
              });
          }),
        )
        .orElse((error) => {
          const durationMs = Date.now() - startTime;
          dependencies.logger?.error("autopilot", "advanceTurnError", error.devMessage, {
            requestId,
            councilId: id,
            durationMs,
            outcome: "error",
            errorKind: error.kind,
            errorMessage: error.userMessage,
          });
          return pauseAutopilotAfterError({ council, error }).andThen((pausedError) =>
            errAsync(pausedError),
          );
        });
    });
  };

  const cancelGeneration: CouncilsSlice["cancelGeneration"] = ({ id }) =>
    hydrate().map(() => ({ cancelled: cancelInFlightGeneration(asCouncilId(id)) }));

  const exportTranscript: CouncilsSlice["exportTranscript"] = ({ webContentsId, id }) =>
    hydrate()
      .andThen(() => getExistingCouncil(id))
      .andThen((council) =>
        getCouncilMessages(council.id).andThen((messages) =>
          dependencies.exportService
            .saveMarkdownFile({
              webContentsId,
              suggestedFileName: council.title,
              markdown: toTranscriptMarkdown({
                council,
                messages,
              }),
            })
            .mapErr((errorKind) => {
              if (errorKind === "ExportDialogError") {
                return domainError(
                  "InternalError",
                  `Council ${id} failed opening export dialog`,
                  "Export failed before the file dialog could open.",
                );
              }

              return domainError(
                "InternalError",
                `Council ${id} failed writing transcript export`,
                "Export failed while writing the transcript file.",
              );
            }),
        ),
      );

  const countCouncilsUsingAgent: CouncilsSlice["countCouncilsUsingAgent"] = (agentId) =>
    hydrate().map(
      () =>
        Array.from(records.values()).filter((council) => council.memberAgentIds.includes(agentId))
          .length,
    );

  return {
    listCouncils,
    getEditorView,
    getCouncilView,
    saveCouncil,
    deleteCouncil,
    setArchived,
    startCouncil,
    pauseCouncilAutopilot,
    resumeCouncilAutopilot,
    generateManualTurn,
    injectConductorMessage,
    advanceAutopilotTurn,
    cancelGeneration,
    exportTranscript,
    countCouncilsUsingAgent,
    refreshModelCatalog: dependencies.refreshModelCatalog,
  };
};

export type { CouncilRecord, CouncilsSlice, CouncilsSliceDependencies };
