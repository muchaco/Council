import { describe, expect, it } from 'vitest';
import { Effect, Either } from 'effect';

import { makeConductorSettingsService } from './conductor-settings';

describe('conductor_settings_service_spec', () => {
  it('returns_selector_generation_policy_defaults', async () => {
    const service = makeConductorSettingsService(() => 'decrypted', { get: () => 'x' } as any);

    const policy = await Effect.runPromise(service.getSelectorGenerationPolicy);
    expect(policy).toEqual({ temperature: 0.3, maxOutputTokens: 2048 });
  });

  it('returns_typed_error_when_api_key_is_missing', async () => {
    const service = makeConductorSettingsService(() => 'decrypted', { get: () => undefined } as any);

    const outcome = await Effect.runPromise(service.getGeminiApiKey.pipe(Effect.either));
    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'ConductorInfrastructureError',
        source: 'settings',
        code: 'ApiKeyMissing',
        message: 'API key not configured',
      });
    }
  });
});
