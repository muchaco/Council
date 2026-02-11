import { Effect } from 'effect';

import type { ModelInfo } from '../../types';
import type {
  SettingsModelCatalogGatewayService,
  SettingsModelCatalogInfrastructureError,
} from '../../application/use-cases/settings';

interface SettingsModelCatalogElectronSettings {
  readonly listModels: () => Promise<{
    success: boolean;
    data?: unknown;
    error?: string;
  }>;
}

const infrastructureError = (message: string): SettingsModelCatalogInfrastructureError => ({
  _tag: 'SettingsModelCatalogInfrastructureError',
  source: 'settingsGateway',
  message,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isModelInfo = (value: unknown): value is ModelInfo => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.name === 'string' &&
    typeof value.displayName === 'string' &&
    typeof value.description === 'string' &&
    Array.isArray(value.supportedMethods) &&
    value.supportedMethods.every((method) => typeof method === 'string')
  );
};

const parseModelCatalog = (value: unknown): readonly ModelInfo[] => {
  if (!Array.isArray(value)) {
    throw infrastructureError('Invalid model catalog payload');
  }

  if (!value.every(isModelInfo)) {
    throw infrastructureError('Invalid model catalog entry payload');
  }

  return value;
};

export const makeSettingsModelCatalogGatewayFromElectronSettings = (
  electronSettings: SettingsModelCatalogElectronSettings
): SettingsModelCatalogGatewayService => ({
  listAvailableModels: () =>
    Effect.tryPromise({
      try: () => electronSettings.listModels(),
      catch: () => infrastructureError('Failed to fetch available models'),
    }).pipe(
      Effect.flatMap((result) => {
        if (!result.success) {
          return Effect.fail(infrastructureError(result.error ?? 'Failed to fetch available models'));
        }

        return Effect.try({
          try: () => parseModelCatalog(result.data ?? []),
          catch: (error) =>
            error && typeof error === 'object' && '_tag' in error
              ? (error as SettingsModelCatalogInfrastructureError)
              : infrastructureError('Invalid model catalog payload'),
        });
      })
    ),
});
