import { Effect } from 'effect';

import { decideRefreshSettingsModelCatalog } from '../../../core/decision/decide-refresh-settings-model-catalog';
import type { SettingsModelCatalogRefreshPolicy } from '../../../core/domain/settings-model-catalog';
import { defaultSettingsModelCatalogRefreshPolicy } from '../../../core/domain/settings-model-catalog';
import type { ModelInfo } from '../../../types';
import { Clock } from '../../runtime';
import {
  SettingsModelCatalogGateway,
  type SettingsModelCatalogInfrastructureError,
} from './settings-model-catalog-dependencies';

export interface ExecuteRefreshSettingsModelCatalogInput {
  readonly hasGeminiApiKey: boolean;
  readonly cachedModelCount: number;
  readonly modelsLastFetchedEpochMs: number | null;
  readonly refreshPolicy?: SettingsModelCatalogRefreshPolicy;
}

export type RefreshSettingsModelCatalogResult =
  | {
      readonly _tag: 'SettingsModelCatalogUnchanged';
      readonly reason: 'MissingApiKey' | 'CacheStillValid';
    }
  | {
      readonly _tag: 'SettingsModelCatalogRefreshed';
      readonly models: readonly ModelInfo[];
      readonly refreshedAtEpochMs: number;
    };

export const executeRefreshSettingsModelCatalog = (
  input: ExecuteRefreshSettingsModelCatalogInput
): Effect.Effect<
  RefreshSettingsModelCatalogResult,
  SettingsModelCatalogInfrastructureError,
  SettingsModelCatalogGateway | Clock
> =>
  Effect.gen(function* () {
    const clock = yield* Clock;
    const gateway = yield* SettingsModelCatalogGateway;
    const now = yield* clock.now;

    const decision = decideRefreshSettingsModelCatalog(
      {
        hasGeminiApiKey: input.hasGeminiApiKey,
        currentEpochMs: now.getTime(),
        cache: {
          modelsCount: input.cachedModelCount,
          lastFetchedEpochMs: input.modelsLastFetchedEpochMs,
        },
      },
      input.refreshPolicy ?? defaultSettingsModelCatalogRefreshPolicy
    );

    if (decision._tag === 'SkipSettingsModelCatalogRefresh') {
      return {
        _tag: 'SettingsModelCatalogUnchanged',
        reason: decision.reason,
      } as const;
    }

    const models = yield* gateway.listAvailableModels();
    const refreshedAt = yield* clock.now;

    return {
      _tag: 'SettingsModelCatalogRefreshed',
      models,
      refreshedAtEpochMs: refreshedAt.getTime(),
    } as const;
  });
