import type { ResultAsync } from "neverthrow";
import { type DomainError, domainError } from "../../../shared/domain/errors.js";
import type {
  AdvanceAutopilotTurnResponse,
  CancelCouncilGenerationResponse,
  DeleteCouncilResponse,
  ExportCouncilTranscriptResponse,
  GenerateManualCouncilTurnResponse,
  GetCouncilEditorViewResponse,
  GetCouncilViewResponse,
  InjectConductorMessageResponse,
  IpcResult,
  ListCouncilsResponse,
  PauseCouncilAutopilotResponse,
  RefreshModelCatalogResponse,
  ResumeCouncilAutopilotResponse,
  SaveCouncilResponse,
  SetCouncilArchivedResponse,
  StartCouncilResponse,
} from "../../../shared/ipc/dto.js";
import {
  ADVANCE_AUTOPILOT_TURN_REQUEST_SCHEMA,
  CANCEL_COUNCIL_GENERATION_REQUEST_SCHEMA,
  DELETE_COUNCIL_REQUEST_SCHEMA,
  EXPORT_COUNCIL_TRANSCRIPT_REQUEST_SCHEMA,
  GENERATE_MANUAL_COUNCIL_TURN_REQUEST_SCHEMA,
  GET_COUNCIL_EDITOR_VIEW_REQUEST_SCHEMA,
  GET_COUNCIL_VIEW_REQUEST_SCHEMA,
  INJECT_CONDUCTOR_MESSAGE_REQUEST_SCHEMA,
  LIST_COUNCILS_REQUEST_SCHEMA,
  PAUSE_COUNCIL_AUTOPILOT_REQUEST_SCHEMA,
  REFRESH_MODEL_CATALOG_REQUEST_SCHEMA,
  RESUME_COUNCIL_AUTOPILOT_REQUEST_SCHEMA,
  SAVE_COUNCIL_REQUEST_SCHEMA,
  SET_COUNCIL_ARCHIVED_REQUEST_SCHEMA,
  START_COUNCIL_REQUEST_SCHEMA,
} from "../../../shared/ipc/validators.js";
import type { CouncilsSlice } from "./slice.js";

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

  getCouncilView: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<GetCouncilViewResponse>> => {
    const parsed = GET_COUNCIL_VIEW_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid getCouncilView payload.");
    }

    return toIpcResult(
      slice.getCouncilView({
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

  startCouncil: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<StartCouncilResponse>> => {
    const parsed = START_COUNCIL_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid startCouncil payload.");
    }

    return toIpcResult(
      slice.startCouncil({
        webContentsId,
        id: parsed.data.id,
        maxTurns: parsed.data.maxTurns,
      }),
    );
  },

  pauseCouncilAutopilot: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<PauseCouncilAutopilotResponse>> => {
    const parsed = PAUSE_COUNCIL_AUTOPILOT_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid pauseCouncilAutopilot payload.");
    }

    return toIpcResult(
      slice.pauseCouncilAutopilot({
        webContentsId,
        id: parsed.data.id,
      }),
    );
  },

  resumeCouncilAutopilot: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<ResumeCouncilAutopilotResponse>> => {
    const parsed = RESUME_COUNCIL_AUTOPILOT_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid resumeCouncilAutopilot payload.");
    }

    return toIpcResult(
      slice.resumeCouncilAutopilot({
        webContentsId,
        id: parsed.data.id,
        maxTurns: parsed.data.maxTurns,
      }),
    );
  },

  generateManualTurn: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<GenerateManualCouncilTurnResponse>> => {
    const parsed = GENERATE_MANUAL_COUNCIL_TURN_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid generateManualTurn payload.");
    }

    return toIpcResult(
      slice.generateManualTurn({
        webContentsId,
        id: parsed.data.id,
        memberAgentId: parsed.data.memberAgentId,
      }),
    );
  },

  injectConductorMessage: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<InjectConductorMessageResponse>> => {
    const parsed = INJECT_CONDUCTOR_MESSAGE_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid injectConductorMessage payload.");
    }

    return toIpcResult(
      slice.injectConductorMessage({
        webContentsId,
        id: parsed.data.id,
        content: parsed.data.content,
      }),
    );
  },

  advanceAutopilotTurn: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<AdvanceAutopilotTurnResponse>> => {
    const parsed = ADVANCE_AUTOPILOT_TURN_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid advanceAutopilotTurn payload.");
    }

    return toIpcResult(
      slice.advanceAutopilotTurn({
        webContentsId,
        id: parsed.data.id,
      }),
    );
  },

  cancelGeneration: async (
    payload: unknown,
  ): Promise<IpcResult<CancelCouncilGenerationResponse>> => {
    const parsed = CANCEL_COUNCIL_GENERATION_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid cancelGeneration payload.");
    }

    return toIpcResult(
      slice.cancelGeneration({
        id: parsed.data.id,
      }),
    );
  },

  exportTranscript: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<ExportCouncilTranscriptResponse>> => {
    const parsed = EXPORT_COUNCIL_TRANSCRIPT_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid exportCouncilTranscript payload.");
    }

    return toIpcResult(
      slice.exportTranscript({
        webContentsId,
        id: parsed.data.id,
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

    if (
      parsed.data.viewKind !== "councilsList" &&
      parsed.data.viewKind !== "councilCreate" &&
      parsed.data.viewKind !== "councilView"
    ) {
      return toValidationFailure(
        "Councils refreshModelCatalog only supports councilsList, councilCreate, or councilView.",
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
