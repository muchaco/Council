import type { ResultAsync } from "neverthrow";

export type DbService = {
  verifyConnection: () => ResultAsync<void, "DbConnectionError">;
};

export type KeychainService = {
  saveSecret: (params: {
    account: string;
    secret: string;
  }) => ResultAsync<void, "KeychainUnavailableError" | "KeychainWriteError">;
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

export type AiService = {
  generateText: (
    request: AiServiceGenerateTextRequest,
    abortSignal: AbortSignal,
  ) => ResultAsync<{ text: string }, "ProviderError">;
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
