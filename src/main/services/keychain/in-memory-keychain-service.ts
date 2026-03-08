import { type ResultAsync, okAsync } from "neverthrow";
import type { KeychainService } from "../interfaces.js";

export const createInMemoryKeychainService = (): KeychainService => {
  const secrets = new Map<string, string>();

  return {
    saveSecret: (params): ResultAsync<void, "KeychainUnavailableError" | "KeychainWriteError"> => {
      secrets.set(params.account, params.secret);
      return okAsync(undefined);
    },
    deleteSecret: (
      params,
    ): ResultAsync<void, "KeychainUnavailableError" | "KeychainWriteError"> => {
      secrets.delete(params.account);
      return okAsync(undefined);
    },
    loadSecret: (
      params,
    ): ResultAsync<string | null, "KeychainUnavailableError" | "KeychainReadError"> =>
      okAsync(secrets.get(params.account) ?? null),
  };
};
