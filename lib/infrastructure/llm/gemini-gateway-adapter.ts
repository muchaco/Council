import { GoogleGenerativeAI } from '@google/generative-ai';
import { Effect } from 'effect';
import type { LlmGatewayAdapter } from './llm-gateway-adapter.js';
import { mapGeminiError } from './gemini-error-mapper.js';
import type { GenerateRequest, GenerateResponse, ModelInfo } from './types.js';

export const createGeminiGatewayAdapter = (): LlmGatewayAdapter => ({
  generateResponse: (request: GenerateRequest) => Effect.tryPromise({
    try: async (): Promise<GenerateResponse> => {
      const genAI = new GoogleGenerativeAI(request.apiKey);
      const model = genAI.getGenerativeModel({
        model: request.modelId,
        systemInstruction: request.systemPrompt,
      });

      // Convert generic messages to Gemini format
      const contents = request.messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      const result = await model.generateContent({
        contents,
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
        },
      });

      return {
        content: result.response.text(),
        tokenCount: result.response.usageMetadata?.totalTokenCount,
        finishReason: result.response.candidates?.[0]?.finishReason,
      };
    },
    catch: (error) => mapGeminiError(error),
  }),

  listModels: (apiKey: string) => Effect.tryPromise({
    try: async (): Promise<ReadonlyArray<ModelInfo>> => {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models',
        { headers: { 'x-goog-api-key': apiKey } }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json() as { models?: Array<{
        name: string;
        displayName?: string;
        description?: string;
        outputTokenLimit?: number;
        supportedGenerationMethods?: string[];
      }> };

      return (data.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => ({
          id: m.name.replace('models/', ''),
          displayName: m.displayName ?? m.name,
          description: m.description,
          maxTokens: m.outputTokenLimit,
          supportsStreaming: m.supportedGenerationMethods?.includes('streamGenerateContent'),
        }));
    },
    catch: (error) => mapGeminiError(error),
  }),
});
