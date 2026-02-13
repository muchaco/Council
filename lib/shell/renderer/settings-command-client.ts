import { Effect } from 'effect';
import { getRendererBridge } from './renderer-bridge';
import type { LlmProviderConfig } from '../../core/domain/llm-provider';
import type { SettingsError } from '../../core/errors/domain-error';

export const setGeminiApiKeyCommand = async (apiKey: string): Promise<{ success: boolean; error?: string }> =>
  getRendererBridge().electronSettings.setApiKey(apiKey);

export const testGeminiConnectionCommand = async (): Promise<{
  success: boolean;
  data?: boolean;
  error?: string;
}> => getRendererBridge().electronSettings.testConnection();

export const setDefaultGeminiModelCommand = async (
  defaultModel: string
): Promise<{ success: boolean; error?: string }> =>
  getRendererBridge().electronSettings.setDefaultModel(defaultModel);

// Provider abstraction commands
export const configureProvider = (config: LlmProviderConfig) =>
  Effect.tryPromise({
    try: () => getRendererBridge().electronSettings.setProviderConfig(config),
    catch: (e): SettingsError => ({ _tag: 'SettingsError', message: String(e) }),
  });

export const setDefaultProvider = (providerId: string) =>
  Effect.tryPromise({
    try: () => getRendererBridge().electronSettings.setDefaultProvider(providerId),
    catch: (e): SettingsError => ({ _tag: 'SettingsError', message: String(e) }),
  });
