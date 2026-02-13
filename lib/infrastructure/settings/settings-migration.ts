import type ElectronStore from 'electron-store';
import type { LlmProviderConfig, ProviderId } from './llm-settings';

interface LegacySettings {
  geminiApiKey?: string;
  defaultModel?: string;
}

interface ModernSettings {
  providers: Record<string, LlmProviderConfig>;
  defaultProvider: string;
}

type TypedStore = {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

export const migrateSettings = (store: TypedStore): ModernSettings => {
  const existing = store.get('providers') as Record<string, LlmProviderConfig> | undefined;

  if (existing) {
    return {
      providers: existing,
      defaultProvider: (store.get('defaultProvider') as string) ?? 'gemini',
    };
  }

  // Migrate from legacy format
  const legacyKey = store.get('geminiApiKey') as string | undefined;
  const legacyModel = store.get('defaultModel') as string | undefined;

  const migrated: ModernSettings = {
    providers: {
      gemini: {
        providerId: 'gemini',
        apiKey: legacyKey ?? '',
        defaultModel: legacyModel ?? 'gemini-2.5-flash',
        isEnabled: !!legacyKey,
      },
    },
    defaultProvider: 'gemini',
  };

  // Save migrated format
  store.set('providers', migrated.providers);
  store.set('defaultProvider', migrated.defaultProvider);

  return migrated;
};

export const getProviderConfig = (
  store: TypedStore,
  providerId: ProviderId
): LlmProviderConfig | undefined => {
  const providers = store.get('providers') as Record<string, LlmProviderConfig> | undefined;
  return providers?.[providerId];
};

export const setProviderConfig = (
  store: TypedStore,
  config: LlmProviderConfig
): void => {
  const existing = store.get('providers') as Record<string, LlmProviderConfig> | undefined;
  const providers = existing ?? {};
  providers[config.providerId] = config;
  store.set('providers', providers);
};

export const getDefaultProvider = (store: TypedStore): ProviderId => {
  const defaultProvider = store.get('defaultProvider') as string | undefined;
  return defaultProvider ?? 'gemini';
};

export const setDefaultProvider = (
  store: TypedStore,
  providerId: ProviderId
): void => {
  store.set('defaultProvider', providerId);
};
