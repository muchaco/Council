import type { LlmGatewayAdapter } from './llm-gateway-adapter.js';

export type ProviderRegistry = Record<string, LlmGatewayAdapter>;

export const createProviderRegistry = (): ProviderRegistry => ({
  // Provider adapters will be registered here
  // e.g., gemini: createGeminiGatewayAdapter(),
});

export const getAdapter = (
  registry: ProviderRegistry,
  providerId: string
): LlmGatewayAdapter => {
  const adapter = registry[providerId];
  if (!adapter) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  return adapter;
};
