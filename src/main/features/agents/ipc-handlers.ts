import type { ResultAsync } from "neverthrow";
import { type DomainError, domainError } from "../../../shared/domain/errors.js";
import type {
  DeleteAgentResponse,
  GetAgentEditorViewResponse,
  IpcResult,
  ListAgentsResponse,
  RefreshModelCatalogResponse,
  SaveAgentResponse,
  SetAgentArchivedResponse,
} from "../../../shared/ipc/dto.js";
import {
  DELETE_AGENT_REQUEST_SCHEMA,
  GET_AGENT_EDITOR_VIEW_REQUEST_SCHEMA,
  LIST_AGENTS_REQUEST_SCHEMA,
  REFRESH_MODEL_CATALOG_REQUEST_SCHEMA,
  SAVE_AGENT_REQUEST_SCHEMA,
  SET_AGENT_ARCHIVED_REQUEST_SCHEMA,
} from "../../../shared/ipc/validators.js";
import type { AgentsSlice } from "./slice.js";

const toValidationFailure = (message: string): IpcResult<never> => ({
  ok: false,
  error: domainError("ValidationError", message, "Invalid request."),
});

const sanitizeDomainError = (error: DomainError): DomainError => ({
  ...error,
  devMessage: "Redacted at IPC boundary.",
  details: undefined,
});

const toIpcResult = async <T>(operation: ResultAsync<T, DomainError>): Promise<IpcResult<T>> => {
  const result = await operation;
  return result.match(
    (value) => ({
      ok: true,
      value,
    }),
    (error) => ({
      ok: false,
      error: sanitizeDomainError(error),
    }),
  );
};

export const createAgentsIpcHandlers = (slice: AgentsSlice) => ({
  listAgents: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<ListAgentsResponse>> => {
    const parsed = LIST_AGENTS_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid listAgents payload.");
    }

    return toIpcResult(
      slice.listAgents({
        webContentsId,
        searchText: parsed.data.searchText,
        tagFilter: parsed.data.tagFilter,
        archivedFilter: parsed.data.archivedFilter,
        sortBy: parsed.data.sortBy,
        sortDirection: parsed.data.sortDirection,
        page: parsed.data.page,
      }),
    );
  },

  getEditorView: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<GetAgentEditorViewResponse>> => {
    const parsed = GET_AGENT_EDITOR_VIEW_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid getAgentEditorView payload.");
    }

    return toIpcResult(
      slice.getEditorView({
        webContentsId,
        agentId: parsed.data.agentId,
      }),
    );
  },

  saveAgent: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<SaveAgentResponse>> => {
    const parsed = SAVE_AGENT_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid saveAgent payload.");
    }

    return toIpcResult(
      slice.saveAgent({
        webContentsId,
        draft: parsed.data,
      }),
    );
  },

  deleteAgent: async (payload: unknown): Promise<IpcResult<DeleteAgentResponse>> => {
    const parsed = DELETE_AGENT_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid deleteAgent payload.");
    }

    return toIpcResult(slice.deleteAgent({ id: parsed.data.id }));
  },

  setArchived: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<SetAgentArchivedResponse>> => {
    const parsed = SET_AGENT_ARCHIVED_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid setAgentArchived payload.");
    }

    return toIpcResult(
      slice.setArchived({
        webContentsId,
        id: parsed.data.id,
        archived: parsed.data.archived,
      }),
    );
  },

  refreshModelCatalog: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<RefreshModelCatalogResponse>> => {
    const parsed = REFRESH_MODEL_CATALOG_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid refreshModelCatalog payload.");
    }

    if (parsed.data.viewKind !== "agentsList" && parsed.data.viewKind !== "agentEdit") {
      return toValidationFailure(
        "Agents refreshModelCatalog only supports agentsList or agentEdit views.",
      );
    }

    return toIpcResult(
      slice.refreshModelCatalog({
        webContentsId,
        viewKind: parsed.data.viewKind,
      }),
    );
  },
});
