import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Effect, Either } from 'effect';
import type { GenerateRequest } from './types';

// Mock functions - must be defined before vi.mock
const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn();
const mockGoogleGenerativeAI = vi.fn();

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(),
}));

// Import after mocking
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createGeminiGatewayAdapter } from './gemini-gateway-adapter';

const baseRequest: GenerateRequest = {
  modelId: 'gemini-2.5-flash',
  apiKey: 'test-api-key',
  systemPrompt: 'You are a helpful assistant',
  messages: [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' },
    { role: 'user', content: 'How are you?' },
  ],
  temperature: 0.7,
  maxTokens: 1000,
};

describe('gemini_gateway_adapter_spec', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock implementation
    mockGoogleGenerativeAI.mockImplementation(() => ({
      getGenerativeModel: mockGetGenerativeModel,
    }));
    mockGetGenerativeModel.mockImplementation(() => ({
      generateContent: mockGenerateContent,
    }));
    // Update the GoogleGenerativeAI mock to use our mock function
    (GoogleGenerativeAI as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockGoogleGenerativeAI);
  });

  describe('generateResponse', () => {
    it('returns_successful_response_with_content_and_token_count', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Generated response',
          usageMetadata: { totalTokenCount: 150 },
          candidates: [{ finishReason: 'STOP' }],
        },
      });

      mockGetGenerativeModel.mockReturnValue({
        generateContent: mockGenerateContent,
      });

      mockGoogleGenerativeAI.mockReturnValue({
        getGenerativeModel: mockGetGenerativeModel,
      });

      const adapter = createGeminiGatewayAdapter();
      const result = await Effect.runPromise(adapter.generateResponse(baseRequest));

      expect(result.content).toBe('Generated response');
      expect(result.tokenCount).toBe(150);
      expect(result.finishReason).toBe('STOP');
    });

    it('converts_messages_to_gemini_format_correctly', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Response',
          usageMetadata: undefined,
          candidates: undefined,
        },
      });

      mockGetGenerativeModel.mockReturnValue({
        generateContent: mockGenerateContent,
      });

      mockGoogleGenerativeAI.mockReturnValue({
        getGenerativeModel: mockGetGenerativeModel,
      });

      const adapter = createGeminiGatewayAdapter();
      await Effect.runPromise(adapter.generateResponse(baseRequest));

      const callArg = mockGenerateContent.mock.calls[0][0];
      expect(callArg.contents).toEqual([
        { role: 'user', parts: [{ text: 'Hello' }] },
        { role: 'model', parts: [{ text: 'Hi there!' }] },
        { role: 'user', parts: [{ text: 'How are you?' }] },
      ]);
    });

    it('passes_system_instruction_to_model', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Response',
          usageMetadata: undefined,
          candidates: undefined,
        },
      });

      mockGetGenerativeModel.mockReturnValue({
        generateContent: mockGenerateContent,
      });

      mockGoogleGenerativeAI.mockReturnValue({
        getGenerativeModel: mockGetGenerativeModel,
      });

      const adapter = createGeminiGatewayAdapter();
      await Effect.runPromise(adapter.generateResponse(baseRequest));

      expect(mockGetGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash',
        systemInstruction: 'You are a helpful assistant',
      });
    });

    it('passes_generation_config_correctly', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Response',
          usageMetadata: undefined,
          candidates: undefined,
        },
      });

      mockGetGenerativeModel.mockReturnValue({
        generateContent: mockGenerateContent,
      });

      mockGoogleGenerativeAI.mockReturnValue({
        getGenerativeModel: mockGetGenerativeModel,
      });

      const adapter = createGeminiGatewayAdapter();
      await Effect.runPromise(adapter.generateResponse(baseRequest));

      const callArg = mockGenerateContent.mock.calls[0][0];
      expect(callArg.generationConfig).toEqual({
        temperature: 0.7,
        maxOutputTokens: 1000,
      });
    });

    it('returns_authentication_error_for_invalid_api_key', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Invalid API key'));

      mockGetGenerativeModel.mockReturnValue({
        generateContent: mockGenerateContent,
      });

      mockGoogleGenerativeAI.mockReturnValue({
        getGenerativeModel: mockGetGenerativeModel,
      });

      const adapter = createGeminiGatewayAdapter();
      const result = await Effect.runPromise(adapter.generateResponse(baseRequest).pipe(Effect.either));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe('ProviderAuthenticationError');
        expect(result.left.providerId).toBe('gemini');
      }
    });

    it('returns_rate_limit_error_for_429', async () => {
      mockGenerateContent.mockRejectedValue(new Error('HTTP 429: Rate limit exceeded'));

      mockGetGenerativeModel.mockReturnValue({
        generateContent: mockGenerateContent,
      });

      mockGoogleGenerativeAI.mockReturnValue({
        getGenerativeModel: mockGetGenerativeModel,
      });

      const adapter = createGeminiGatewayAdapter();
      const result = await Effect.runPromise(adapter.generateResponse(baseRequest).pipe(Effect.either));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe('ProviderRateLimitError');
      }
    });

    it('returns_model_not_found_error_for_model_errors', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Model not found'));

      mockGetGenerativeModel.mockReturnValue({
        generateContent: mockGenerateContent,
      });

      mockGoogleGenerativeAI.mockReturnValue({
        getGenerativeModel: mockGetGenerativeModel,
      });

      const adapter = createGeminiGatewayAdapter();
      const result = await Effect.runPromise(adapter.generateResponse(baseRequest).pipe(Effect.either));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe('ProviderModelNotFoundError');
      }
    });

    it('returns_generic_error_for_unknown_errors', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Some unexpected error'));

      mockGetGenerativeModel.mockReturnValue({
        generateContent: mockGenerateContent,
      });

      mockGoogleGenerativeAI.mockReturnValue({
        getGenerativeModel: mockGetGenerativeModel,
      });

      const adapter = createGeminiGatewayAdapter();
      const result = await Effect.runPromise(adapter.generateResponse(baseRequest).pipe(Effect.either));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe('ProviderGenericError');
      }
    });
  });

  describe('listModels', () => {
    it('returns_list_of_models_on_success', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          models: [
            {
              name: 'models/gemini-2.5-flash',
              displayName: 'Gemini 2.5 Flash',
              description: 'Fast model',
              outputTokenLimit: 8192,
              supportedGenerationMethods: ['generateContent', 'streamGenerateContent'],
            },
            {
              name: 'models/gemini-2.5-pro',
              displayName: 'Gemini 2.5 Pro',
              description: 'Pro model',
              outputTokenLimit: 8192,
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      });

      global.fetch = mockFetch;

      const adapter = createGeminiGatewayAdapter();
      const result = await Effect.runPromise(adapter.listModels('test-key'));

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'gemini-2.5-flash',
        displayName: 'Gemini 2.5 Flash',
        description: 'Fast model',
        maxTokens: 8192,
        supportsStreaming: true,
      });
      expect(result[1]).toEqual({
        id: 'gemini-2.5-pro',
        displayName: 'Gemini 2.5 Pro',
        description: 'Pro model',
        maxTokens: 8192,
        supportsStreaming: false,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://generativelanguage.googleapis.com/v1beta/models',
        { headers: { 'x-goog-api-key': 'test-key' } }
      );
    });

    it('filters_models_without_generate_content_support', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          models: [
            {
              name: 'models/gemini-2.5-flash',
              displayName: 'Gemini 2.5 Flash',
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/embedding-model',
              displayName: 'Embedding Model',
              supportedGenerationMethods: ['embedContent'],
            },
          ],
        }),
      });

      global.fetch = mockFetch;

      const adapter = createGeminiGatewayAdapter();
      const result = await Effect.runPromise(adapter.listModels('test-key'));

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gemini-2.5-flash');
    });

    it('uses_name_as_fallback_when_displayName_missing', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          models: [
            {
              name: 'models/gemini-2.5-flash',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      });

      global.fetch = mockFetch;

      const adapter = createGeminiGatewayAdapter();
      const result = await Effect.runPromise(adapter.listModels('test-key'));

      expect(result[0].displayName).toBe('models/gemini-2.5-flash');
    });

    it('returns_authentication_error_for_401_response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      global.fetch = mockFetch;

      const adapter = createGeminiGatewayAdapter();
      const result = await Effect.runPromise(adapter.listModels('test-key').pipe(Effect.either));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe('ProviderAuthenticationError');
      }
    });

    it('returns_rate_limit_error_for_429_response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limit exceeded'),
      });

      global.fetch = mockFetch;

      const adapter = createGeminiGatewayAdapter();
      const result = await Effect.runPromise(adapter.listModels('test-key').pipe(Effect.either));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe('ProviderRateLimitError');
      }
    });

    it('returns_generic_error_for_network_failure', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

      global.fetch = mockFetch;

      const adapter = createGeminiGatewayAdapter();
      const result = await Effect.runPromise(adapter.listModels('test-key').pipe(Effect.either));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe('ProviderGenericError');
      }
    });
  });
});
