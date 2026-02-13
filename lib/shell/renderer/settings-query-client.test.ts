import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Effect } from 'effect';
import {
  loadProviderConfig,
  loadDefaultProvider,
  loadAvailableModels,
} from './settings-query-client';
import type { LlmProviderConfig } from '../../core/domain/llm-provider';

describe('settings_query_client_spec', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadProviderConfig', () => {
    it('loads_provider_config_successfully', async () => {
      const mockConfig: LlmProviderConfig = {
        providerId: 'gemini',
        apiKey: 'encrypted-key',
        defaultModel: 'gemini-2.0-flash',
        isEnabled: true,
      };
      const mockGetProviderConfig = vi.fn().mockResolvedValue({
        success: true,
        data: mockConfig,
      });
      Object.assign(window, {
        electronSettings: {
          getProviderConfig: mockGetProviderConfig,
        },
      });

      const result = await Effect.runPromise(loadProviderConfig('gemini'));

      expect(mockGetProviderConfig).toHaveBeenCalledWith('gemini');
      expect(result).toEqual(mockConfig);
    });

    it('returns_settings_error_when_provider_config_not_found', async () => {
      const mockGetProviderConfig = vi.fn().mockResolvedValue({
        success: false,
        error: 'Provider not found',
      });
      Object.assign(window, {
        electronSettings: {
          getProviderConfig: mockGetProviderConfig,
        },
      });

      const result = await Effect.runPromise(Effect.either(loadProviderConfig('openai')));

      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('SettingsError');
        expect(result.left.message).toContain('Provider not found');
      }
    });

    it('returns_settings_error_on_transport_failure', async () => {
      const mockGetProviderConfig = vi.fn().mockRejectedValue(new Error('IPC error'));
      Object.assign(window, {
        electronSettings: {
          getProviderConfig: mockGetProviderConfig,
        },
      });

      const result = await Effect.runPromise(Effect.either(loadProviderConfig('gemini')));

      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('SettingsError');
        expect(result.left.message).toContain('IPC error');
      }
    });
  });

  describe('loadDefaultProvider', () => {
    it('loads_default_provider_successfully', async () => {
      const mockGetDefaultProvider = vi.fn().mockResolvedValue({
        success: true,
        data: 'gemini',
      });
      Object.assign(window, {
        electronSettings: {
          getDefaultProvider: mockGetDefaultProvider,
        },
      });

      const result = await Effect.runPromise(loadDefaultProvider());

      expect(mockGetDefaultProvider).toHaveBeenCalledTimes(1);
      expect(result).toBe('gemini');
    });

    it('returns_settings_error_when_default_provider_not_found', async () => {
      const mockGetDefaultProvider = vi.fn().mockResolvedValue({
        success: false,
        error: 'No default provider set',
      });
      Object.assign(window, {
        electronSettings: {
          getDefaultProvider: mockGetDefaultProvider,
        },
      });

      const result = await Effect.runPromise(Effect.either(loadDefaultProvider()));

      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('SettingsError');
        expect(result.left.message).toContain('No default provider set');
      }
    });
  });

  describe('loadAvailableModels', () => {
    it('loads_models_for_specified_provider', async () => {
      const mockListAvailableModels = vi.fn().mockResolvedValue({
        success: true,
        data: {
          configured: true,
          models: [
            { name: 'model-1', displayName: 'Model 1', description: 'Test', supportedMethods: ['generateContent'] },
          ],
          fetchedAtEpochMs: Date.now(),
        },
      });
      Object.assign(window, {
        electronSettings: {
          listAvailableModels: mockListAvailableModels,
        },
      });

      const result = await Effect.runPromise(loadAvailableModels('openai'));

      expect(mockListAvailableModels).toHaveBeenCalledWith('openai');
      expect(result.success).toBe(true);
    });

    it('defaults_to_gemini_when_no_provider_specified', async () => {
      const mockListAvailableModels = vi.fn().mockResolvedValue({
        success: true,
        data: {
          configured: true,
          models: [],
          fetchedAtEpochMs: Date.now(),
        },
      });
      Object.assign(window, {
        electronSettings: {
          listAvailableModels: mockListAvailableModels,
        },
      });

      await Effect.runPromise(loadAvailableModels());

      expect(mockListAvailableModels).toHaveBeenCalledWith('gemini');
    });

    it('returns_settings_error_on_model_fetch_failure', async () => {
      const mockListAvailableModels = vi.fn().mockRejectedValue(new Error('API error'));
      Object.assign(window, {
        electronSettings: {
          listAvailableModels: mockListAvailableModels,
        },
      });

      const result = await Effect.runPromise(Effect.either(loadAvailableModels('gemini')));

      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('SettingsError');
        expect(result.left.message).toContain('API error');
      }
    });
  });
});
