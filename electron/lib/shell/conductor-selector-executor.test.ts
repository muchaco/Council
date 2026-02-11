import { describe, expect, it } from 'vitest';

import type { SelectNextSpeakerRequest } from '../../../lib/application/use-cases/conductor';
import { executeConductorSelectorRequest } from './conductor-selector-executor';

const baseRequest: SelectNextSpeakerRequest = {
  apiKey: 'test-key',
  selectorModel: 'gemini-1.5-pro',
  selectorPrompt: 'Select next speaker',
  temperature: 0.3,
  maxOutputTokens: 2048,
};

describe('conductor_selector_executor_spec', () => {
  it('returns_generated_text_from_selector_model_response', async () => {
    const response = await executeConductorSelectorRequest(baseRequest, () => ({
      generateContent: async () => ({
        response: {
          text: () => '{"selectedPersonaId":"speaker-a"}',
        },
      }),
    }));

    expect(response).toBe('{"selectedPersonaId":"speaker-a"}');
  });

  it('passes_prompt_to_selector_model_generation', async () => {
    const receivedPrompts: string[] = [];

    await executeConductorSelectorRequest(baseRequest, () => ({
      generateContent: async (prompt) => {
        receivedPrompts.push(prompt);
        return {
          response: {
            text: () => '{}',
          },
        };
      },
    }));

    expect(receivedPrompts).toEqual(['Select next speaker']);
  });
});
