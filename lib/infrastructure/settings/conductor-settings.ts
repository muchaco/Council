import { Effect } from 'effect';
import Store from 'electron-store';

import type {
  ConductorInfrastructureError,
  ConductorSelectorGenerationPolicy,
  ConductorSettingsService,
} from '../../application/use-cases/conductor/conductor-dependencies';

interface ConductorStoreSchema {
  apiKey?: string;
  defaultModel?: string;
}

interface ConductorSettingsOptions {
  readonly selectorTemperature?: number;
  readonly selectorMaxOutputTokens?: number;
}

type Decrypt = (encryptedValue: string) => string;

const settingsError = (
  code: ConductorInfrastructureError extends infer E
    ? E extends { source: 'settings'; code: infer C }
      ? C
      : never
    : never,
  message: string
): ConductorInfrastructureError => ({
  _tag: 'ConductorInfrastructureError',
  source: 'settings',
  code,
  message,
});

const readEncryptedApiKey = (store: Store<ConductorStoreSchema>): string | undefined => {
  const rawValue = (store as unknown as { get: (key: string) => unknown }).get('apiKey');
  return typeof rawValue === 'string' ? rawValue : undefined;
};

const resolveApiKey = (store: Store<ConductorStoreSchema>, decrypt: Decrypt): string => {
  const encrypted = readEncryptedApiKey(store);
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

const resolveSelectorGenerationPolicy = (
  options: ConductorSettingsOptions | undefined
): ConductorSelectorGenerationPolicy => ({
  temperature: options?.selectorTemperature ?? 0.3,
  maxOutputTokens: options?.selectorMaxOutputTokens ?? 4096,
});

export const makeConductorSettingsService = (
  decrypt: Decrypt,
  store: Store<ConductorStoreSchema>,
  options?: ConductorSettingsOptions
): ConductorSettingsService => ({
  getGeminiApiKey: Effect.try({
    try: () => resolveApiKey(store, decrypt),
    catch: (error) => {
      if (error && typeof error === 'object' && '_tag' in error) {
        return error as ConductorInfrastructureError;
      }

      return settingsError(
        'SettingsReadFailed',
        error instanceof Error ? error.message : 'Failed to load Gemini API key'
      );
    },
  }),
  getSelectorModel: Effect.try({
    try: () => {
      const rawDefaultModel = (store as unknown as { get: (key: string) => unknown }).get('defaultModel');
      if (typeof rawDefaultModel !== 'string' || rawDefaultModel.trim().length === 0) {
        return 'gemini-2.5-flash';
      }

      return rawDefaultModel;
    },
    catch: (error) =>
      settingsError(
        'SettingsReadFailed',
        error instanceof Error ? error.message : 'Failed to load selector model'
      ),
  }),
  getSelectorGenerationPolicy: Effect.sync(() => resolveSelectorGenerationPolicy(options)),
});
