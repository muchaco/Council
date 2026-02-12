import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock('electron-store', () => ({
  default: class MockStore {
    get(): unknown {
      return undefined;
    }

    set(): void {
      return;
    }
  },
}));

import {
  createGeminiModelsRequest,
  mapSettingsNetworkFailureToPublicError,
} from './settings';

describe('settings_handler_network_security_spec', () => {
  it('builds_model_request_with_header_auth_and_no_query_key', () => {
    const request = createGeminiModelsRequest('test-api-key');

    expect(request.url).toBe('https://generativelanguage.googleapis.com/v1beta/models');
    expect(request.url).not.toContain('?key=');
    expect(request.init.headers).toEqual({
      'x-goog-api-key': 'test-api-key',
    });
  });

  it('maps_test_connection_failure_to_sanitized_public_error', () => {
    expect(mapSettingsNetworkFailureToPublicError('testConnection')).toBe(
      'Unable to verify Gemini API key'
    );
  });

  it('maps_model_listing_failure_to_sanitized_public_error', () => {
    expect(mapSettingsNetworkFailureToPublicError('listModels')).toBe(
      'Unable to load Gemini models'
    );
  });
});
