import { Effect } from 'effect';

import type {
  CouncilChatInfrastructureError,
  CouncilChatGatewayService,
  GenerateCouncilPersonaTurnCommand,
} from '../../application/use-cases/council-chat/council-chat-dependencies';
import type { ProviderRegistry } from './provider-registry.js';
import { getAdapter } from './provider-registry.js';

const llmGatewayError = (
  code: CouncilChatInfrastructureError extends infer E
    ? E extends { source: 'llmGateway'; code: infer C }
      ? C
      : never
    : never,
  message: string
): CouncilChatInfrastructureError => ({
  _tag: 'CouncilChatInfrastructureError',
  source: 'llmGateway',
  code,
  message,
});

const mapLlmFailure = (error: unknown): CouncilChatInfrastructureError => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes('api key') || normalizedMessage.includes('unauthorized')) {
    return llmGatewayError('AuthenticationFailed', `LLM authentication failed: ${message}`);
  }

  if (normalizedMessage.includes('not found') && normalizedMessage.includes('model')) {
    return llmGatewayError('ModelNotFound', `LLM model not found: ${message}`);
  }

  if (normalizedMessage.includes('rate limit') || normalizedMessage.includes('quota')) {
    return llmGatewayError('RateLimited', `LLM rate limit reached: ${message}`);
  }

  if (normalizedMessage.includes('timeout') || normalizedMessage.includes('deadline')) {
    return llmGatewayError('Timeout', `LLM request timed out: ${message}`);
  }

  if (normalizedMessage.includes('network') || normalizedMessage.includes('fetch')) {
    return llmGatewayError('NetworkError', `LLM network error: ${message}`);
  }

  return llmGatewayError('Unknown', `LLM chat generation failed: ${message}`);
};

// Legacy factory for backward compatibility with existing tests
export const makeCouncilChatGatewayFromExecutor = (
  execute: (command: GenerateCouncilPersonaTurnCommand) => Promise<string>
): CouncilChatGatewayService => ({
  generateCouncilPersonaTurn: (command) =>
    Effect.tryPromise({
      try: () => execute(command),
      catch: mapLlmFailure,
    }),
});

// New factory using provider registry for provider abstraction
export const createCouncilChatGateway = (
  registry: ProviderRegistry
): CouncilChatGatewayService => ({
  generateCouncilPersonaTurn: (command) => {
    const adapter = getAdapter(registry, command.providerId);

    return adapter.generateResponse({
      modelId: command.modelId,
      apiKey: command.apiKey,
      systemPrompt: command.enhancedSystemPrompt,
      messages: [
        ...command.chatHistory.map(msg => ({
          role: msg.role,
          content: msg.parts.map(part => part.text).join(''),
        })),
        { role: 'user', content: command.turnPrompt },
      ],
      temperature: command.temperature,
      maxTokens: command.maxOutputTokens,
    }).pipe(
      Effect.map(response => response.content),
      Effect.mapError((error): CouncilChatInfrastructureError => ({
        _tag: 'CouncilChatInfrastructureError',
        source: 'llmGateway',
        code: 'Unknown',
        message: `LLM chat generation failed: ${error._tag}`,
      }))
    );
  },
});
