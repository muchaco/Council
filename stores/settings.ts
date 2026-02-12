import { create } from 'zustand';
import { toast } from 'sonner';
import { Effect, Either } from 'effect';
import type { ModelInfo } from '../lib/types';
import {
  SettingsModelCatalogGateway,
  executeRefreshSettingsModelCatalog,
} from '../lib/application/use-cases/settings';
import { LiveClockLayer } from '../lib/infrastructure/clock';
import { makeSettingsModelCatalogGatewayFromElectronSettings } from '../lib/infrastructure/settings';

interface SettingsState {
  isApiKeyConfigured: boolean;
  isConnected: boolean;
  isLoading: boolean;
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
  defaultModel: '',
  availableModels: [],
  modelsLastFetched: null,

  loadApiKeyStatus: async () => {
    try {
      const result = await window.electronSettings.getApiKeyStatus();
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
      const result = await window.electronSettings.setApiKey(key);
      if (result.success) {
        set({ isApiKeyConfigured: key.trim().length > 0 });
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
      const result = await window.electronSettings.testConnection();
      if (result.success && result.data) {
        set({ isConnected: true });
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
      const result = await window.electronSettings.getSetting('defaultModel');
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
      const result = await window.electronSettings.setSetting('defaultModel', model);
      if (result.success) {
        set({ defaultModel: model });
      }
    } catch (error) {
      console.error('Error setting default model:', error);
    }
  },

  fetchAvailableModels: async () => {
    const { isApiKeyConfigured, modelsLastFetched, availableModels } = get();

    try {
      const outcome = await Effect.runPromise(
        executeRefreshSettingsModelCatalog({
          hasGeminiApiKey: isApiKeyConfigured,
          cachedModelCount: availableModels.length,
          modelsLastFetchedEpochMs: modelsLastFetched,
        }).pipe(
          Effect.provideService(
            SettingsModelCatalogGateway,
            makeSettingsModelCatalogGatewayFromElectronSettings(window.electronSettings)
          ),
          Effect.provide(LiveClockLayer),
          Effect.either
        )
      );

      if (Either.isLeft(outcome)) {
        console.error('Failed to fetch models:', outcome.left.message);
        return;
      }

      if (outcome.right._tag === 'SettingsModelCatalogRefreshed') {
        set({
          availableModels: [...outcome.right.models],
          modelsLastFetched: outcome.right.refreshedAtEpochMs,
        });
      }
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  },

  invalidateModelCache: () => {
    set({ modelsLastFetched: null });
  },
}));
