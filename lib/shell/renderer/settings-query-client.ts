import { Effect } from 'effect';
import { getRendererBridge } from './renderer-bridge';
import type { LlmProviderConfig } from '../../core/domain/llm-provider';
import type { SettingsError } from '../../core/errors/domain-error';

export const loadApiKeyStatusQuery = async (): Promise<{
  success: boolean;
  data?: { configured: boolean };
  error?: string;
}> => getRendererBridge().electronSettings.getApiKeyStatus();

export const loadDefaultModelQuery = async (): Promise<{ success: boolean; data?: unknown; error?: string }> =>
  getRendererBridge().electronSettings.getDefaultModel();

export const loadAvailableModelsQuery = async (): Promise<{
  success: boolean;
  data?: {
    configured: boolean;
    models: Array<{
      name: string;
      displayName: string;
      description: string;
      supportedMethods: string[];
    }>;
    fetchedAtEpochMs: number | null;
  };
  error?: string;
}> => getRendererBridge().electronSettings.getModelCatalog();

// Provider abstraction queries
export const loadProviderConfig = (providerId: string) =>
  Effect.tryPromise({
    try: async (): Promise<LlmProviderConfig> => {
      const result = await getRendererBridge().electronSettings.getProviderConfig(providerId);
      if (!result.success || !result.data) {
        throw new Error(result.error || `Failed to load provider config for ${providerId}`);
      }
      return result.data;
    },
    catch: (e): SettingsError => ({ _tag: 'SettingsError', message: String(e) }),
  });

export const loadDefaultProvider = () =>
  Effect.tryPromise({
    try: async (): Promise<string> => {
      const result = await getRendererBridge().electronSettings.getDefaultProvider();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to load default provider');
      }
      return result.data;
    },
    catch: (e): SettingsError => ({ _tag: 'SettingsError', message: String(e) }),
  });

// Updated to accept providerId parameter
export const loadAvailableModels = (providerId?: string) =>
  Effect.tryPromise({
    try: () => getRendererBridge().electronSettings.listAvailableModels(providerId ?? 'gemini'),
    catch: (e): SettingsError => ({ _tag: 'SettingsError', message: String(e) }),
  });
