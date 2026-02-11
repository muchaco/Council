import { describe, expect, it } from 'vitest';
import { Effect, Either } from 'effect';

import { makeConductorSelectorGatewayFromExecutor } from './conductor-selector-gateway';

const baseRequest = {
  apiKey: 'test-key',
  selectorModel: 'gemini-1.5-pro',
  selectorPrompt: 'select next speaker',
  temperature: 0.3,
  maxOutputTokens: 2048,
} as const;

describe('conductor_selector_gateway_spec', () => {
  it('parses_selector_json_payload_into_typed_response', async () => {
    const gateway = makeConductorSelectorGatewayFromExecutor(async () =>
      JSON.stringify({
        selectedPersonaId: 'speaker-a',
        reasoning: 'Architect should speak next',
        isIntervention: true,
        interventionMessage: 'Refocus on risk constraints',
        updateBlackboard: { nextStep: 'Prioritize risk constraints' },
      })
    );

    const outcome = await Effect.runPromise(gateway.selectNextSpeaker(baseRequest));

    expect(outcome).toEqual({
      selectedPersonaId: 'speaker-a',
      reasoning: 'Architect should speak next',
      isIntervention: true,
      interventionMessage: 'Refocus on risk constraints',
      updateBlackboard: { nextStep: 'Prioritize risk constraints' },
    });
  });

  it('maps_invalid_json_payload_to_typed_parsing_error', async () => {
    const gateway = makeConductorSelectorGatewayFromExecutor(async () => 'this is not json');

    const outcome = await Effect.runPromise(gateway.selectNextSpeaker(baseRequest).pipe(Effect.either));

    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'ConductorInfrastructureError',
        source: 'selector',
        code: 'InvalidSelectorResponse',
        message: 'Selector response parsing failed: No JSON found in selector response',
      });
    }
  });
});
