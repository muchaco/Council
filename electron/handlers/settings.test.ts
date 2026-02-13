import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
  },
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
  decrypt,
  encrypt,
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
      'Unable to verify API key'
    );
  });

  it('maps_model_listing_failure_to_sanitized_public_error', () => {
    expect(mapSettingsNetworkFailureToPublicError('listModels')).toBe(
      'Unable to load models'
    );
  });

  it('decrypts_new_format_written_without_unused_salt', () => {
    const encryptedValue = encrypt('secret-value');

    expect(decrypt(encryptedValue)).toBe('secret-value');
    expect(encryptedValue.split(':')).toHaveLength(3);
  });

  it('decrypts_legacy_four_segment_format_for_backward_compatibility', () => {
    const encryptedValue = encrypt('legacy-secret');
    const legacyEncryptedValue = `legacysalt:${encryptedValue}`;

    expect(decrypt(legacyEncryptedValue)).toBe('legacy-secret');
  });
});
