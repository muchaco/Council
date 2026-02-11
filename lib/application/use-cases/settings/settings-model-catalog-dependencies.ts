import { Context, Effect } from 'effect';

import type { ModelInfo } from '../../../types';

export interface SettingsModelCatalogInfrastructureError {
  readonly _tag: 'SettingsModelCatalogInfrastructureError';
  readonly source: 'settingsGateway';
  readonly message: string;
}

export interface SettingsModelCatalogGatewayService {
  readonly listAvailableModels: () => Effect.Effect<readonly ModelInfo[], SettingsModelCatalogInfrastructureError>;
}

export class SettingsModelCatalogGateway extends Context.Tag('SettingsModelCatalogGateway')<
  SettingsModelCatalogGateway,
  SettingsModelCatalogGatewayService
>() {}
