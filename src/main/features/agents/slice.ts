import { type ResultAsync, errAsync, okAsync } from "neverthrow";
import { type DomainError, domainError } from "../../../shared/domain/errors.js";
import { type AgentId, asAgentId } from "../../../shared/domain/ids.js";
import {
  type ModelRef,
  buildAvailableModelKeys,
  isModelConfigInvalid,
} from "../../../shared/domain/model-ref.js";
import { type Tag, addTag } from "../../../shared/domain/tag.js";
import type {
  AgentDto,
  DeleteAgentResponse,
  GetAgentEditorViewResponse,
  ListAgentsResponse,
  ModelCatalogSnapshotDto,
  RefreshModelCatalogResponse,
  SaveAgentRequest,
  SaveAgentResponse,
} from "../../../shared/ipc/dto.js";

type AgentRecord = {
  id: AgentId;
  name: string;
  systemPrompt: string;
  verbosity: string | null;
  temperature: number | null;
  tags: ReadonlyArray<Tag>;
  modelRefOrNull: ModelRef | null;
  createdAtUtc: string;
  updatedAtUtc: string;
};

type AgentModelContext = {
  modelCatalog: ModelCatalogSnapshotDto;
  globalDefaultModelRef: ModelRef | null;
  canRefreshModels: boolean;
};

type AgentSliceDependencies = {
  nowUtc: () => string;
  createAgentId: () => AgentId;
  pageSize: number;
  getModelContext: (params: {
    webContentsId: number;
    viewKind: "agentsList" | "agentEdit";
  }) => ResultAsync<AgentModelContext, DomainError>;
  refreshModelCatalog: (params: {
    webContentsId: number;
    viewKind: "agentsList" | "agentEdit";
  }) => ResultAsync<RefreshModelCatalogResponse, DomainError>;
  loadPersistedAgents?: () => ResultAsync<ReadonlyArray<AgentRecord>, DomainError>;
  persistAgent?: (agent: AgentRecord) => ResultAsync<void, DomainError>;
  persistAgentDeletion?: (agentId: AgentId) => ResultAsync<void, DomainError>;
  canDeleteAgent?: (agentId: AgentId) => ResultAsync<boolean, DomainError>;
};

type AgentsSlice = {
  listAgents: (params: {
    webContentsId: number;
    searchText: string;
    tagFilter: string;
    sortBy: "createdAt" | "updatedAt";
    sortDirection: "asc" | "desc";
    page: number;
  }) => ResultAsync<ListAgentsResponse, DomainError>;
  getEditorView: (params: {
    webContentsId: number;
    agentId: string | null;
  }) => ResultAsync<GetAgentEditorViewResponse, DomainError>;
  saveAgent: (params: {
    webContentsId: number;
    draft: SaveAgentRequest;
  }) => ResultAsync<SaveAgentResponse, DomainError>;
  deleteAgent: (params: { id: string }) => ResultAsync<DeleteAgentResponse, DomainError>;
  refreshModelCatalog: (params: {
    webContentsId: number;
    viewKind: "agentsList" | "agentEdit";
  }) => ResultAsync<RefreshModelCatalogResponse, DomainError>;
};

const validationError = (devMessage: string, userMessage: string): DomainError =>
  domainError("ValidationError", devMessage, userMessage);

const notFoundError = (devMessage: string, userMessage: string): DomainError =>
  domainError("NotFoundError", devMessage, userMessage);

const conflictError = (devMessage: string, userMessage: string): DomainError =>
  domainError("ConflictError", devMessage, userMessage);

const invalidConfigError = (devMessage: string, userMessage: string): DomainError =>
  domainError("InvalidConfigError", devMessage, userMessage);

const normalizeNullable = (value: string | null): string | null => {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
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
          `Tag validation failed with ${next.error}`,
          "Tags must be unique, non-empty, and at most 3 per agent.",
        ),
      );
    }
    tags = next.value;
  }

  return okAsync(tags);
};

const includesInsensitive = (text: string, query: string): boolean =>
  text.toLowerCase().includes(query.toLowerCase());

const toAgentDto = (params: {
  record: AgentRecord;
  availableModelKeys: ReadonlySet<string>;
  globalDefaultModelRef: ModelRef | null;
}): AgentDto => ({
  id: params.record.id,
  name: params.record.name,
  systemPrompt: params.record.systemPrompt,
  verbosity: params.record.verbosity,
  temperature: params.record.temperature,
  tags: [...params.record.tags],
  modelRefOrNull: params.record.modelRefOrNull,
  invalidConfig: isModelConfigInvalid({
    modelRefOrNull: params.record.modelRefOrNull,
    globalDefaultModelRef: params.globalDefaultModelRef,
    availableModelKeys: params.availableModelKeys,
  }),
  createdAtUtc: params.record.createdAtUtc,
  updatedAtUtc: params.record.updatedAtUtc,
});

