import { describe, expect, it } from 'vitest';
import {
  migrateSettings,
  getProviderConfig,
  setProviderConfig,
  getDefaultProvider,
  setDefaultProvider,
} from './settings-migration';
import type { LlmProviderConfig } from './llm-settings';

type MockStore = {
  data: Record<string, unknown>;
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

const createMockStore = (initialData: Record<string, unknown> = {}): MockStore => {
  const data = { ...initialData };
  return {
    data,
    get: (key: string) => data[key],
    set: (key: string, value: unknown) => {
      data[key] = value;
    },
  };
};

describe('settings_migration_spec', () => {
  describe('migrateSettings', () => {
    it('migrates_legacy_settings_to_provider_format', () => {
      const store = createMockStore({
        geminiApiKey: 'secret123',
        defaultModel: 'gemini-pro',
      });

      const migrated = migrateSettings(store);

      expect(migrated.providers.gemini.apiKey).toBe('secret123');
      expect(migrated.providers.gemini.defaultModel).toBe('gemini-pro');
      expect(migrated.providers.gemini.providerId).toBe('gemini');
      expect(migrated.providers.gemini.isEnabled).toBe(true);
      expect(migrated.defaultProvider).toBe('gemini');
    });

    it('returns_existing_modern_settings_without_modification', () => {
      const modernConfig: LlmProviderConfig = {
        providerId: 'gemini',
        apiKey: 'secret',
        defaultModel: 'pro',
        isEnabled: true,
      };
      const store = createMockStore({
        providers: { gemini: modernConfig },
        defaultProvider: 'gemini',
      });

      const migrated = migrateSettings(store);

      expect(migrated.providers.gemini.apiKey).toBe('secret');
      expect(migrated.providers.gemini.defaultModel).toBe('pro');
      expect(migrated.defaultProvider).toBe('gemini');
    });

    it('uses_default_values_when_legacy_settings_are_missing', () => {
      const store = createMockStore({});

      const migrated = migrateSettings(store);

      expect(migrated.providers.gemini.apiKey).toBe('');
      expect(migrated.providers.gemini.defaultModel).toBe('gemini-2.5-flash');
      expect(migrated.providers.gemini.isEnabled).toBe(false);
      expect(migrated.defaultProvider).toBe('gemini');
    });

    it('saves_migrated_settings_to_store', () => {
      const store = createMockStore({
        geminiApiKey: 'test-key',
        defaultModel: 'test-model',
      });

      migrateSettings(store);

      const savedProviders = store.get('providers') as Record<string, LlmProviderConfig>;
      expect(savedProviders).toBeDefined();
      expect(savedProviders.gemini.apiKey).toBe('test-key');
      expect(savedProviders.gemini.defaultModel).toBe('test-model');

      const savedDefaultProvider = store.get('defaultProvider') as string;
      expect(savedDefaultProvider).toBe('gemini');
    });
  });

  describe('getProviderConfig', () => {
    it('returns_provider_config_when_exists', () => {
      const config: LlmProviderConfig = {
        providerId: 'gemini',
        apiKey: 'test-key',
        defaultModel: 'gemini-pro',
        isEnabled: true,
      };
      const store = createMockStore({
        providers: { gemini: config },
      });

      const result = getProviderConfig(store, 'gemini');

      expect(result).toEqual(config);
    });

    it('returns_undefined_when_provider_not_found', () => {
      const store = createMockStore({});

      const result = getProviderConfig(store, 'unknown');

      expect(result).toBeUndefined();
    });
  });

  describe('setProviderConfig', () => {
    it('saves_new_provider_config', () => {
      const store = createMockStore({});
      const config: LlmProviderConfig = {
        providerId: 'openai',
        apiKey: 'sk-test',
        defaultModel: 'gpt-4',
        isEnabled: true,
      };

      setProviderConfig(store, config);

      const savedProviders = store.get('providers') as Record<string, LlmProviderConfig>;
      expect(savedProviders.openai).toEqual(config);
    });

    it('updates_existing_provider_config', () => {
      const existingConfig: LlmProviderConfig = {
        providerId: 'gemini',
        apiKey: 'old-key',
        defaultModel: 'old-model',
        isEnabled: true,
      };
      const store = createMockStore({
        providers: { gemini: existingConfig },
      });
      const newConfig: LlmProviderConfig = {
        providerId: 'gemini',
        apiKey: 'new-key',
        defaultModel: 'new-model',
        isEnabled: true,
      };

      setProviderConfig(store, newConfig);

      const savedProviders = store.get('providers') as Record<string, LlmProviderConfig>;
      expect(savedProviders.gemini.apiKey).toBe('new-key');
      expect(savedProviders.gemini.defaultModel).toBe('new-model');
    });

    it('preserves_other_providers_when_updating_one', () => {
      const geminiConfig: LlmProviderConfig = {
        providerId: 'gemini',
        apiKey: 'gemini-key',
        defaultModel: 'gemini-pro',
        isEnabled: true,
      };
      const store = createMockStore({
        providers: { gemini: geminiConfig },
      });
      const openaiConfig: LlmProviderConfig = {
        providerId: 'openai',
        apiKey: 'openai-key',
        defaultModel: 'gpt-4',
        isEnabled: true,
      };

      setProviderConfig(store, openaiConfig);

      const savedProviders = store.get('providers') as Record<string, LlmProviderConfig>;
      expect(savedProviders.gemini).toEqual(geminiConfig);
      expect(savedProviders.openai).toEqual(openaiConfig);
    });
  });

  describe('getDefaultProvider', () => {
    it('returns_stored_default_provider', () => {
      const store = createMockStore({
        defaultProvider: 'openai',
      });

      const result = getDefaultProvider(store);

      expect(result).toBe('openai');
    });

    it('returns_gemini_as_fallback_when_not_set', () => {
      const store = createMockStore({});

      const result = getDefaultProvider(store);

      expect(result).toBe('gemini');
    });
  });

  describe('setDefaultProvider', () => {
    it('saves_default_provider', () => {
      const store = createMockStore({});

      setDefaultProvider(store, 'anthropic');

      expect(store.get('defaultProvider')).toBe('anthropic');
    });
  });
});
