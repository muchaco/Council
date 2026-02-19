import type { ResultAsync } from "neverthrow";
import { type DomainError, domainError } from "../../../shared/domain/errors.js";
import type {
  GetSettingsViewResponse,
  IpcResult,
  RefreshModelCatalogResponse,
  SaveProviderConfigResponse,
  SetContextLastNResponse,
  SetGlobalDefaultModelResponse,
  TestProviderConnectionResponse,
} from "../../../shared/ipc/dto.js";
import {
  GET_SETTINGS_VIEW_REQUEST_SCHEMA,
  REFRESH_MODEL_CATALOG_REQUEST_SCHEMA,
  SAVE_PROVIDER_CONFIG_REQUEST_SCHEMA,
  SET_CONTEXT_LAST_N_REQUEST_SCHEMA,
  SET_GLOBAL_DEFAULT_MODEL_REQUEST_SCHEMA,
  TEST_PROVIDER_CONNECTION_REQUEST_SCHEMA,
} from "../../../shared/ipc/validators.js";
import type { SettingsSlice } from "./slice.js";

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

export const createSettingsIpcHandlers = (slice: SettingsSlice) => ({
  getSettingsView: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<GetSettingsViewResponse>> => {
    const parsed = GET_SETTINGS_VIEW_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid getSettingsView payload.");
    }

    return toIpcResult(
      slice.getSettingsView({
        webContentsId,
        viewKind: parsed.data.viewKind,
      }),
    );
  },

  testProviderConnection: async (
    payload: unknown,
  ): Promise<IpcResult<TestProviderConnectionResponse>> => {
    const parsed = TEST_PROVIDER_CONNECTION_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid testProviderConnection payload.");
    }

    return toIpcResult(slice.testProviderConnection({ provider: parsed.data.provider }));
  },

  saveProviderConfig: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<SaveProviderConfigResponse>> => {
    const parsed = SAVE_PROVIDER_CONFIG_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid saveProviderConfig payload.");
    }

    return toIpcResult(
      slice.saveProviderConfig({
        webContentsId,
        provider: parsed.data.provider,
        testToken: parsed.data.testToken,
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

    return toIpcResult(
      slice.refreshModelCatalog({
        webContentsId,
        viewKind: parsed.data.viewKind,
      }),
    );
  },

  setGlobalDefaultModel: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<SetGlobalDefaultModelResponse>> => {
    const parsed = SET_GLOBAL_DEFAULT_MODEL_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid setGlobalDefaultModel payload.");
    }

    return toIpcResult(
      slice.setGlobalDefaultModel({
        webContentsId,
        viewKind: parsed.data.viewKind,
        modelRefOrNull: parsed.data.modelRefOrNull,
      }),
    );
  },

  setContextLastN: async (
    payload: unknown,
    webContentsId: number,
  ): Promise<IpcResult<SetContextLastNResponse>> => {
    const parsed = SET_CONTEXT_LAST_N_REQUEST_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      return toValidationFailure("Invalid setContextLastN payload.");
    }

    return toIpcResult(
      slice.setContextLastN({
        webContentsId,
        viewKind: parsed.data.viewKind,
        contextLastN: parsed.data.contextLastN,
      }),
    );
  },
});
