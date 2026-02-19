import { ResultAsync } from "neverthrow";
import type { KeychainService } from "../interfaces.js";

type KeytarClient = {
  setPassword: (service: string, account: string, password: string) => Promise<void>;
  getPassword: (service: string, account: string) => Promise<string | null>;
};

type KeytarServiceDependencies = {
  serviceName?: string;
  keytarClient?: KeytarClient;
  loadClient?: () => Promise<KeytarClient>;
};

const DEFAULT_SERVICE_NAME = "council3";

const KEYCHAIN_UNAVAILABLE_MESSAGE_HINTS: ReadonlyArray<string> = [
  "org.freedesktop.secrets",
  "secret service",
  "keyring",
  "dbus",
  "cannot autolaunch",
  "not available",
  "unavailable",
  "module not found",
];

const asObjectRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return null;
};

const hasKeytarFunctions = (value: unknown): value is KeytarClient => {
  const candidate = asObjectRecord(value);
  return (
    typeof candidate?.setPassword === "function" && typeof candidate?.getPassword === "function"
  );
};

const resolveKeytarClient = (loadedModule: unknown): KeytarClient | null => {
  if (hasKeytarFunctions(loadedModule)) {
    return loadedModule;
  }

  const record = asObjectRecord(loadedModule);
  if (hasKeytarFunctions(record?.default)) {
    return record.default;
  }

  return null;
};

const loadKeytarClient = async (): Promise<KeytarClient> => {
  const moduleSpecifier = "keytar";
  const loadedModule = await import(moduleSpecifier);
  const client = resolveKeytarClient(loadedModule);
  if (client === null) {
    throw new Error("Keytar module loaded but did not expose setPassword()/getPassword().");
  }
  return client;
};

const isUnavailableError = (error: unknown): boolean => {
  const record = asObjectRecord(error);
  const code = typeof record?.code === "string" ? record.code.toLowerCase() : "";
  const message =
    typeof record?.message === "string"
      ? record.message.toLowerCase()
      : error instanceof Error
        ? error.message.toLowerCase()
        : "";

  if (code === "module_not_found" || code === "err_module_not_found") {
    return true;
  }

  if (KEYCHAIN_UNAVAILABLE_MESSAGE_HINTS.some((hint) => message.includes(hint))) {
    return true;
  }

  return false;
};

const toSaveErrorKind = (error: unknown): "KeychainUnavailableError" | "KeychainWriteError" => {
  if (isUnavailableError(error)) {
    return "KeychainUnavailableError";
  }

  return "KeychainWriteError";
};

const toLoadErrorKind = (error: unknown): "KeychainUnavailableError" | "KeychainReadError" => {
  if (isUnavailableError(error)) {
    return "KeychainUnavailableError";
  }

  return "KeychainReadError";
};

export const createKeytarKeychainService = (
  dependencies: KeytarServiceDependencies = {},
): KeychainService => {
  const serviceName = dependencies.serviceName ?? DEFAULT_SERVICE_NAME;
  const loadClient = dependencies.loadClient ?? loadKeytarClient;

  return {
    saveSecret: ({ account, secret }) =>
      ResultAsync.fromPromise(
        (async () => {
          const keytar = dependencies.keytarClient ?? (await loadClient());
          await keytar.setPassword(serviceName, account, secret);
        })(),
        toSaveErrorKind,
      ),
    loadSecret: ({ account }) =>
      ResultAsync.fromPromise(
        (async () => {
          const keytar = dependencies.keytarClient ?? (await loadClient());
          return keytar.getPassword(serviceName, account);
        })(),
        toLoadErrorKind,
      ),
  };
};

export type { KeytarClient };
