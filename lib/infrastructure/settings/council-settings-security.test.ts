import fs from 'fs';
import os from 'os';
import path from 'path';
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

  it('creates_and_reuses_local_random_development_bootstrap_key', () => {
    const tempRootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'council-key-spec-'));
    const bootstrapKeyPath = path.join(tempRootPath, 'dev-encryption.key');

    const firstResolution = resolveCouncilEncryptionKey({
      councilEncryptionKey: undefined,
      isPackaged: false,
      developmentBootstrapKeyPath: bootstrapKeyPath,
    });

    const secondResolution = resolveCouncilEncryptionKey({
      councilEncryptionKey: undefined,
      isPackaged: false,
      developmentBootstrapKeyPath: bootstrapKeyPath,
    });

    expect(firstResolution).toHaveLength(64);
    expect(secondResolution).toBe(firstResolution);
    expect(fs.existsSync(bootstrapKeyPath)).toBe(true);
  });

  it('rejects_weak_development_bootstrap_key_file', () => {
    const tempRootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'council-key-spec-'));
    const bootstrapKeyPath = path.join(tempRootPath, 'dev-encryption.key');
    fs.writeFileSync(bootstrapKeyPath, 'short-key\n');

    expect(() =>
      resolveCouncilEncryptionKey({
        councilEncryptionKey: undefined,
        isPackaged: false,
        developmentBootstrapKeyPath: bootstrapKeyPath,
      })
    ).toThrow('Stored development bootstrap key is weak');
  });
});
