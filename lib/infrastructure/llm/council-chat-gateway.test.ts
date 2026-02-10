import { describe, expect, it } from 'vitest';
import { Effect, Either } from 'effect';

import { makeCouncilChatGatewayFromExecutor } from './council-chat-gateway';

const baseCommand = {
  apiKey: 'test-key',
  model: 'gemini-1.5-pro',
  temperature: 0.5,
  maxOutputTokens: 1024,
  enhancedSystemPrompt: 'prompt',
  chatHistory: [],
  turnPrompt: 'hello',
} as const;

describe('council_chat_gateway_spec', () => {
  it('maps_timeout_like_errors_to_timeout_code', async () => {
    const gateway = makeCouncilChatGatewayFromExecutor(async () => {
      throw new Error('deadline exceeded timeout');
    });

    const outcome = await Effect.runPromise(gateway.generateCouncilPersonaTurn(baseCommand).pipe(Effect.either));

    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'CouncilChatInfrastructureError',
        source: 'llmGateway',
        code: 'Timeout',
        message: 'LLM request timed out: deadline exceeded timeout',
      });
    }
  });

  it('maps_rate_limit_errors_to_rate_limited_code', async () => {
    const gateway = makeCouncilChatGatewayFromExecutor(async () => {
      throw new Error('quota exceeded rate limit');
    });

    const outcome = await Effect.runPromise(gateway.generateCouncilPersonaTurn(baseCommand).pipe(Effect.either));

    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left.source).toBe('llmGateway');
      expect(outcome.left.code).toBe('RateLimited');
    }
  });
});
