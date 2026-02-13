import { describe, expect, it } from 'vitest';
import { mapGeminiError } from './gemini-error-mapper';

describe('gemini_error_mapper_spec', () => {
  describe('mapGeminiError', () => {
    it('maps_api_key_error_to_authentication_error', () => {
      const error = new Error('Invalid API key');
      const result = mapGeminiError(error);

      expect(result._tag).toBe('ProviderAuthenticationError');
      expect(result.providerId).toBe('gemini');
      expect(result.message).toBe('Invalid API key');
    });

    it('maps_authentication_error_to_authentication_error', () => {
      const error = new Error('Authentication failed');
      const result = mapGeminiError(error);

      expect(result._tag).toBe('ProviderAuthenticationError');
      expect(result.providerId).toBe('gemini');
    });

    it('maps_401_status_to_authentication_error', () => {
      const error = new Error('HTTP 401: Unauthorized');
      const result = mapGeminiError(error);

      expect(result._tag).toBe('ProviderAuthenticationError');
    });

    it('maps_429_status_to_rate_limit_error', () => {
      const error = new Error('HTTP 429: Rate limit exceeded');
      const result = mapGeminiError(error);

      expect(result._tag).toBe('ProviderRateLimitError');
      expect(result.providerId).toBe('gemini');
      expect(result.message).toBe('HTTP 429: Rate limit exceeded');
    });

    it('maps_rate_limit_message_to_rate_limit_error', () => {
      const error = new Error('Rate limit reached');
      const result = mapGeminiError(error);

      expect(result._tag).toBe('ProviderRateLimitError');
    });

    it('maps_quota_message_to_rate_limit_error', () => {
      const error = new Error('Quota exceeded');
      const result = mapGeminiError(error);

      expect(result._tag).toBe('ProviderRateLimitError');
    });

    it('maps_404_status_to_model_not_found_error', () => {
      const error = new Error('HTTP 404: Not found');
      const result = mapGeminiError(error);

      expect(result._tag).toBe('ProviderModelNotFoundError');
      expect(result.providerId).toBe('gemini');
      expect(result.modelId).toBe('unknown');
    });

    it('maps_model_message_to_model_not_found_error', () => {
      const error = new Error('Model not found');
      const result = mapGeminiError(error);

      expect(result._tag).toBe('ProviderModelNotFoundError');
    });

    it('maps_not_found_message_to_model_not_found_error', () => {
      const error = new Error('Resource not found');
      const result = mapGeminiError(error);

      expect(result._tag).toBe('ProviderModelNotFoundError');
    });

    it('maps_unknown_error_to_generic_error', () => {
      const error = new Error('Some unexpected error');
      const result = mapGeminiError(error);

      expect(result._tag).toBe('ProviderGenericError');
      expect(result.providerId).toBe('gemini');
      expect(result.cause).toBe(error);
    });

    it('maps_non_error_to_generic_error', () => {
      const notError = 'just a string';
      const result = mapGeminiError(notError);

      expect(result._tag).toBe('ProviderGenericError');
      expect(result.providerId).toBe('gemini');
      expect(result.cause).toBe(notError);
    });

    it('is_case_insensitive_for_keywords', () => {
      const error = new Error('API KEY is invalid');
      const result = mapGeminiError(error);

      expect(result._tag).toBe('ProviderAuthenticationError');
    });
  });
});
