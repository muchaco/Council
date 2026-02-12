import crypto from 'crypto';
import os from 'os';
import Store from 'electron-store';

const MIN_ENCRYPTION_KEY_LENGTH = 32;

const WEAK_ENCRYPTION_KEYS = new Set([
  'council-default-key',
  'council-default-key-change-in-production',
]);

type CouncilEncryptionPolicyInput = {
  readonly councilEncryptionKey: string | undefined;
  readonly isPackaged: boolean;
};

const createDevelopmentFallbackKey = (): string => {
  const entropySeed = [
    os.hostname(),
    os.homedir(),
    process.cwd(),
    process.env.USER ?? '',
  ].join('|');

  const digest = crypto.createHash('sha256').update(entropySeed).digest('hex');
  return `council-dev-${digest}`;
};

export const isWeakCouncilEncryptionKey = (encryptionKey: string): boolean => {
  const normalizedKey = encryptionKey.trim();
  if (normalizedKey.length < MIN_ENCRYPTION_KEY_LENGTH) {
    return true;
  }

  return WEAK_ENCRYPTION_KEYS.has(normalizedKey);
};

export const resolveCouncilEncryptionKey = ({
  councilEncryptionKey,
  isPackaged,
}: CouncilEncryptionPolicyInput): string => {
  const normalizedKey = councilEncryptionKey?.trim();

  if (normalizedKey !== undefined && normalizedKey.length > 0) {
    if (isWeakCouncilEncryptionKey(normalizedKey)) {
      throw new Error('COUNCIL_ENCRYPTION_KEY is too weak for secure secret storage');
    }

    return normalizedKey;
  }

  if (isPackaged) {
    throw new Error('COUNCIL_ENCRYPTION_KEY is required in packaged builds');
  }

  return createDevelopmentFallbackKey();
};

export const createCouncilSettingsStore = <Schema extends object>(
  isPackaged: boolean
): Store<Schema> =>
  new Store<Schema>({
    name: 'council-settings',
    encryptionKey: resolveCouncilEncryptionKey({
      councilEncryptionKey: process.env.COUNCIL_ENCRYPTION_KEY,
      isPackaged,
    }),
  });
