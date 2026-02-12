import { create } from 'zustand';
import { toast } from 'sonner';
import type { ModelInfo } from '../lib/types';
import {
  setDefaultGeminiModelCommand,
  setGeminiApiKeyCommand,
  testGeminiConnectionCommand,
} from '../lib/shell/renderer/settings-command-client';
import {
  loadApiKeyStatusQuery,
  loadDefaultModelQuery,
  loadAvailableModelsQuery,
} from '../lib/shell/renderer/settings-query-client';

interface SettingsState {
  isApiKeyConfigured: boolean;
  isConnected: boolean;
  isLoading: boolean;
  isModelCatalogLoading: boolean;
  modelCatalogError: string | null;
  defaultModel: string;
  availableModels: ModelInfo[];
  modelsLastFetched: number | null;

  // Actions
  loadApiKeyStatus: () => Promise<void>;
  setApiKey: (key: string) => Promise<boolean>;
  testConnection: () => Promise<boolean>;
  loadDefaultModel: () => Promise<void>;
  setDefaultModel: (model: string) => Promise<void>;
  fetchAvailableModels: () => Promise<void>;
  invalidateModelCache: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  isApiKeyConfigured: false,
  isConnected: false,
  isLoading: false,
  isModelCatalogLoading: false,
  modelCatalogError: null,
  defaultModel: '',
  availableModels: [],
  modelsLastFetched: null,

  loadApiKeyStatus: async () => {
    try {
      const result = await loadApiKeyStatusQuery();
      if (result.success && result.data) {
        set({ isApiKeyConfigured: result.data.configured });
      }
    } catch (error) {
      console.error('Error loading API key status:', error);
    }
  },

  setApiKey: async (key: string) => {
    try {
      set({ isLoading: true });
      const result = await setGeminiApiKeyCommand(key);
      if (result.success) {
        const hasGeminiApiKey = key.trim().length > 0;

        set({
          isApiKeyConfigured: hasGeminiApiKey,
          availableModels: [],
          modelsLastFetched: null,
          modelCatalogError: null,
        });

        if (hasGeminiApiKey) {
          await get().fetchAvailableModels();
        }

        toast.success('API key saved successfully');
        return true;
      } else {
        toast.error(result.error || 'Failed to save API key');
        return false;
      }
    } catch (error) {
      toast.error('Error saving API key');
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  testConnection: async () => {
    try {
      set({ isLoading: true });
      const result = await testGeminiConnectionCommand();
      if (result.success && result.data) {
        set({ isConnected: true });

        if (get().isApiKeyConfigured && get().availableModels.length === 0) {
          await get().fetchAvailableModels();
        }

        toast.success('Connected to Gemini API successfully');
        return true;
      } else {
        set({ isConnected: false });
        toast.error(result.error || 'Failed to connect to Gemini API');
        return false;
      }
    } catch (error) {
      set({ isConnected: false });
      toast.error('Error testing connection');
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  loadDefaultModel: async () => {
    try {
      const result = await loadDefaultModelQuery();
      if (result.success && result.data) {
        set({ defaultModel: result.data as string });
      }
      // Also fetch available models
      await get().fetchAvailableModels();
    } catch (error) {
      console.error('Error loading default model:', error);
    }
  },

  setDefaultModel: async (model: string) => {
    try {
      const result = await setDefaultGeminiModelCommand(model);
      if (result.success) {
        set({ defaultModel: model });
      }
    } catch (error) {
      console.error('Error setting default model:', error);
    }
  },

  fetchAvailableModels: async () => {
    try {
      set({ isModelCatalogLoading: true, modelCatalogError: null });

      const result = await loadAvailableModelsQuery();
      if (!result.success || !result.data) {
        const errorMessage = result.error ?? 'Unable to load Gemini models';
        console.error('Failed to fetch models:', errorMessage);
        set({ modelCatalogError: errorMessage });
        return;
      }

      set({
        isApiKeyConfigured: result.data.configured,
        availableModels: [...result.data.models],
        modelsLastFetched: result.data.fetchedAtEpochMs,
        modelCatalogError: null,
      });
    } catch (error) {
      console.error('Error fetching models:', error);
      set({ modelCatalogError: 'Unable to load Gemini models' });
    } finally {
      set({ isModelCatalogLoading: false });
    }
  },

  invalidateModelCache: () => {
    set({ modelsLastFetched: null });
  },
}));
