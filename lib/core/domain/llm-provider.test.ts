import { describe, expect, it } from 'vitest';
import { Schema } from 'effect';
import { LlmProviderConfig, ProviderModelInfo } from './llm-provider';

describe('llm_provider_spec', () => {
  describe('LlmProviderConfig', () => {
    it('validates_provider_configuration', () => {
      const valid = {
        providerId: 'gemini',
        apiKey: 'test-api-key',
        defaultModel: 'gemini-2.5-flash',
        isEnabled: true,
      };
      
      const result = Schema.decodeUnknownSync(LlmProviderConfig)(valid);
      
      expect(result.providerId).toBe('gemini');
      expect(result.apiKey).toBe('test-api-key');
      expect(result.defaultModel).toBe('gemini-2.5-flash');
      expect(result.isEnabled).toBe(true);
    });

    it('validates_different_provider_configuration', () => {
      const valid = {
        providerId: 'openai',
        apiKey: 'sk-test-key',
        defaultModel: 'gpt-4',
        isEnabled: false,
      };
      
      const result = Schema.decodeUnknownSync(LlmProviderConfig)(valid);
      
      expect(result.providerId).toBe('openai');
      expect(result.apiKey).toBe('sk-test-key');
      expect(result.defaultModel).toBe('gpt-4');
      expect(result.isEnabled).toBe(false);
    });
  });

  describe('ProviderModelInfo', () => {
    it('validates_model_info', () => {
      const modelInfo = {
        id: 'gemini-2.5-flash',
        displayName: 'Gemini 2.5 Flash',
        providerId: 'gemini',
        supportsStreaming: true,
        supportedMethods: ['generateContent', 'streamGenerateContent'],
      };
      
      const result = Schema.decodeUnknownSync(ProviderModelInfo)(modelInfo);
      
      expect(result.id).toBe('gemini-2.5-flash');
      expect(result.displayName).toBe('Gemini 2.5 Flash');
      expect(result.providerId).toBe('gemini');
      expect(result.supportsStreaming).toBe(true);
      expect(result.supportedMethods).toEqual(['generateContent', 'streamGenerateContent']);
    });

    it('validates_model_info_with_optional_maxTokens', () => {
      const modelInfo = {
        id: 'gpt-4',
        displayName: 'GPT-4',
        providerId: 'openai',
        maxTokens: 8192,
        supportsStreaming: true,
        supportedMethods: ['chat.completions'],
      };
      
      const result = Schema.decodeUnknownSync(ProviderModelInfo)(modelInfo);
      
      expect(result.id).toBe('gpt-4');
      expect(result.displayName).toBe('GPT-4');
      expect(result.maxTokens).toBe(8192);
      expect(result.supportsStreaming).toBe(true);
    });
  });
});
