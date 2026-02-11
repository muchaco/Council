import { describe, expect, it } from 'vitest';
import { Effect, Either } from 'effect';

import { makeSettingsModelCatalogGatewayFromElectronSettings } from './settings-model-catalog-gateway';

describe('settings_model_catalog_gateway_spec', () => {
  it('returns_typed_models_when_payload_is_valid', async () => {
    const gateway = makeSettingsModelCatalogGatewayFromElectronSettings({
      listModels: async () => ({
        success: true,
        data: [
          {
            name: 'gemini-2.0-flash',
            displayName: 'Gemini 2.0 Flash',
            description: 'Fast model',
            supportedMethods: ['generateContent'],
          },
        ],
      }),
    });

    const result = await Effect.runPromise(gateway.listAvailableModels());
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('gemini-2.0-flash');
  });

  it('fails_with_typed_error_when_payload_shape_is_invalid', async () => {
    const gateway = makeSettingsModelCatalogGatewayFromElectronSettings({
      listModels: async () => ({
        success: true,
        data: [{ name: 123 }],
      }),
    });

    const outcome = await Effect.runPromise(gateway.listAvailableModels().pipe(Effect.either));
    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'SettingsModelCatalogInfrastructureError',
        source: 'settingsGateway',
        message: 'Invalid model catalog entry payload',
      });
    }
  });

  it('fails_with_transport_error_when_settings_gateway_returns_failure', async () => {
    const gateway = makeSettingsModelCatalogGatewayFromElectronSettings({
      listModels: async () => ({
        success: false,
        error: 'gateway unavailable',
      }),
    });

    const outcome = await Effect.runPromise(gateway.listAvailableModels().pipe(Effect.either));
    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'SettingsModelCatalogInfrastructureError',
        source: 'settingsGateway',
        message: 'gateway unavailable',
      });
    }
  });
});
