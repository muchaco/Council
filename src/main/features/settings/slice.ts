import { ResultAsync, errAsync, okAsync } from "neverthrow";
import {
  DEFAULT_CONTEXT_LAST_N,
  MAX_CONTEXT_LAST_N,
  MIN_CONTEXT_LAST_N,
  normalizeContextLastN,
} from "../../../shared/council-runtime-context-window.js";
import { type DomainError, domainError } from "../../../shared/domain/errors.js";
import {
  type ModelCatalogByProvider,
  type ModelRef,
  buildAvailableModelKeys,
  isModelConfigInvalid,
  modelKey,
} from "../../../shared/domain/model-ref.js";
import type {
  GetSettingsViewResponse,
  ModelCatalogSnapshotDto,
  ProviderConfigDto,
  ProviderDraftDto,
  ProviderId,
  RefreshModelCatalogResponse,
  SaveProviderConfigResponse,
  SetContextLastNResponse,
  SetGlobalDefaultModelResponse,
  TestProviderConnectionResponse,
  ViewKind,
} from "../../../shared/ipc/dto.js";

type PersistedProviderConfig = {
  providerId: ProviderId;
  endpointUrl: string | null;
  credentialRef: string | null;
  lastSavedAtUtc: string;
};

type ProviderTestState = {
  providerId: ProviderId;
  fingerprint: string;
  testToken: string;
  models: ReadonlyArray<string>;
};

type SettingsState = {
  globalDefaultModelRef: ModelRef | null;
  contextLastN: number;
};

type SettingsSliceDependencies = {
  nowUtc: () => string;
  randomToken: () => string;
  fetchOllamaModels: (params: {
    endpointUrl: string;
    apiKey: string | null;
  }) => ResultAsync<ReadonlyArray<string>, DomainError>;
  fetchGeminiModels: (params: {
    endpointUrl: string | null;
    apiKey: string;
  }) => ResultAsync<ReadonlyArray<string>, DomainError>;
  fetchOpenRouterModels: (params: {
    endpointUrl: string | null;
    apiKey: string;
  }) => ResultAsync<ReadonlyArray<string>, DomainError>;
  saveSecret: (params: {
    account: string;
    secret: string;
  }) => ResultAsync<void, "KeychainUnavailableError" | "KeychainWriteError">;
  loadSecret: (params: {
    account: string;
  }) => ResultAsync<string | null, "KeychainUnavailableError" | "KeychainReadError">;
  loadPersistedState: () => ResultAsync<
    {
      globalDefaultModelRef: ModelRef | null;
      contextLastN: number;
      providerConfigs: ReadonlyArray<{
        providerId: ProviderId;
        endpointUrl: string | null;
        credentialRef: string | null;
        lastSavedAtUtc: string;
        models: ReadonlyArray<string>;
      }>;
    },
    DomainError
  >;
  persistProviderConfig: (params: {
    providerId: ProviderId;
    endpointUrl: string | null;
    credentialRef: string | null;
    lastSavedAtUtc: string;
    models: ReadonlyArray<string>;
  }) => ResultAsync<void, DomainError>;
  persistGlobalDefaultModel: (params: {
    modelRefOrNull: ModelRef | null;
    updatedAtUtc: string;
  }) => ResultAsync<void, DomainError>;
  persistContextLastN: (params: {
    contextLastN: number;
    updatedAtUtc: string;
  }) => ResultAsync<void, DomainError>;
};

type SettingsSlice = {
  getSettingsView: (params: {
    webContentsId: number;
    viewKind: ViewKind;
  }) => ResultAsync<GetSettingsViewResponse, DomainError>;
  testProviderConnection: (params: {
    provider: ProviderDraftDto;
  }) => ResultAsync<TestProviderConnectionResponse, DomainError>;
  saveProviderConfig: (params: {
    webContentsId: number;
    provider: ProviderDraftDto;
    testToken: string;
  }) => ResultAsync<SaveProviderConfigResponse, DomainError>;
  refreshModelCatalog: (params: {
    webContentsId: number;
    viewKind: ViewKind;
  }) => ResultAsync<RefreshModelCatalogResponse, DomainError>;
  setGlobalDefaultModel: (params: {
    webContentsId: number;
    viewKind: ViewKind;
    modelRefOrNull: ModelRef | null;
  }) => ResultAsync<SetGlobalDefaultModelResponse, DomainError>;
  setContextLastN: (params: {
    webContentsId: number;
    viewKind: ViewKind;
    contextLastN: number;
  }) => ResultAsync<SetContextLastNResponse, DomainError>;
  getContextLastN: () => number;
  releaseViewSnapshots: (webContentsId: number) => void;
};

