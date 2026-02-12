import { getRendererBridge } from './renderer-bridge';

export const setGeminiApiKeyCommand = async (apiKey: string): Promise<{ success: boolean; error?: string }> =>
  getRendererBridge().electronSettings.setApiKey(apiKey);

export const testGeminiConnectionCommand = async (): Promise<{
  success: boolean;
  data?: boolean;
  error?: string;
}> => getRendererBridge().electronSettings.testConnection();

export const setDefaultGeminiModelCommand = async (
  defaultModel: string
): Promise<{ success: boolean; error?: string }> =>
  getRendererBridge().electronSettings.setDefaultModel(defaultModel);
