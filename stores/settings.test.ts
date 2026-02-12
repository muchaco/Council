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
  getApiKeyStatus: vi.fn(),
  setApiKey: vi.fn(),
  testConnection: vi.fn(),
  getDefaultModel: vi.fn(),
  setDefaultModel: vi.fn(),
  getModelCatalog: vi.fn(),
  listModels: vi.fn(),
};

describe('settings_store_spec', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      isApiKeyConfigured: false,
      isConnected: false,
      isLoading: false,
      isModelCatalogLoading: false,
      modelCatalogError: null,
      defaultModel: '',
      availableModels: [],
      modelsLastFetched: null,
    });
    Object.assign(window, { electronSettings: mockElectronSettings });
    mockElectronSettings.getApiKeyStatus.mockResolvedValue({
      success: true,
      data: { configured: false },
    });
    mockElectronSettings.getModelCatalog.mockResolvedValue({
      success: true,
      data: {
        configured: false,
        models: [],
        fetchedAtEpochMs: null,
      },
    });
  });

  it('loads_model_catalog_snapshot_when_api_key_is_missing', async () => {
    mockElectronSettings.getModelCatalog.mockResolvedValue({
      success: true,
      data: {
        configured: false,
        models: [],
        fetchedAtEpochMs: null,
      },
    });

    await useSettingsStore.getState().fetchAvailableModels();

    expect(mockElectronSettings.getModelCatalog).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().isApiKeyConfigured).toBe(false);
  });

  it('hydrates_api_key_status_before_refreshing_model_catalog', async () => {
    const models: ModelInfo[] = [
      {
        name: 'gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        description: 'Fast',
        supportedMethods: ['generateContent'],
      },
    ];

    useSettingsStore.setState({
      isApiKeyConfigured: false,
      availableModels: [],
      modelsLastFetched: null,
    });
    mockElectronSettings.getModelCatalog.mockResolvedValue({
      success: true,
      data: {
        configured: true,
        models,
        fetchedAtEpochMs: Date.now(),
      },
    });

    await useSettingsStore.getState().fetchAvailableModels();

    expect(useSettingsStore.getState().isApiKeyConfigured).toBe(true);
    expect(useSettingsStore.getState().availableModels).toEqual(models);
  });

  it('accepts_cached_model_catalog_from_main_process_snapshot', async () => {
    useSettingsStore.setState({
      isApiKeyConfigured: true,
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
    mockElectronSettings.getModelCatalog.mockResolvedValue({
      success: true,
      data: {
        configured: true,
        models: useSettingsStore.getState().availableModels,
        fetchedAtEpochMs: Date.now(),
      },
    });

    await useSettingsStore.getState().fetchAvailableModels();

    expect(mockElectronSettings.getModelCatalog).toHaveBeenCalledTimes(1);
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
      isApiKeyConfigured: true,
      availableModels: models,
      modelsLastFetched: 0,
    });
    mockElectronSettings.getModelCatalog.mockResolvedValue({
      success: true,
      data: {
        configured: true,
        models,
        fetchedAtEpochMs: Date.now(),
      },
    });

    await useSettingsStore.getState().fetchAvailableModels();

    expect(mockElectronSettings.getModelCatalog).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().availableModels).toEqual(models);
    expect(useSettingsStore.getState().modelsLastFetched).not.toBeNull();
  });

  it('refreshes_model_catalog_after_api_key_is_saved', async () => {
    const models: ModelInfo[] = [
      {
        name: 'gemini-2.5-pro',
        displayName: 'Gemini 2.5 Pro',
        description: 'Reasoning model',
        supportedMethods: ['generateContent'],
      },
    ];

    mockElectronSettings.setApiKey.mockResolvedValue({ success: true });
    mockElectronSettings.getModelCatalog.mockResolvedValue({
      success: true,
      data: {
        configured: true,
        models,
        fetchedAtEpochMs: Date.now(),
      },
    });

    const success = await useSettingsStore.getState().setApiKey('test-api-key');

    expect(success).toBe(true);
    expect(mockElectronSettings.getModelCatalog).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().availableModels).toEqual(models);
    expect(useSettingsStore.getState().modelsLastFetched).not.toBeNull();
  });

  it('refreshes_model_catalog_after_successful_connection_test_when_catalog_is_empty', async () => {
    const models: ModelInfo[] = [
      {
        name: 'gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        description: 'Fast',
        supportedMethods: ['generateContent'],
      },
    ];

    useSettingsStore.setState({
      isApiKeyConfigured: true,
      availableModels: [],
      modelsLastFetched: null,
    });

    mockElectronSettings.testConnection.mockResolvedValue({ success: true, data: true });
    mockElectronSettings.getModelCatalog.mockResolvedValue({
      success: true,
      data: {
        configured: true,
        models,
        fetchedAtEpochMs: Date.now(),
      },
    });

    const success = await useSettingsStore.getState().testConnection();

    expect(success).toBe(true);
    expect(mockElectronSettings.getModelCatalog).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().availableModels).toEqual(models);
  });

  it('shows_model_catalog_error_when_refresh_fails', async () => {
    useSettingsStore.setState({
      isApiKeyConfigured: true,
      availableModels: [],
      modelsLastFetched: 0,
    });
    mockElectronSettings.getModelCatalog.mockResolvedValue({
      success: false,
      error: 'Unable to load Gemini models',
    });

    await useSettingsStore.getState().fetchAvailableModels();

    expect(useSettingsStore.getState().isModelCatalogLoading).toBe(false);
    expect(useSettingsStore.getState().modelCatalogError).toBe('Unable to load Gemini models');
  });
});
