import type { ResultAsync } from "neverthrow";

export type DbService = {
  verifyConnection: () => ResultAsync<void, "DbConnectionError">;
};

export type KeychainService = {
  saveSecret: (params: {
    account: string;
    secret: string;
  }) => ResultAsync<void, "KeychainUnavailableError" | "KeychainWriteError">;
  deleteSecret: (params: {
    account: string;
  }) => ResultAsync<void, "KeychainUnavailableError" | "KeychainWriteError">;
  loadSecret: (params: {
    account: string;
  }) => ResultAsync<string | null, "KeychainUnavailableError" | "KeychainReadError">;
};

export type AiServiceGenerateTextRequest = {
  providerId: string;
  modelId: string;
  messages: ReadonlyArray<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
};

export type AiServiceError = {
  kind: "ProviderError";
  message: string;
  providerId: string;
  modelId: string;
};

export type AiService = {
  generateText: (
    request: AiServiceGenerateTextRequest,
    abortSignal: AbortSignal,
  ) => ResultAsync<{ text: string }, AiServiceError>;
};

export type ModelCatalogService = {
  getCatalogSnapshot: (params: {
    webContentsId: number;
    viewKind:
      | "settings"
      | "agentsList"
      | "agentEdit"
      | "councilsList"
      | "councilCreate"
      | "councilView";
  }) => ResultAsync<
    {
      snapshotId: string;
      modelsByProvider: Record<string, ReadonlyArray<string>>;
    },
    "ProviderError"
  >;
};

export type ExportService = {
  saveMarkdownFile: (params: {
    webContentsId: number;
    suggestedFileName: string;
    markdown: string;
  }) => ResultAsync<
    | {
        status: "exported";
        filePath: string;
      }
    | {
        status: "cancelled";
        filePath: null;
      },
    "ExportDialogError" | "ExportWriteError"
  >;
};
