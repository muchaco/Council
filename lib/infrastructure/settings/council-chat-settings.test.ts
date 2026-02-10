import { describe, expect, it } from 'vitest';
import { Effect, Either } from 'effect';

import { makeCouncilChatSettingsService } from './council-chat-settings';

describe('council_chat_settings_service_spec', () => {
  it('returns_generation_policy_defaults', async () => {
    const service = makeCouncilChatSettingsService(() => 'decrypted', { get: () => 'x' } as any);

    const policy = await Effect.runPromise(service.getGenerationPolicy);
    expect(policy).toEqual({ maxOutputTokens: 2048, defaultHistoryLimit: 15 });
  });

  it('returns_typed_error_when_api_key_is_missing', async () => {
    const service = makeCouncilChatSettingsService(() => 'decrypted', { get: () => undefined } as any);

    const outcome = await Effect.runPromise(service.getGeminiApiKey.pipe(Effect.either));
    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'CouncilChatInfrastructureError',
        source: 'settings',
        code: 'ApiKeyMissing',
        message: 'API key not configured',
      });
    }
  });
});
