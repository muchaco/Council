import type {
  DecideSettingsModelCatalogRefreshInput,
  SettingsModelCatalogRefreshPolicy,
} from '../domain/settings-model-catalog';
import { defaultSettingsModelCatalogRefreshPolicy } from '../domain/settings-model-catalog';
import type { SettingsModelCatalogRefreshPlan } from '../plan/settings-model-catalog-plan';

const hasValidCachedCatalog = (
  input: DecideSettingsModelCatalogRefreshInput,
  policy: SettingsModelCatalogRefreshPolicy
): boolean => {
  if (input.cache.modelsCount <= 0 || input.cache.lastFetchedEpochMs === null) {
    return false;
  }

  return input.currentEpochMs - input.cache.lastFetchedEpochMs < policy.cacheDurationMs;
};

export const decideRefreshSettingsModelCatalog = (
  input: DecideSettingsModelCatalogRefreshInput,
  policy: SettingsModelCatalogRefreshPolicy = defaultSettingsModelCatalogRefreshPolicy
): SettingsModelCatalogRefreshPlan => {
  if (!input.hasGeminiApiKey) {
    return {
      _tag: 'SkipSettingsModelCatalogRefresh',
      reason: 'MissingApiKey',
    };
  }

  if (hasValidCachedCatalog(input, policy)) {
    return {
      _tag: 'SkipSettingsModelCatalogRefresh',
      reason: 'CacheStillValid',
    };
  }

  return {
    _tag: 'FetchSettingsModelCatalog',
  };
};
