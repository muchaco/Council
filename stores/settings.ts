import { create } from 'zustand';
import { toast } from 'sonner';
import type { ModelInfo } from '../lib/types';

interface SettingsState {
  geminiApiKey: string | null;
  isConnected: boolean;
  isLoading: boolean;
  defaultModel: string;
  availableModels: ModelInfo[];
  modelsLastFetched: number | null;

  // Actions
  loadApiKey: () => Promise<void>;
  setApiKey: (key: string) => Promise<boolean>;
  testConnection: () => Promise<boolean>;
  loadDefaultModel: () => Promise<void>;
  setDefaultModel: (model: string) => Promise<void>;
  fetchAvailableModels: () => Promise<void>;
  invalidateModelCache: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  geminiApiKey: null,
  isConnected: false,
  isLoading: false,
  defaultModel: '',
  availableModels: [],
  modelsLastFetched: null,

  loadApiKey: async () => {
    try {
      const result = await window.electronSettings.getApiKey();
      if (result.success && result.data) {
        set({ geminiApiKey: result.data });
      }
    } catch (error) {
      console.error('Error loading API key:', error);
    }
  },

  setApiKey: async (key: string) => {
    try {
      set({ isLoading: true });
      const result = await window.electronSettings.setApiKey(key);
      if (result.success) {
        set({ geminiApiKey: key });
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
    const { geminiApiKey, modelsLastFetched, availableModels } = get();
    
    // Skip if no API key
    if (!geminiApiKey) {
      return;
    }
    
    // Skip if we have models and cache is still valid (5 minutes)
    const now = Date.now();
    const cacheDuration = 5 * 60 * 1000; // 5 minutes
    if (modelsLastFetched && availableModels.length > 0 && now - modelsLastFetched < cacheDuration) {
      return;
    }
    
    try {
      const result = await window.electronSettings.listModels();
      if (result.success && result.data) {
        set({ 
          availableModels: result.data,
          modelsLastFetched: Date.now()
        });
      } else {
        console.error('Failed to fetch models:', result.error);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  },

  invalidateModelCache: () => {
    set({ modelsLastFetched: null });
  },
}));
