# Settings Encryption Key Runbook

## Key provisioning

- Packaged builds must set `COUNCIL_ENCRYPTION_KEY` to a strong secret (minimum 32 characters).
- Local development may omit `COUNCIL_ENCRYPTION_KEY`; Council will bootstrap a random local key file at `~/.config/council/dev-encryption.key`.
- Override the development bootstrap location with `COUNCIL_DEV_ENCRYPTION_KEY_PATH` when running isolated environments.

## Rotation procedure

1. Set a new strong `COUNCIL_ENCRYPTION_KEY` in the runtime environment.
2. Restart Council so newly written secrets are encrypted with the new key material.
3. Re-enter sensitive settings (for example API keys) that were encrypted with older key material.

## Development key reset

1. Stop Council.
2. Delete the local bootstrap file (`~/.config/council/dev-encryption.key` or your override path).
3. Start Council to generate a fresh random development key.
4. Re-enter local secrets after reset.

## Keychain adapter evaluation note

- Current implementation stores encrypted values in `electron-store` and key material from environment/bootstrap file.
- Next hardening iteration should evaluate an OS keychain-backed adapter to remove file-based bootstrap material from developer machines.
