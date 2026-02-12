import { describe, expect, it } from 'vitest';

import {
  isWeakCouncilEncryptionKey,
  resolveCouncilEncryptionKey,
} from './council-settings-security';

describe('council_settings_security_policy_spec', () => {
  it('rejects_known_default_keys_as_weak', () => {
    expect(isWeakCouncilEncryptionKey('council-default-key')).toBe(true);
    expect(isWeakCouncilEncryptionKey('council-default-key-change-in-production')).toBe(true);
  });

  it('rejects_short_keys_as_weak', () => {
    expect(isWeakCouncilEncryptionKey('short-key')).toBe(true);
  });

  it('requires_encryption_key_when_packaged', () => {
    expect(() =>
      resolveCouncilEncryptionKey({
        councilEncryptionKey: undefined,
        isPackaged: true,
      })
    ).toThrow('COUNCIL_ENCRYPTION_KEY is required in packaged builds');
  });

  it('returns_env_key_when_present_and_strong', () => {
    const strongKey = '0123456789abcdef0123456789abcdef';

    const resolved = resolveCouncilEncryptionKey({
      councilEncryptionKey: strongKey,
      isPackaged: true,
    });

    expect(resolved).toBe(strongKey);
  });
});
