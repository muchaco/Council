import { describe, expect, it } from 'vitest';
import { Effect, Either } from 'effect';

import { makeSessionPersonaResponseGatewayFromElectronLLM } from './session-persona-response-gateway';

const baseRequest = {
  personaId: 'persona-1',
  sessionId: 'session-1',
  model: 'gemini-2.0-flash',
  systemPrompt: 'Assist',
  hiddenAgenda: undefined,
  verbosity: undefined,
  temperature: 0.4,
  problemContext: 'Problem',
  outputGoal: 'Goal',
  blackboard: { consensus: '', conflicts: '', nextStep: '', facts: '' },
  otherPersonas: [],
} as const;

describe('session_persona_response_gateway_spec', () => {
  it('returns_generated_response_when_payload_is_valid', async () => {
    const gateway = makeSessionPersonaResponseGatewayFromElectronLLM({
      chat: async () => ({ success: true, data: { content: 'Hello', tokenCount: 12 } }),
    });

    const result = await Effect.runPromise(gateway.generatePersonaResponse(baseRequest));
    expect(result).toEqual({ content: 'Hello', tokenCount: 12 });
  });

  it('fails_when_payload_shape_is_invalid', async () => {
    const gateway = makeSessionPersonaResponseGatewayFromElectronLLM({
      chat: async () => ({ success: true, data: { content: 123 } as unknown as { content: string; tokenCount: number } }),
    });

    const outcome = await Effect.runPromise(gateway.generatePersonaResponse(baseRequest).pipe(Effect.either));
    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left.message).toBe('Invalid generated response payload');
    }
  });

  it('maps_success_false_transport_result_to_typed_error', async () => {
    const gateway = makeSessionPersonaResponseGatewayFromElectronLLM({
      chat: async () => ({ success: false, error: 'gateway unavailable' }),
    });

    const outcome = await Effect.runPromise(gateway.generatePersonaResponse(baseRequest).pipe(Effect.either));
    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'SessionMessagingInfrastructureError',
        source: 'llmGateway',
        message: 'gateway unavailable',
      });
    }
  });

  it('maps_thrown_exception_to_typed_error', async () => {
    const gateway = makeSessionPersonaResponseGatewayFromElectronLLM({
      chat: async () => {
        throw new Error('timeout');
      },
    });

    const outcome = await Effect.runPromise(gateway.generatePersonaResponse(baseRequest).pipe(Effect.either));
    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'SessionMessagingInfrastructureError',
        source: 'llmGateway',
        message: 'Failed to generate persona response',
      });
    }
  });
});
