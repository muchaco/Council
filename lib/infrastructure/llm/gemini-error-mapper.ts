import {
  ProviderAuthenticationError,
  ProviderRateLimitError,
  ProviderModelNotFoundError,
  ProviderGenericError,
} from '../../core/errors/llm-error.js';

export const mapGeminiError = (error: unknown): ProviderAuthenticationError | ProviderRateLimitError | ProviderModelNotFoundError | ProviderGenericError => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('api key') || message.includes('authentication') || message.includes('401')) {
      return {
        _tag: 'ProviderAuthenticationError',
        providerId: 'gemini',
        message: error.message,
      };
    }

    if (message.includes('429') || message.includes('rate limit') || message.includes('quota')) {
      return {
        _tag: 'ProviderRateLimitError',
        providerId: 'gemini',
        message: error.message,
      };
    }

    if (message.includes('not found') || message.includes('404') || message.includes('model')) {
      return {
        _tag: 'ProviderModelNotFoundError',
        providerId: 'gemini',
        modelId: 'unknown',
        message: error.message,
      };
    }
  }

  return {
    _tag: 'ProviderGenericError',
    providerId: 'gemini',
    cause: error,
  };
};
