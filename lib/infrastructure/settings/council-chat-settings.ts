import { Effect } from 'effect';
import Store from 'electron-store';

import type {
  CouncilChatGenerationPolicy,
  CouncilChatInfrastructureError,
  CouncilChatSettingsService,
} from '../../application/use-cases/council-chat/council-chat-dependencies';
import { LlmSettings, type ProviderId } from './llm-settings';

interface CouncilStoreSchema {
  apiKey: string;
}

interface CouncilChatSettingsOptions {
  readonly defaultHistoryLimit?: number;
  readonly maxOutputTokens?: number;
}

type Decrypt = (encryptedValue: string) => string;

const settingsError = (
  code: CouncilChatInfrastructureError extends infer E
    ? E extends { source: 'settings'; code: infer C }
      ? C
      : never
    : never,
  message: string
): CouncilChatInfrastructureError => ({
  _tag: 'CouncilChatInfrastructureError',
  source: 'settings',
  code,
  message,
});

const resolveApiKey = (store: Store<CouncilStoreSchema>, decrypt: Decrypt): string => {
  const encrypted = (store as any).get('apiKey') as string | undefined;
  if (!encrypted) {
    throw settingsError('ApiKeyMissing', 'API key not configured');
  }

  try {
    return decrypt(encrypted);
  } catch (error) {
    throw settingsError(
      'ApiKeyDecryptFailed',
      error instanceof Error ? error.message : 'Failed to decrypt API key'
    );
  }
};

const resolveGenerationPolicy = (
  options: CouncilChatSettingsOptions | undefined
): CouncilChatGenerationPolicy => {
  const defaultHistoryLimit = options?.defaultHistoryLimit ?? 15;
  const maxOutputTokens = options?.maxOutputTokens ?? 2048;

  return {
    defaultHistoryLimit,
    maxOutputTokens,
  };
};

export const makeCouncilChatSettingsService = (
  decrypt: Decrypt,
  store: Store<CouncilStoreSchema>,
  options?: CouncilChatSettingsOptions
): CouncilChatSettingsService => ({
  getGeminiApiKey: Effect.try({
    try: () => resolveApiKey(store, decrypt),
    catch: (error) => {
      if (error && typeof error === 'object' && '_tag' in error) {
        return error as CouncilChatInfrastructureError;
      }

      return settingsError(
        'SettingsReadFailed',
        error instanceof Error ? error.message : 'Failed to load Gemini API key'
      );
    },
  }),
  getGenerationPolicy: Effect.sync(() => resolveGenerationPolicy(options)),
});

// Provider-agnostic API functions using LlmSettings service
export const getApiKey = (providerId: ProviderId) =>
  LlmSettings.pipe(Effect.flatMap((settings) => settings.getApiKey(providerId)));

export const getDefaultModel = (providerId: ProviderId) =>
  LlmSettings.pipe(Effect.flatMap((settings) => settings.getDefaultModel(providerId)));
