import { ResultAsync, errAsync, okAsync } from "neverthrow";
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
};

type SettingsSliceDependencies = {
  nowUtc: () => string;
  randomToken: () => string;
  fetchOllamaModels: (params: {
    endpointUrl: string;
    apiKey: string | null;
  }) => ResultAsync<ReadonlyArray<string>, DomainError>;
  saveSecret: (params: {
    account: string;
    secret: string;
  }) => ResultAsync<void, "KeychainUnavailableError" | "KeychainWriteError">;
  loadPersistedState: () => ResultAsync<
    {
      globalDefaultModelRef: ModelRef | null;
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
  const loadPersistedState =
    dependencies.loadPersistedState ??
    (() =>
      okAsync({
        globalDefaultModelRef: null,
        providerConfigs: [],
      }));
  const persistProviderConfig = dependencies.persistProviderConfig ?? (() => okAsync(undefined));
  const persistGlobalDefaultModel =
    dependencies.persistGlobalDefaultModel ?? (() => okAsync(undefined));
  const providerTests = new Map<ProviderId, ProviderTestState>();
  const providerModels = new Map<ProviderId, ReadonlyArray<string>>();
  const settingsState: SettingsState = {
    globalDefaultModelRef: null,
  };
  const snapshots = new Map<string, ModelCatalogSnapshotDto>();
  let hydrated = false;

  const hydrate = (): ResultAsync<void, DomainError> => {
    if (hydrated) {
      return okAsync(undefined);
    }

    return loadPersistedState().map((persisted) => {
      settingsState.globalDefaultModelRef = persisted.globalDefaultModelRef;
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
    if (provider.providerId === "ollama") {
      return fetchOllamaModels({
        endpointUrl: normalizeOllamaEndpoint(provider.endpointUrl),
        apiKey: normalizeNullable(provider.apiKey),
      });
    }

    return okAsync(PROVIDER_MODELS[provider.providerId]);
  };

  const refreshConfiguredProviderModels = (): ResultAsync<void, DomainError> => {
    let chain: ResultAsync<void, DomainError> = okAsync(undefined);

    for (const persisted of persistedProviderConfigs.values()) {
      chain = chain.andThen(() => {
        if (persisted.providerId !== "ollama") {
          providerModels.set(persisted.providerId, PROVIDER_MODELS[persisted.providerId]);
          return okAsync(undefined);
        }

        return fetchOllamaModels({
          endpointUrl: normalizeOllamaEndpoint(persisted.endpointUrl),
          apiKey: null,
        }).map((models) => {
          providerModels.set(persisted.providerId, models);
        });
      });
    }

    return chain;
  };

  const snapshotKey = (webContentsId: number, viewKind: ViewKind): string =>
    `${webContentsId}:${viewKind}`;

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
      .andThen(() => {
        const normalizedApiKey = normalizeNullable(provider.apiKey);
        if (normalizedApiKey?.toLowerCase().includes("invalid") === true) {
          return errAsync(
            providerError(
              `Provider ${provider.providerId} connection test failed`,
              "Provider connection test failed. Check credentials and endpoint.",
            ),
          );
        }

        return okAsync(undefined);
      })
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
    releaseViewSnapshots: (webContentsId: number): void => {
      const prefix = `${webContentsId}:`;
      for (const key of snapshots.keys()) {
        if (key.startsWith(prefix)) {
          snapshots.delete(key);
        }
      }
    },
  };
};

export type { SettingsSlice };
