export const loadApiKeyStatusQuery = async (): Promise<{
  success: boolean;
  data?: { configured: boolean };
  error?: string;
}> => window.electronSettings.getApiKeyStatus();

export const loadDefaultModelQuery = async (): Promise<{ success: boolean; data?: unknown; error?: string }> =>
  window.electronSettings.getDefaultModel();

export const loadAvailableModelsQuery = async (): Promise<{
  success: boolean;
  data?: Array<{
    name: string;
    displayName: string;
    description: string;
    supportedMethods: string[];
  }>;
  error?: string;
}> => window.electronSettings.listModels();
