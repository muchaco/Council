import { Effect, Context } from 'effect';

export type ProviderId = string;
export type ModelId = string;

export interface LlmProviderConfig {
  readonly providerId: ProviderId;
  readonly apiKey: string;
  readonly defaultModel: ModelId;
  readonly isEnabled: boolean;
}

export interface LlmSettingsService {
  readonly getApiKey: (providerId: ProviderId) => Effect.Effect<string, never>;
  readonly getDefaultProvider: () => Effect.Effect<ProviderId, never>;
  readonly getDefaultModel: (providerId: ProviderId) => Effect.Effect<ModelId, never>;
  readonly getProviderConfig: (providerId: ProviderId) => Effect.Effect<LlmProviderConfig, never>;
  readonly listConfiguredProviders: () => Effect.Effect<ReadonlyArray<ProviderId>, never>;
  readonly setProviderConfig: (config: LlmProviderConfig) => Effect.Effect<void, never>;
  readonly setDefaultProvider: (providerId: ProviderId) => Effect.Effect<void, never>;
}

export class LlmSettings extends Context.Tag('LlmSettings')<
  LlmSettings,
  LlmSettingsService
>() {}
