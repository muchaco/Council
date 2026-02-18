import { type ResultAsync, errAsync, okAsync } from "neverthrow";
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
  CouncilAgentOptionDto,
  CouncilDto,
  DeleteCouncilResponse,
  GetCouncilEditorViewResponse,
  ListCouncilsResponse,
  ModelCatalogSnapshotDto,
  RefreshModelCatalogResponse,
  SaveCouncilRequest,
  SaveCouncilResponse,
  SetCouncilArchivedResponse,
} from "../../../shared/ipc/dto.js";

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
  createdAtUtc: string;
  updatedAtUtc: string;
};

type CouncilModelContext = {
  modelCatalog: ModelCatalogSnapshotDto;
  globalDefaultModelRef: ModelRef | null;
  canRefreshModels: boolean;
};

type CouncilsSliceDependencies = {
  nowUtc: () => string;
  createCouncilId: () => CouncilId;
  pageSize: number;
  getModelContext: (params: {
    webContentsId: number;
    viewKind: "councilsList" | "councilCreate";
  }) => ResultAsync<CouncilModelContext, DomainError>;
  refreshModelCatalog: (params: {
    webContentsId: number;
    viewKind: "councilsList" | "councilCreate";
  }) => ResultAsync<RefreshModelCatalogResponse, DomainError>;
  listAvailableAgents: (params: {
    webContentsId: number;
    viewKind: "councilCreate";
  }) => ResultAsync<ReadonlyArray<CouncilAgentOptionDto>, DomainError>;
  loadPersistedCouncils?: () => ResultAsync<ReadonlyArray<CouncilRecord>, DomainError>;
  persistCouncil?: (council: CouncilRecord) => ResultAsync<void, DomainError>;
  persistCouncilDeletion?: (councilId: CouncilId) => ResultAsync<void, DomainError>;
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
  countCouncilsUsingAgent: (agentId: AgentId) => ResultAsync<number, DomainError>;
  refreshModelCatalog: (params: {
    webContentsId: number;
    viewKind: "councilsList" | "councilCreate";
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
  createdAtUtc: params.record.createdAtUtc,
  updatedAtUtc: params.record.updatedAtUtc,
});

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
  let hydrated = dependencies.loadPersistedCouncils === undefined;

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
            viewKind: "councilCreate",
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

        return dependencies
          .getModelContext({
            webContentsId,
            viewKind: "councilCreate",
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
  };

  const deleteCouncil: CouncilsSlice["deleteCouncil"] = ({ id }) =>
    hydrate().andThen(() => {
      const councilId = asCouncilId(id);
      const existing = records.get(councilId);
      if (existing === undefined) {
        return errAsync(notFoundError(`Council ${id} not found`, "Council not found."));
      }

      return persistCouncilDeletion(councilId).andThen(() => {
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

      const now = dependencies.nowUtc();
      const next: CouncilRecord = {
        ...existing,
        archivedAtUtc: archived ? (existing.archivedAtUtc ?? now) : null,
        updatedAtUtc: now,
      };

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

  const countCouncilsUsingAgent: CouncilsSlice["countCouncilsUsingAgent"] = (agentId) =>
    hydrate().map(
      () =>
        Array.from(records.values()).filter((council) => council.memberAgentIds.includes(agentId))
          .length,
    );

  return {
    listCouncils,
    getEditorView,
    saveCouncil,
    deleteCouncil,
    setArchived,
    countCouncilsUsingAgent,
    refreshModelCatalog: dependencies.refreshModelCatalog,
  };
};

export type { CouncilRecord, CouncilsSlice, CouncilsSliceDependencies };