export const createAgentsSlice = (
  dependencies: AgentSliceDependencies,
  initialAgents: ReadonlyArray<AgentRecord> = [],
): AgentsSlice => {
  const nowUtc = dependencies.nowUtc;
  const createAgentId = dependencies.createAgentId;
  const pageSize = dependencies.pageSize;
  const loadPersistedAgents = dependencies.loadPersistedAgents ?? (() => okAsync([]));
  const persistAgent = dependencies.persistAgent ?? (() => okAsync(undefined));
  const persistAgentDeletion = dependencies.persistAgentDeletion ?? (() => okAsync(undefined));
  const canDeleteAgent = dependencies.canDeleteAgent ?? (() => okAsync(true));
  const records = new Map<AgentId, AgentRecord>(initialAgents.map((agent) => [agent.id, agent]));
  let hydrated = dependencies.loadPersistedAgents === undefined;

  const hydrate = (): ResultAsync<void, DomainError> => {
    if (hydrated) {
      return okAsync(undefined);
    }

    return loadPersistedAgents().map((persistedAgents) => {
      records.clear();
      for (const agent of persistedAgents) {
        records.set(agent.id, agent);
      }
      hydrated = true;
    });
  };

  const assertUniqueName = (
    candidateName: string,
    existingId: AgentId | null,
  ): ResultAsync<void, DomainError> => {
    const duplicate = Array.from(records.values()).find(
      (agent) =>
        agent.name.toLowerCase() === candidateName.toLowerCase() && agent.id !== existingId,
    );

    if (duplicate !== undefined) {
      return errAsync(
        conflictError(`Duplicate agent name ${candidateName}`, "Agent name must be unique."),
      );
    }

    return okAsync(undefined);
  };

  const listAgents: AgentsSlice["listAgents"] = ({
    webContentsId,
    searchText,
    tagFilter,
    sortBy,
    sortDirection,
    page,
  }) => {
    const normalizedSearch = searchText.trim().toLowerCase();
    const normalizedTagFilter = tagFilter.trim().toLowerCase();

    return hydrate()
      .andThen(() =>
        dependencies.getModelContext({
          webContentsId,
          viewKind: "agentsList",
        }),
      )
      .andThen((modelContext) => {
        const availableModelKeys = buildAvailableModelKeys(
          modelContext.modelCatalog.modelsByProvider,
        );
        const filtered = Array.from(records.values())
          .filter((agent) => {
            const matchesSearch =
              normalizedSearch.length === 0 ||
              includesInsensitive(agent.name, normalizedSearch) ||
              includesInsensitive(agent.systemPrompt, normalizedSearch);
            const matchesTag =
              normalizedTagFilter.length === 0 ||
              agent.tags.some((tag) => tag.toLowerCase() === normalizedTagFilter);
            return matchesSearch && matchesTag;
          })
          .sort((left, right) => {
            const leftValue = sortBy === "createdAt" ? left.createdAtUtc : left.updatedAtUtc;
            const rightValue = sortBy === "createdAt" ? right.createdAtUtc : right.updatedAtUtc;
            const order = leftValue.localeCompare(rightValue);
            return sortDirection === "asc" ? order : -order;
          });

        const start = (page - 1) * pageSize;
        const paged = filtered.slice(start, start + pageSize);

        return okAsync({
          items: paged.map((record) =>
            toAgentDto({
              record,
              availableModelKeys,
              globalDefaultModelRef: modelContext.globalDefaultModelRef,
            }),
          ),
          page,
          pageSize,
          total: filtered.length,
          hasMore: start + pageSize < filtered.length,
          modelCatalog: modelContext.modelCatalog,
          globalDefaultModelRef: modelContext.globalDefaultModelRef,
        } satisfies ListAgentsResponse);
      });
  };

  const getEditorView: AgentsSlice["getEditorView"] = ({ webContentsId, agentId }) =>
    hydrate()
      .andThen(() =>
        dependencies.getModelContext({
          webContentsId,
          viewKind: "agentEdit",
        }),
      )
      .andThen((modelContext) => {
        const availableModelKeys = buildAvailableModelKeys(
          modelContext.modelCatalog.modelsByProvider,
        );
        if (agentId === null) {
          return okAsync({
            agent: null,
            modelCatalog: modelContext.modelCatalog,
            globalDefaultModelRef: modelContext.globalDefaultModelRef,
            canRefreshModels: modelContext.canRefreshModels,
          } satisfies GetAgentEditorViewResponse);
        }

        const record = records.get(asAgentId(agentId));
        if (record === undefined) {
          return errAsync(notFoundError(`Agent ${agentId} not found`, "Agent not found."));
        }

        return okAsync({
          agent: toAgentDto({
            record,
            availableModelKeys,
            globalDefaultModelRef: modelContext.globalDefaultModelRef,
          }),
          modelCatalog: modelContext.modelCatalog,
          globalDefaultModelRef: modelContext.globalDefaultModelRef,
          canRefreshModels: modelContext.canRefreshModels,
        } satisfies GetAgentEditorViewResponse);
      });

  const saveAgent: AgentsSlice["saveAgent"] = ({ webContentsId, draft }) => {
    const normalizedName = draft.name.trim();
    const normalizedPrompt = draft.systemPrompt.trim();
    const normalizedVerbosity = normalizeNullable(draft.verbosity);

    if (normalizedName.length === 0 || normalizedPrompt.length === 0) {
      return errAsync(
        validationError(
          "Agent save failed due to empty required fields",
          "Name and System Prompt are required.",
        ),
      );
    }

    return hydrate().andThen(() => {
      const existingId = draft.id === null ? null : asAgentId(draft.id);
      const existingRecord = existingId === null ? undefined : records.get(existingId);
      if (draft.id !== null && existingRecord === undefined) {
        return errAsync(notFoundError(`Agent ${draft.id} not found`, "Agent not found."));
      }

      return normalizeTags(draft.tags)
        .andThen((tags) =>
          assertUniqueName(normalizedName, existingId).map(() => ({
            tags,
            existingId,
            existingRecord,
          })),
        )
        .andThen(({ tags, existingId, existingRecord }) =>
          dependencies
            .getModelContext({
              webContentsId,
              viewKind: "agentEdit",
            })
            .andThen((modelContext) => {
              const availableModelKeys = buildAvailableModelKeys(
                modelContext.modelCatalog.modelsByProvider,
              );
              const invalidConfig = isModelConfigInvalid({
                modelRefOrNull: draft.modelRefOrNull,
                globalDefaultModelRef: modelContext.globalDefaultModelRef,
                availableModelKeys,
              });

              if (invalidConfig) {
                return errAsync(
                  invalidConfigError(
                    "Agent save blocked due to unavailable model resolution",
                    "Selected model configuration is invalid in this view. Refresh models or change the model.",
                  ),
                );
              }

              const now = nowUtc();
              const id = existingId ?? createAgentId();
              const record: AgentRecord = {
                id,
                name: normalizedName,
                systemPrompt: normalizedPrompt,
                verbosity: normalizedVerbosity,
                temperature: draft.temperature,
                tags,
                modelRefOrNull: draft.modelRefOrNull,
                createdAtUtc: existingRecord?.createdAtUtc ?? now,
                updatedAtUtc: now,
              };

              return persistAgent(record).andThen(() => {
                records.set(id, record);

                return okAsync({
                  agent: toAgentDto({
                    record,
                    availableModelKeys,
                    globalDefaultModelRef: modelContext.globalDefaultModelRef,
                  }),
                } satisfies SaveAgentResponse);
              });
            }),
        );
    });
  };

  const deleteAgent: AgentsSlice["deleteAgent"] = ({ id }) => {
    return hydrate().andThen(() => {
      const agentId = asAgentId(id);
      const exists = records.has(agentId);
      if (!exists) {
        return errAsync(notFoundError(`Agent ${id} not found`, "Agent not found."));
      }

      return canDeleteAgent(agentId).andThen((allowed) => {
        if (!allowed) {
          return errAsync(
            conflictError(
              `Agent ${id} is referenced by at least one council`,
              "Agent is used by one or more councils and cannot be deleted.",
            ),
          );
        }

        return persistAgentDeletion(agentId).andThen(() => {
          records.delete(agentId);
          return okAsync({ deletedId: id } satisfies DeleteAgentResponse);
        });
      });
    });
  };

  return {
    listAgents,
    getEditorView,
    saveAgent,
    deleteAgent,
    refreshModelCatalog: dependencies.refreshModelCatalog,
  };
};

export type { AgentsSlice, AgentSliceDependencies };
