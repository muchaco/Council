import { getRendererBridge } from './renderer-bridge';

export const loadApiKeyStatusQuery = async (): Promise<{
  success: boolean;
  data?: { configured: boolean };
  error?: string;
}> => getRendererBridge().electronSettings.getApiKeyStatus();

export const loadDefaultModelQuery = async (): Promise<{ success: boolean; data?: unknown; error?: string }> =>
  getRendererBridge().electronSettings.getDefaultModel();

export const loadAvailableModelsQuery = async (): Promise<{
  success: boolean;
  data?: {
    configured: boolean;
    models: Array<{
      name: string;
      displayName: string;
      description: string;
      supportedMethods: string[];
    }>;
    fetchedAtEpochMs: number | null;
  };
  error?: string;
}> => getRendererBridge().electronSettings.getModelCatalog();
