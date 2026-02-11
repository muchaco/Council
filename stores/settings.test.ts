import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ModelInfo } from '../lib/types';
import { useSettingsStore } from './settings';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockElectronSettings = {
  getApiKey: vi.fn(),
  setApiKey: vi.fn(),
  testConnection: vi.fn(),
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  listModels: vi.fn(),
};

describe('settings_store_spec', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      geminiApiKey: null,
      isConnected: false,
      isLoading: false,
      defaultModel: '',
      availableModels: [],
      modelsLastFetched: null,
    });
    Object.assign(window, { electronSettings: mockElectronSettings });
  });

  it('does_not_fetch_model_catalog_when_api_key_is_missing', async () => {
    await useSettingsStore.getState().fetchAvailableModels();

    expect(mockElectronSettings.listModels).not.toHaveBeenCalled();
  });

  it('does_not_fetch_model_catalog_when_cache_is_still_valid', async () => {
    useSettingsStore.setState({
      geminiApiKey: 'test-key',
      availableModels: [
        {
          name: 'gemini-2.0-flash',
          displayName: 'Gemini 2.0 Flash',
          description: 'Fast',
          supportedMethods: ['generateContent'],
        },
      ],
      modelsLastFetched: Date.now(),
    });

    await useSettingsStore.getState().fetchAvailableModels();

    expect(mockElectronSettings.listModels).not.toHaveBeenCalled();
  });

  it('fetches_and_persists_model_catalog_when_cache_is_stale', async () => {
    const models: ModelInfo[] = [
      {
        name: 'gemini-2.0-flash-lite',
        displayName: 'Gemini 2.0 Flash Lite',
        description: 'Low latency',
        supportedMethods: ['generateContent'],
      },
    ];

    useSettingsStore.setState({
      geminiApiKey: 'test-key',
      availableModels: models,
      modelsLastFetched: 0,
    });
    mockElectronSettings.listModels.mockResolvedValue({ success: true, data: models });

    await useSettingsStore.getState().fetchAvailableModels();

    expect(mockElectronSettings.listModels).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().availableModels).toEqual(models);
    expect(useSettingsStore.getState().modelsLastFetched).not.toBeNull();
  });
});
