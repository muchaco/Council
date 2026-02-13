export interface ProviderAuthenticationError {
  readonly _tag: 'ProviderAuthenticationError';
  readonly providerId: string;
  readonly message: string;
}

export interface ProviderRateLimitError {
  readonly _tag: 'ProviderRateLimitError';
  readonly providerId: string;
  readonly message: string;
}

export interface ProviderModelNotFoundError {
  readonly _tag: 'ProviderModelNotFoundError';
  readonly providerId: string;
  readonly modelId: string;
  readonly message: string;
}

export interface ProviderGenericError {
  readonly _tag: 'ProviderGenericError';
  readonly providerId: string;
  readonly cause: unknown;
}

export type LlmGatewayError =
  | ProviderAuthenticationError
  | ProviderRateLimitError
  | ProviderModelNotFoundError
  | ProviderGenericError;