const PROVIDER_MODELS: Record<ProviderId, ReadonlyArray<string>> = {
  gemini: ["gemini-1.5-flash", "gemini-1.5-pro"],
  ollama: ["llama3.1", "qwen2.5", "mistral"],
  openrouter: ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet"],
};

const PROVIDERS_REQUIRING_API_KEY = new Set<ProviderId>(["gemini", "openrouter"]);

const PROVIDERS_REQUIRING_ENDPOINT = new Set<ProviderId>(["ollama"]);
const DEFAULT_OLLAMA_ENDPOINT = "http://127.0.0.1:11434";
const DEFAULT_OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1";
const DEFAULT_GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com";

const PROVIDER_ORDER: ReadonlyArray<ProviderId> = ["gemini", "ollama", "openrouter"];

const normalizeNullable = (value: string | null): string | null => {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeOllamaEndpoint = (endpointUrl: string | null): string => {
  const normalized = normalizeNullable(endpointUrl);
  return normalized ?? DEFAULT_OLLAMA_ENDPOINT;
};

const parseOllamaModelNames = (payload: unknown): ReadonlyArray<string> => {
  if (typeof payload !== "object" || payload === null) {
    return [];
  }

  const modelsValue = (payload as { models?: unknown }).models;
  if (!Array.isArray(modelsValue)) {
    return [];
  }

  const names = modelsValue
    .map((model) =>
      typeof model === "object" && model !== null ? (model as { name?: unknown }).name : undefined,
    )
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0);

  return Array.from(new Set(names));
};

const parseGeminiModelNames = (payload: unknown): ReadonlyArray<string> => {
  if (typeof payload !== "object" || payload === null) {
    return [];
  }

  const modelsValue = (payload as { models?: unknown }).models;
  if (!Array.isArray(modelsValue)) {
    return [];
  }

  const names = modelsValue
    .map((model) => {
      if (typeof model !== "object" || model === null) {
        return null;
      }

      const rawName = (model as { name?: unknown }).name;
      if (typeof rawName !== "string" || rawName.trim().length === 0) {
        return null;
      }

      const methods = (model as { supportedGenerationMethods?: unknown })
        .supportedGenerationMethods;
      const supportsGenerateContent =
        Array.isArray(methods) &&
        methods.some((value) => value === "generateContent" || value === "streamGenerateContent");
      if (!supportsGenerateContent) {
        return null;
      }

      const trimmed = rawName.trim();
      return trimmed.startsWith("models/") ? trimmed.slice("models/".length) : trimmed;
    })
    .filter((name): name is string => typeof name === "string" && name.length > 0);

  return Array.from(new Set(names));
};

const parseOpenRouterModelNames = (payload: unknown): ReadonlyArray<string> => {
  if (typeof payload !== "object" || payload === null) {
    return [];
  }

  const dataValue = (payload as { data?: unknown }).data;
  if (!Array.isArray(dataValue)) {
    return [];
  }

  const names = dataValue
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return undefined;
      }
      const id = (item as { id?: unknown }).id;
      return typeof id === "string" && id.trim().length > 0 ? id.trim() : undefined;
    })
    .filter((name): name is string => typeof name === "string" && name.length > 0);

  return Array.from(new Set(names));
};

