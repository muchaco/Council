import type { ResultAsync } from "neverthrow";
import { type DomainError, domainError } from "../../../shared/domain/errors.js";
import type {
  DeleteCouncilResponse,
  GetCouncilEditorViewResponse,
  IpcResult,
  ListCouncilsResponse,
  RefreshModelCatalogResponse,
  SaveCouncilResponse,
  SetCouncilArchivedResponse,
} from "../../../shared/ipc/dto.js";
import {
  DELETE_COUNCIL_REQUEST_SCHEMA,
  GET_COUNCIL_EDITOR_VIEW_REQUEST_SCHEMA,
  LIST_COUNCILS_REQUEST_SCHEMA,
  REFRESH_MODEL_CATALOG_REQUEST_SCHEMA,
  SAVE_COUNCIL_REQUEST_SCHEMA,
  SET_COUNCIL_ARCHIVED_REQUEST_SCHEMA,
} from "../../../shared/ipc/validators.js";
import type { CouncilsSlice } from "./slice.js";

const toValidationFailure = (message: string): IpcResult<never> => ({
  ok: false,
  error: domainError("ValidationError", message, "Invalid request."),
});

const sanitizeDomainError = (error: DomainError): DomainError => ({
  ...error,
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

export const createCouncilsIpcHandlers = (slice: CouncilsSlice) => ({
  listCouncils: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<ListCouncilsResponse>> => {
    const parsed = LIST_COUNCILS_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid listCouncils payload.");
    }

    return toIpcResult(
      slice.listCouncils({
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
  ): Promise<IpcResult<GetCouncilEditorViewResponse>> => {
    const parsed = GET_COUNCIL_EDITOR_VIEW_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid getCouncilEditorView payload.");
    }

    return toIpcResult(
      slice.getEditorView({
        webContentsId,
        councilId: parsed.data.councilId,
      }),
    );
  },

  saveCouncil: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<SaveCouncilResponse>> => {
    const parsed = SAVE_COUNCIL_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid saveCouncil payload.");
    }

    return toIpcResult(
      slice.saveCouncil({
        webContentsId,
        draft: parsed.data,
      }),
    );
  },

  deleteCouncil: async (payload: unknown): Promise<IpcResult<DeleteCouncilResponse>> => {
    const parsed = DELETE_COUNCIL_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid deleteCouncil payload.");
    }

    return toIpcResult(slice.deleteCouncil({ id: parsed.data.id }));
  },

  setArchived: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<SetCouncilArchivedResponse>> => {
    const parsed = SET_COUNCIL_ARCHIVED_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid setCouncilArchived payload.");
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

    if (parsed.data.viewKind !== "councilsList" && parsed.data.viewKind !== "councilCreate") {
      return toValidationFailure(
        "Councils refreshModelCatalog only supports councilsList or councilCreate views.",
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
