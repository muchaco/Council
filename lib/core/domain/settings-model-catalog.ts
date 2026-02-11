export interface SettingsModelCatalogCacheSnapshot {
  readonly modelsCount: number;
  readonly lastFetchedEpochMs: number | null;
}

export interface SettingsModelCatalogRefreshPolicy {
  readonly cacheDurationMs: number;
}

export interface DecideSettingsModelCatalogRefreshInput {
  readonly hasGeminiApiKey: boolean;
  readonly currentEpochMs: number;
  readonly cache: SettingsModelCatalogCacheSnapshot;
}

export const defaultSettingsModelCatalogRefreshPolicy: SettingsModelCatalogRefreshPolicy = {
  cacheDurationMs: 5 * 60 * 1000,
};
