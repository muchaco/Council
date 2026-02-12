export const setGeminiApiKeyCommand = async (apiKey: string): Promise<{ success: boolean; error?: string }> =>
  window.electronSettings.setApiKey(apiKey);

export const testGeminiConnectionCommand = async (): Promise<{
  success: boolean;
  data?: boolean;
  error?: string;
}> => window.electronSettings.testConnection();

export const setDefaultGeminiModelCommand = async (
  defaultModel: string
): Promise<{ success: boolean; error?: string }> => window.electronSettings.setDefaultModel(defaultModel);
