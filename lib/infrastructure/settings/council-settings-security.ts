import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Store from 'electron-store';

const MIN_ENCRYPTION_KEY_LENGTH = 32;

const WEAK_ENCRYPTION_KEYS = new Set([
  'council-default-key',
  'council-default-key-change-in-production',
]);

type CouncilEncryptionPolicyInput = {
  readonly councilEncryptionKey: string | undefined;
  readonly isPackaged: boolean;
  readonly developmentBootstrapKeyPath?: string;
};

const DEFAULT_DEVELOPMENT_BOOTSTRAP_KEY_PATH = path.join(
  os.homedir(),
  '.config',
  'council',
  'dev-encryption.key'
);

const createDevelopmentBootstrapKey = (): string => crypto.randomBytes(32).toString('hex');

const readDevelopmentBootstrapKey = (bootstrapKeyPath: string): string | null => {
  if (!fs.existsSync(bootstrapKeyPath)) {
    return null;
  }

  const storedBootstrapKey = fs.readFileSync(bootstrapKeyPath, 'utf8').trim();
  if (storedBootstrapKey.length === 0) {
    return null;
  }

  return storedBootstrapKey;
};

const persistDevelopmentBootstrapKey = (
  bootstrapKeyPath: string,
  bootstrapKey: string
): void => {
  const bootstrapDirectoryPath = path.dirname(bootstrapKeyPath);
  fs.mkdirSync(bootstrapDirectoryPath, { recursive: true, mode: 0o700 });
  fs.writeFileSync(bootstrapKeyPath, `${bootstrapKey}\n`, { mode: 0o600 });
};

const resolveDevelopmentBootstrapKey = (developmentBootstrapKeyPath?: string): string => {
  const bootstrapKeyPath = developmentBootstrapKeyPath ?? DEFAULT_DEVELOPMENT_BOOTSTRAP_KEY_PATH;
  const existingBootstrapKey = readDevelopmentBootstrapKey(bootstrapKeyPath);

  if (existingBootstrapKey !== null) {
    if (isWeakCouncilEncryptionKey(existingBootstrapKey)) {
      throw new Error(
        `Stored development bootstrap key is weak: ${bootstrapKeyPath}. Delete the file and restart with a strong key.`
      );
    }

    return existingBootstrapKey;
  }

  const generatedBootstrapKey = createDevelopmentBootstrapKey();
  persistDevelopmentBootstrapKey(bootstrapKeyPath, generatedBootstrapKey);
  console.warn(
    `Generated local development encryption key at ${bootstrapKeyPath}. Rotate by deleting this file and setting COUNCIL_ENCRYPTION_KEY.`
  );
  return generatedBootstrapKey;
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
  developmentBootstrapKeyPath,
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

  return resolveDevelopmentBootstrapKey(developmentBootstrapKeyPath);
};

export const createCouncilSettingsStore = <Schema extends object>(
  isPackaged: boolean
): Store<Schema> =>
  new Store<Schema>({
    name: 'council-settings',
    clearInvalidConfig: !isPackaged,
    encryptionKey: resolveCouncilEncryptionKey({
      councilEncryptionKey: process.env.COUNCIL_ENCRYPTION_KEY,
      isPackaged,
      developmentBootstrapKeyPath: process.env.COUNCIL_DEV_ENCRYPTION_KEY_PATH,
    }),
  });
