export type SettingsModelCatalogRefreshSkipReason = 'MissingApiKey' | 'CacheStillValid';

export interface SkipSettingsModelCatalogRefreshPlan {
  readonly _tag: 'SkipSettingsModelCatalogRefresh';
  readonly reason: SettingsModelCatalogRefreshSkipReason;
}

export interface FetchSettingsModelCatalogPlan {
  readonly _tag: 'FetchSettingsModelCatalog';
}

export type SettingsModelCatalogRefreshPlan =
  | SkipSettingsModelCatalogRefreshPlan
  | FetchSettingsModelCatalogPlan;
