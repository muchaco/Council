import { describe, expect, it, vi } from 'vitest';
import { Effect } from 'effect';

import { Clock } from '../../runtime';
import {
  executeRefreshSettingsModelCatalog,
  type ExecuteRefreshSettingsModelCatalogInput,
} from './execute-refresh-settings-model-catalog';
import {
  SettingsModelCatalogGateway,
  type SettingsModelCatalogGatewayService,
} from './settings-model-catalog-dependencies';

const runUseCase = (
  input: ExecuteRefreshSettingsModelCatalogInput,
  gateway: SettingsModelCatalogGatewayService,
  now: Date
) =>
  Effect.runPromise(
    executeRefreshSettingsModelCatalog(input).pipe(
      Effect.provideService(SettingsModelCatalogGateway, gateway),
      Effect.provideService(Clock, { now: Effect.succeed(now) })
    )
  );

describe('execute_refresh_settings_model_catalog_use_case_spec', () => {
  it('does_not_call_gateway_when_api_key_is_missing', async () => {
    const listAvailableModels = vi.fn(() => Effect.succeed([]));

    const result = await runUseCase(
      {
        hasGeminiApiKey: false,
        cachedModelCount: 2,
        modelsLastFetchedEpochMs: 1_000,
      },
      {
        listAvailableModels,
      },
      new Date('2026-02-11T10:00:00.000Z')
    );

    expect(result).toEqual({
      _tag: 'SettingsModelCatalogUnchanged',
      reason: 'MissingApiKey',
    });
    expect(listAvailableModels).not.toHaveBeenCalled();
  });

  it('returns_refreshed_catalog_when_cache_is_expired', async () => {
    const models = [
      {
        name: 'gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        description: 'Fast model',
        supportedMethods: ['generateContent'],
      },
    ];
    const listAvailableModels = vi.fn(() => Effect.succeed(models));

    const result = await runUseCase(
      {
        hasGeminiApiKey: true,
        cachedModelCount: 1,
        modelsLastFetchedEpochMs: 0,
      },
      {
        listAvailableModels,
      },
      new Date('2026-02-11T10:00:00.000Z')
    );

    expect(result).toEqual({
      _tag: 'SettingsModelCatalogRefreshed',
      models,
      refreshedAtEpochMs: new Date('2026-02-11T10:00:00.000Z').getTime(),
    });
    expect(listAvailableModels).toHaveBeenCalledTimes(1);
  });

  it('does_not_call_gateway_when_cache_is_still_valid', async () => {
    const listAvailableModels = vi.fn(() =>
      Effect.succeed([
        {
          name: 'gemini-2.0-flash',
          displayName: 'Gemini 2.0 Flash',
          description: 'Fast model',
          supportedMethods: ['generateContent'],
        },
      ])
    );

    const result = await runUseCase(
      {
        hasGeminiApiKey: true,
        cachedModelCount: 3,
        modelsLastFetchedEpochMs: new Date('2026-02-11T09:58:00.000Z').getTime(),
      },
      {
        listAvailableModels,
      },
      new Date('2026-02-11T10:00:00.000Z')
    );

    expect(result).toEqual({
      _tag: 'SettingsModelCatalogUnchanged',
      reason: 'CacheStillValid',
    });
    expect(listAvailableModels).not.toHaveBeenCalled();
  });

  it('surfaces_typed_gateway_failure_when_model_fetch_fails', async () => {
    const result = await Effect.runPromise(
      executeRefreshSettingsModelCatalog({
        hasGeminiApiKey: true,
        cachedModelCount: 0,
        modelsLastFetchedEpochMs: null,
      }).pipe(
        Effect.provideService(SettingsModelCatalogGateway, {
          listAvailableModels: () =>
            Effect.fail({
              _tag: 'SettingsModelCatalogInfrastructureError',
              source: 'settingsGateway',
              message: 'Gateway unavailable',
            } as const),
        }),
        Effect.provideService(Clock, { now: Effect.succeed(new Date('2026-02-11T10:00:00.000Z')) }),
        Effect.either
      )
    );

    expect(result._tag).toBe('Left');
    if (result._tag === 'Left') {
      expect(result.left).toEqual({
        _tag: 'SettingsModelCatalogInfrastructureError',
        source: 'settingsGateway',
        message: 'Gateway unavailable',
      });
    }
  });
});