const createFetchOllamaModels = (
  providerErrorFactory: (devMessage: string, userMessage: string) => DomainError,
): SettingsSliceDependencies["fetchOllamaModels"] => {
  return ({ endpointUrl, apiKey }) => {
    const normalizedEndpoint = normalizeOllamaEndpoint(endpointUrl);
    const normalizedApiKey = normalizeNullable(apiKey);

    return ResultAsync.fromPromise(
      (async () => {
        const tagsUrl = new URL("/api/tags", normalizedEndpoint).toString();
        const response = await fetch(tagsUrl, {
          headers:
            normalizedApiKey === null
              ? undefined
              : {
                  Authorization: `Bearer ${normalizedApiKey}`,
                },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        return parseOllamaModelNames(payload);
      })(),
      (error) =>
        providerErrorFactory(
          `Failed to fetch Ollama models from ${normalizedEndpoint}: ${error instanceof Error ? error.message : String(error)}`,
          "Could not fetch Ollama models. Check endpoint and make sure Ollama is running.",
        ),
    );
  };
};

const createFetchGeminiModels = (
  providerErrorFactory: (devMessage: string, userMessage: string) => DomainError,
): SettingsSliceDependencies["fetchGeminiModels"] => {
  return ({ endpointUrl, apiKey }) => {
    const endpoint = normalizeNullable(endpointUrl) ?? DEFAULT_GEMINI_ENDPOINT;
    return ResultAsync.fromPromise(
      (async () => {
        const listUrl = new URL("/v1beta/models", endpoint).toString();
        const response = await fetch(listUrl, {
          headers: {
            "x-goog-api-key": apiKey,
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        const models = parseGeminiModelNames(payload);
        if (models.length === 0) {
          throw new Error("No supported models returned");
        }
        return models;
      })(),
      (error) =>
        providerErrorFactory(
          `Failed to fetch Gemini models from ${endpoint}: ${error instanceof Error ? error.message : String(error)}`,
          "Could not fetch Gemini models. Check credentials and endpoint.",
        ),
    );
  };
};

const createFetchOpenRouterModels = (
  providerErrorFactory: (devMessage: string, userMessage: string) => DomainError,
): SettingsSliceDependencies["fetchOpenRouterModels"] => {
  return ({ endpointUrl, apiKey }) => {
    const endpoint = normalizeNullable(endpointUrl) ?? DEFAULT_OPENROUTER_ENDPOINT;
    return ResultAsync.fromPromise(
      (async () => {
        const listUrl = new URL("/models", endpoint).toString();
        const response = await fetch(listUrl, {
          headers: {
            authorization: `Bearer ${apiKey}`,
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        const models = parseOpenRouterModelNames(payload);
        if (models.length === 0) {
          throw new Error("No supported models returned");
        }
        return models;
      })(),
      (error) =>
        providerErrorFactory(
          `Failed to fetch OpenRouter models from ${endpoint}: ${error instanceof Error ? error.message : String(error)}`,
          "Could not fetch OpenRouter models. Check credentials and endpoint.",
        ),
    );
  };
};

const fingerprintProviderDraft = (provider: ProviderDraftDto): string =>
  JSON.stringify({
    providerId: provider.providerId,
    endpointUrl: normalizeNullable(provider.endpointUrl),
    apiKey: normalizeNullable(provider.apiKey),
  });

const toProviderConfigDto = (
  providerId: ProviderId,
  persisted: PersistedProviderConfig | undefined,
): ProviderConfigDto => ({
  providerId,
  endpointUrl: persisted?.endpointUrl ?? null,
  hasCredential: persisted?.credentialRef !== null && persisted?.credentialRef !== undefined,
  lastSavedAtUtc: persisted?.lastSavedAtUtc ?? null,
});

const emptyModelCatalogSnapshot = (snapshotId: string): ModelCatalogSnapshotDto => ({
  snapshotId,
  modelsByProvider: {},
});

const validationError = (devMessage: string, userMessage: string): DomainError =>
  domainError("ValidationError", devMessage, userMessage);

const providerError = (devMessage: string, userMessage: string): DomainError =>
  domainError("ProviderError", devMessage, userMessage);

const invalidConfigError = (devMessage: string, userMessage: string): DomainError =>
  domainError("InvalidConfigError", devMessage, userMessage);

export const createSettingsSlice = (
  dependencies: Partial<SettingsSliceDependencies> = {},
): SettingsSlice => {
  const nowUtc = dependencies.nowUtc ?? (() => new Date().toISOString());
  const randomToken = dependencies.randomToken ?? (() => crypto.randomUUID());

  const persistedProviderConfigs = new Map<ProviderId, PersistedProviderConfig>();
  const keychainSecrets = new Map<string, string>();
  const saveSecret =
    dependencies.saveSecret ??
    ((params: { account: string; secret: string }) => {
      keychainSecrets.set(params.account, params.secret);
      return okAsync(undefined);
    });
  const fetchOllamaModels =
    dependencies.fetchOllamaModels ?? createFetchOllamaModels(providerError);
  const fetchGeminiModels =
    dependencies.fetchGeminiModels ?? createFetchGeminiModels(providerError);
  const fetchOpenRouterModels =
    dependencies.fetchOpenRouterModels ?? createFetchOpenRouterModels(providerError);
  const loadSecret =
    dependencies.loadSecret ??
    ((params: { account: string }) => okAsync(keychainSecrets.get(params.account) ?? null));
  const loadPersistedState =
    dependencies.loadPersistedState ??
    (() =>
      okAsync({
        globalDefaultModelRef: null,
        contextLastN: DEFAULT_CONTEXT_LAST_N,
        providerConfigs: [],
      }));
  const persistProviderConfig = dependencies.persistProviderConfig ?? (() => okAsync(undefined));
  const persistGlobalDefaultModel =
    dependencies.persistGlobalDefaultModel ?? (() => okAsync(undefined));
  const persistContextLastN = dependencies.persistContextLastN ?? (() => okAsync(undefined));
  const providerTests = new Map<ProviderId, ProviderTestState>();
  const providerModels = new Map<ProviderId, ReadonlyArray<string>>();
  const settingsState: SettingsState = {
    globalDefaultModelRef: null,
    contextLastN: DEFAULT_CONTEXT_LAST_N,
  };
  const snapshots = new Map<string, ModelCatalogSnapshotDto>();
  let hydrated = false;

  const hydrate = (): ResultAsync<void, DomainError> => {
    if (hydrated) {
      return okAsync(undefined);
    }

    return loadPersistedState().map((persisted) => {
      settingsState.globalDefaultModelRef = persisted.globalDefaultModelRef;
      settingsState.contextLastN = normalizeContextLastN(
        persisted.contextLastN,
        DEFAULT_CONTEXT_LAST_N,
      );
      persistedProviderConfigs.clear();
      providerModels.clear();

      for (const providerConfig of persisted.providerConfigs) {
        persistedProviderConfigs.set(providerConfig.providerId, {
          providerId: providerConfig.providerId,
          endpointUrl: providerConfig.endpointUrl,
          credentialRef: providerConfig.credentialRef,
          lastSavedAtUtc: providerConfig.lastSavedAtUtc,
        });
        providerModels.set(providerConfig.providerId, providerConfig.models);
      }

      hydrated = true;
    });
  };

  const buildCatalogFromConfiguredProviders = (): ModelCatalogByProvider => {
    const catalog: ModelCatalogByProvider = {};
    for (const providerId of [
      "gemini",
      "ollama",
      "openrouter",
    ] satisfies ReadonlyArray<ProviderId>) {
      if (persistedProviderConfigs.has(providerId)) {
        catalog[providerId] = providerModels.get(providerId) ?? PROVIDER_MODELS[providerId];
      }
    }
    return catalog;
  };

  const resolveProviderModels = (
    provider: ProviderDraftDto,
  ): ResultAsync<ReadonlyArray<string>, DomainError> => {
    if (provider.providerId === "gemini") {
      const apiKey = normalizeNullable(provider.apiKey);
      if (apiKey === null) {
        return errAsync(
          validationError(
            "Provider gemini requires API key",
            "API key is required for this provider.",
          ),
        );
      }

      return fetchGeminiModels({
        endpointUrl: provider.endpointUrl,
        apiKey,
      });
    }

    if (provider.providerId === "openrouter") {
      const apiKey = normalizeNullable(provider.apiKey);
      if (apiKey === null) {
        return errAsync(
          validationError(
            "Provider openrouter requires API key",
            "API key is required for this provider.",
          ),
        );
      }

      return fetchOpenRouterModels({
        endpointUrl: provider.endpointUrl,
        apiKey,
      });
    }

    if (provider.providerId === "ollama") {
      return fetchOllamaModels({
        endpointUrl: normalizeOllamaEndpoint(provider.endpointUrl),
        apiKey: normalizeNullable(provider.apiKey),
      });
    }

    return errAsync(
      providerError(
        `Unsupported provider during model resolution: ${provider.providerId}`,
        "Provider is not supported.",
      ),
    );
  };

  const refreshConfiguredProviderModels = (): ResultAsync<void, DomainError> => {
    let chain: ResultAsync<void, DomainError> = okAsync(undefined);

    for (const persisted of persistedProviderConfigs.values()) {
      chain = chain.andThen(() => {
        if (persisted.providerId === "ollama") {
          return (
            persisted.credentialRef === null
              ? okAsync<string | null>(null)
              : loadSecret({ account: persisted.credentialRef }).mapErr(() =>
                  providerError(
                    `Failed to load credential for provider ${persisted.providerId}`,
                    `Could not read stored credentials for ${persisted.providerId}. Re-save provider settings and try again.`,
                  ),
                )
          ).andThen((apiKey) =>
            fetchOllamaModels({
              endpointUrl: normalizeOllamaEndpoint(persisted.endpointUrl),
              apiKey,
            }).map((models) => {
              providerModels.set(persisted.providerId, models);
            }),
          );
        }

        if (persisted.credentialRef === null) {
          return errAsync(
            providerError(
              `Missing credential reference for provider ${persisted.providerId}`,
              `Stored credentials for ${persisted.providerId} are missing. Re-save provider settings and try again.`,
            ),
          );
        }

        return loadSecret({ account: persisted.credentialRef })
          .mapErr(() =>
            providerError(
              `Failed to load credential for provider ${persisted.providerId}`,
              `Could not read stored credentials for ${persisted.providerId}. Re-save provider settings and try again.`,
            ),
          )
          .andThen((apiKey) => {
            const normalizedApiKey = normalizeNullable(apiKey);
            if (normalizedApiKey === null) {
              return errAsync(
                providerError(
                  `Empty credential loaded for provider ${persisted.providerId}`,
                  `Stored credentials for ${persisted.providerId} are invalid. Re-save provider settings and try again.`,
                ),
              );
            }

            if (persisted.providerId === "gemini") {
              return fetchGeminiModels({
                endpointUrl: persisted.endpointUrl,
                apiKey: normalizedApiKey,
              }).map((models) => {
                providerModels.set(persisted.providerId, models);
              });
            }

            if (persisted.providerId === "openrouter") {
              return fetchOpenRouterModels({
                endpointUrl: persisted.endpointUrl,
                apiKey: normalizedApiKey,
              }).map((models) => {
                providerModels.set(persisted.providerId, models);
              });
            }

            return errAsync(
              providerError(
                `Unsupported provider during model refresh: ${persisted.providerId}`,
                "Provider is not supported.",
              ),
            );
          });
      });
    }

    return chain;
  };

  const snapshotKey = (webContentsId: number, viewKind: ViewKind): string =>
    `${webContentsId}:${viewKind}`;

  const clearSnapshotsForWebContents = (webContentsId: number): void => {
    const prefix = `${webContentsId}:`;
    for (const key of snapshots.keys()) {
      if (key.startsWith(prefix)) {
        snapshots.delete(key);
      }
    }
  };

  const refreshSnapshot = (webContentsId: number, viewKind: ViewKind): ModelCatalogSnapshotDto => {
    const snapshot: ModelCatalogSnapshotDto = {
      snapshotId: randomToken(),
      modelsByProvider: buildCatalogFromConfiguredProviders(),
    };
    snapshots.set(snapshotKey(webContentsId, viewKind), snapshot);
    return snapshot;
  };

  const getOrCreateSnapshot = (
    webContentsId: number,
    viewKind: ViewKind,
  ): ModelCatalogSnapshotDto => {
    const key = snapshotKey(webContentsId, viewKind);
    const existing = snapshots.get(key);
    if (existing !== undefined) {
      return existing;
    }
    return refreshSnapshot(webContentsId, viewKind);
  };

  const isGlobalDefaultInvalidConfig = (snapshot: ModelCatalogSnapshotDto): boolean =>
    isModelConfigInvalid({
      modelRefOrNull: settingsState.globalDefaultModelRef,
      globalDefaultModelRef: settingsState.globalDefaultModelRef,
      availableModelKeys: buildAvailableModelKeys(snapshot.modelsByProvider),
    });

  const validateProviderDraft = (provider: ProviderDraftDto): ResultAsync<void, DomainError> => {
    const normalizedEndpoint = normalizeNullable(provider.endpointUrl);
    const normalizedApiKey = normalizeNullable(provider.apiKey);

    if (PROVIDERS_REQUIRING_ENDPOINT.has(provider.providerId) && normalizedEndpoint === null) {
      return errAsync(
        validationError(
          `Provider ${provider.providerId} requires endpoint URL`,
          "Endpoint URL is required for this provider.",
        ),
      );
    }

    if (PROVIDERS_REQUIRING_API_KEY.has(provider.providerId) && normalizedApiKey === null) {
      return errAsync(
        validationError(
          `Provider ${provider.providerId} requires API key`,
          "API key is required for this provider.",
        ),
      );
    }

    return okAsync(undefined);
  };

  const testProviderConnection = ({ provider }: { provider: ProviderDraftDto }) =>
    hydrate()
      .andThen(() => validateProviderDraft(provider))
      .andThen(() => resolveProviderModels(provider))
      .andThen((models) => {
        const testToken = randomToken();
        providerTests.set(provider.providerId, {
          providerId: provider.providerId,
          fingerprint: fingerprintProviderDraft(provider),
          testToken,
          models,
        });

        return okAsync({
          providerId: provider.providerId,
          testToken,
          statusText: "Connection successful.",
          modelsByProvider: {
            [provider.providerId]: models,
          },
        } satisfies TestProviderConnectionResponse);
      });

  const saveProviderConfig = ({
    webContentsId,
    provider,
    testToken,
  }: {
    webContentsId: number;
    provider: ProviderDraftDto;
    testToken: string;
  }) =>
    hydrate()
      .andThen(() => validateProviderDraft(provider))
      .andThen(() => {
        const latestTest = providerTests.get(provider.providerId);
        const expectedFingerprint = fingerprintProviderDraft(provider);
        const hasValidProof =
          latestTest?.providerId === provider.providerId &&
          latestTest?.testToken === testToken &&
          latestTest?.fingerprint === expectedFingerprint;

        if (!hasValidProof) {
          return errAsync(
            validationError(
              `Provider ${provider.providerId} save blocked due to missing successful test`,
              "Run a successful connection test before saving.",
            ),
          );
        }

        const normalizedApiKey = normalizeNullable(provider.apiKey);
        const credentialRef = normalizedApiKey === null ? null : `provider/${provider.providerId}`;
        return (
          credentialRef !== null && normalizedApiKey !== null
            ? saveSecret({
                account: credentialRef,
                secret: normalizedApiKey,
              }).mapErr((errorKind) => {
                if (errorKind === "KeychainUnavailableError") {
                  return providerError(
                    `Provider ${provider.providerId} save failed because OS keychain is unavailable`,
                    "OS keychain is unavailable. Unable to save provider credentials.",
                  );
                }

                return providerError(
                  `Provider ${provider.providerId} save failed due to keychain write error`,
                  "Could not save provider credentials. Try again.",
                );
              })
            : okAsync(undefined)
        ).map(() => ({
          credentialRef,
          models: latestTest?.models ?? PROVIDER_MODELS[provider.providerId],
        }));
      })
      .andThen(({ credentialRef, models }) => {
        const now = nowUtc();
        const persisted: PersistedProviderConfig = {
          providerId: provider.providerId,
          endpointUrl: normalizeNullable(provider.endpointUrl),
          credentialRef,
          lastSavedAtUtc: now,
        };
        return persistProviderConfig({
          providerId: persisted.providerId,
          endpointUrl: persisted.endpointUrl,
          credentialRef: persisted.credentialRef,
          lastSavedAtUtc: persisted.lastSavedAtUtc,
          models,
        }).map(() => {
          persistedProviderConfigs.set(provider.providerId, persisted);
          providerModels.set(provider.providerId, models);

          clearSnapshotsForWebContents(webContentsId);
          const modelCatalog = refreshSnapshot(webContentsId, "settings");
          return {
            provider: toProviderConfigDto(provider.providerId, persisted),
            modelCatalog,
          } satisfies SaveProviderConfigResponse;
        });
      });

  const refreshModelCatalog = ({
    webContentsId,
    viewKind,
  }: {
    webContentsId: number;
    viewKind: ViewKind;
  }) =>
    hydrate().andThen(() => {
      if (persistedProviderConfigs.size === 0) {
        return errAsync(
          validationError(
            `Refresh blocked for ${viewKind} because no providers are configured`,
            "Configure and save at least one provider before refreshing models.",
          ),
        );
      }

      return refreshConfiguredProviderModels().andThen(() => {
        clearSnapshotsForWebContents(webContentsId);
        const modelCatalog = refreshSnapshot(webContentsId, viewKind);
        return okAsync({ modelCatalog } satisfies RefreshModelCatalogResponse);
      });
    });

  const setGlobalDefaultModel = ({
    webContentsId,
    viewKind,
    modelRefOrNull,
  }: {
    webContentsId: number;
    viewKind: ViewKind;
    modelRefOrNull: ModelRef | null;
  }) =>
    hydrate().andThen(() => {
      const snapshot = getOrCreateSnapshot(webContentsId, viewKind);
      if (modelRefOrNull !== null) {
        const availableModelKeys = buildAvailableModelKeys(snapshot.modelsByProvider);
        if (!availableModelKeys.has(modelKey(modelRefOrNull))) {
          return errAsync(
            invalidConfigError(
              `Selected global default model ${modelKey(modelRefOrNull)} is unavailable in snapshot ${snapshot.snapshotId}`,
              "Selected model is unavailable in this view. Refresh models and try again.",
            ),
          );
        }
      }

      return persistGlobalDefaultModel({
        modelRefOrNull,
        updatedAtUtc: nowUtc(),
      }).map(() => {
        settingsState.globalDefaultModelRef = modelRefOrNull;
        return {
          globalDefaultModelRef: settingsState.globalDefaultModelRef,
          globalDefaultModelInvalidConfig: isGlobalDefaultInvalidConfig(snapshot),
        } satisfies SetGlobalDefaultModelResponse;
      });
    });

  const setContextLastN = ({
    contextLastN,
  }: {
    webContentsId: number;
    viewKind: ViewKind;
    contextLastN: number;
  }) =>
    hydrate().andThen(() => {
      const isInteger = Number.isInteger(contextLastN);
      if (!isInteger || contextLastN < MIN_CONTEXT_LAST_N || contextLastN > MAX_CONTEXT_LAST_N) {
        return errAsync(
          validationError(
            `Context last N ${contextLastN} is out of range`,
            `Context window must be between ${MIN_CONTEXT_LAST_N} and ${MAX_CONTEXT_LAST_N}.`,
          ),
        );
      }

      const normalized = normalizeContextLastN(contextLastN, DEFAULT_CONTEXT_LAST_N);

      return persistContextLastN({
        contextLastN: normalized,
        updatedAtUtc: nowUtc(),
      }).map(() => {
        settingsState.contextLastN = normalized;
        return { contextLastN: settingsState.contextLastN } satisfies SetContextLastNResponse;
      });
    });

  const getSettingsView = ({
    webContentsId,
    viewKind,
  }: {
    webContentsId: number;
    viewKind: ViewKind;
  }) =>
    hydrate().map(() => {
      const snapshot = getOrCreateSnapshot(webContentsId, viewKind);
      const providers: ReadonlyArray<ProviderConfigDto> = PROVIDER_ORDER.map((providerId) =>
        toProviderConfigDto(providerId, persistedProviderConfigs.get(providerId)),
      );

      return {
        providers,
        globalDefaultModelRef: settingsState.globalDefaultModelRef,
        globalDefaultModelInvalidConfig: isGlobalDefaultInvalidConfig(snapshot),
        contextLastN: settingsState.contextLastN,
        modelCatalog:
          persistedProviderConfigs.size === 0
            ? emptyModelCatalogSnapshot(snapshot.snapshotId)
            : snapshot,
        canRefreshModels: persistedProviderConfigs.size > 0,
      } satisfies GetSettingsViewResponse;
    });

  return {
    getSettingsView,
    testProviderConnection,
    saveProviderConfig,
    refreshModelCatalog,
    setGlobalDefaultModel,
    setContextLastN,
    getContextLastN: () => settingsState.contextLastN,
    releaseViewSnapshots: (webContentsId: number): void => {
      clearSnapshotsForWebContents(webContentsId);
    },
  };
};

export type { SettingsSlice };
