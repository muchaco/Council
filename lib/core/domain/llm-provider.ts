import { Schema } from 'effect';

export type ProviderId = string;
export type ModelId = string;

export class LlmProviderConfig extends Schema.Class<LlmProviderConfig>('LlmProviderConfig')({
  providerId: Schema.String,
  apiKey: Schema.String,
  defaultModel: Schema.String,
  isEnabled: Schema.Boolean,
}) {}

export class ProviderModelInfo extends Schema.Class<ProviderModelInfo>('ProviderModelInfo')({
  id: Schema.String,
  displayName: Schema.String,
  providerId: Schema.String,
  maxTokens: Schema.optional(Schema.Number),
  supportsStreaming: Schema.Boolean,
  supportedMethods: Schema.Array(Schema.String),
}) {}
