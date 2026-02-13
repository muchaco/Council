import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Effect } from 'effect';
import { configureProvider, setDefaultProvider } from './settings-command-client';
import type { LlmProviderConfig } from '../../core/domain/llm-provider';

describe('settings_command_client_spec', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('configureProvider', () => {
    it('configures_provider_successfully', async () => {
      const mockSetProviderConfig = vi.fn().mockResolvedValue({ success: true });
      Object.assign(window, {
        electronSettings: {
          setProviderConfig: mockSetProviderConfig,
        },
      });

      const config: LlmProviderConfig = {
        providerId: 'gemini',
        apiKey: 'test-api-key',
        defaultModel: 'gemini-2.0-flash',
        isEnabled: true,
      };

      const result = await Effect.runPromise(configureProvider(config));

      expect(mockSetProviderConfig).toHaveBeenCalledWith(config);
      expect(result).toEqual({ success: true });
    });

    it('returns_settings_error_when_provider_config_fails', async () => {
      const mockSetProviderConfig = vi.fn().mockRejectedValue(new Error('Network error'));
      Object.assign(window, {
        electronSettings: {
          setProviderConfig: mockSetProviderConfig,
        },
      });

      const config: LlmProviderConfig = {
        providerId: 'gemini',
        apiKey: 'test-api-key',
        defaultModel: 'gemini-2.0-flash',
        isEnabled: true,
      };

      const result = await Effect.runPromise(Effect.either(configureProvider(config)));

      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('SettingsError');
        expect(result.left.message).toContain('Network error');
      }
    });
  });

  describe('setDefaultProvider', () => {
    it('sets_default_provider_successfully', async () => {
      const mockSetDefaultProvider = vi.fn().mockResolvedValue({ success: true });
      Object.assign(window, {
        electronSettings: {
          setDefaultProvider: mockSetDefaultProvider,
        },
      });

      const result = await Effect.runPromise(setDefaultProvider('openai'));

      expect(mockSetDefaultProvider).toHaveBeenCalledWith('openai');
      expect(result).toEqual({ success: true });
    });

    it('returns_settings_error_when_set_default_provider_fails', async () => {
      const mockSetDefaultProvider = vi.fn().mockRejectedValue(new Error('Storage error'));
      Object.assign(window, {
        electronSettings: {
          setDefaultProvider: mockSetDefaultProvider,
        },
      });

      const result = await Effect.runPromise(Effect.either(setDefaultProvider('openai')));

      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('SettingsError');
        expect(result.left.message).toContain('Storage error');
      }
    });
  });
});
