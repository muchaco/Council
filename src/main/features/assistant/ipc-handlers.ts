import type { ResultAsync } from "neverthrow";
import { type DomainError, domainError } from "../../../shared/domain/errors.js";
import type {
  AssistantCancelSessionResponse,
  AssistantCloseSessionResponse,
  AssistantCreateSessionResponse,
  AssistantSubmitResponse,
  IpcResult,
} from "../../../shared/ipc/dto.js";
import {
  ASSISTANT_CANCEL_SESSION_REQUEST_SCHEMA,
  ASSISTANT_CLOSE_SESSION_REQUEST_SCHEMA,
  ASSISTANT_CREATE_SESSION_REQUEST_SCHEMA,
  ASSISTANT_SUBMIT_REQUEST_SCHEMA,
} from "../../../shared/ipc/validators.js";
import type { AssistantSlice } from "./slice.js";

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

export const createAssistantIpcHandlers = (slice: AssistantSlice) => ({
  createSession: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<AssistantCreateSessionResponse>> => {
    const parsed = ASSISTANT_CREATE_SESSION_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid assistant.createSession payload.");
    }

    return toIpcResult(
      slice.createSession({
        webContentsId,
        viewKind: parsed.data.viewKind,
      }),
    );
  },

  submit: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<AssistantSubmitResponse>> => {
    const parsed = ASSISTANT_SUBMIT_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid assistant.submit payload.");
    }

    return toIpcResult(
      slice.submitRequest({
        webContentsId,
        request: parsed.data,
      }),
    );
  },

  cancelSession: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<AssistantCancelSessionResponse>> => {
    const parsed = ASSISTANT_CANCEL_SESSION_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid assistant.cancelSession payload.");
    }

    return toIpcResult(
      slice.cancelSession({
        sessionId: parsed.data.sessionId,
        webContentsId,
      }),
    );
  },

  closeSession: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<AssistantCloseSessionResponse>> => {
    const parsed = ASSISTANT_CLOSE_SESSION_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid assistant.closeSession payload.");
    }

    return toIpcResult(
      slice.closeSession({
        sessionId: parsed.data.sessionId,
        webContentsId,
      }),
    );
  },
});
