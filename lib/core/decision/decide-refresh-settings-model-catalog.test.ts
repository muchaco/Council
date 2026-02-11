import { describe, expect, it } from 'vitest';

import { decideRefreshSettingsModelCatalog } from './decide-refresh-settings-model-catalog';

describe('decide_refresh_settings_model_catalog_spec', () => {
  it('skips_refresh_when_api_key_is_missing', () => {
    const decision = decideRefreshSettingsModelCatalog({
      hasGeminiApiKey: false,
      currentEpochMs: 1_000,
      cache: {
        modelsCount: 10,
        lastFetchedEpochMs: 800,
      },
    });

    expect(decision).toEqual({
      _tag: 'SkipSettingsModelCatalogRefresh',
      reason: 'MissingApiKey',
    });
  });

  it('skips_refresh_when_cached_catalog_is_still_valid', () => {
    const decision = decideRefreshSettingsModelCatalog({
      hasGeminiApiKey: true,
      currentEpochMs: 1_000,
      cache: {
        modelsCount: 2,
        lastFetchedEpochMs: 900,
      },
    });

    expect(decision).toEqual({
      _tag: 'SkipSettingsModelCatalogRefresh',
      reason: 'CacheStillValid',
    });
  });

  it('fetches_catalog_when_cache_is_expired', () => {
    const decision = decideRefreshSettingsModelCatalog({
      hasGeminiApiKey: true,
      currentEpochMs: 500_000,
      cache: {
        modelsCount: 2,
        lastFetchedEpochMs: 100,
      },
    });

    expect(decision).toEqual({
      _tag: 'FetchSettingsModelCatalog',
    });
  });

  it('fetches_catalog_when_cache_has_no_models', () => {
    const decision = decideRefreshSettingsModelCatalog({
      hasGeminiApiKey: true,
      currentEpochMs: 500_000,
      cache: {
        modelsCount: 0,
        lastFetchedEpochMs: 499_000,
      },
    });

    expect(decision).toEqual({
      _tag: 'FetchSettingsModelCatalog',
    });
  });
});
