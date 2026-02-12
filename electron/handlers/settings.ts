import { ipcMain as electronIpcMain } from 'electron';
import Store from 'electron-store';
import crypto from 'crypto';
import { registerPrivilegedIpcHandle } from '../lib/security/privileged-ipc.js';

const ipcMain = {
  handle: (channelName: string, handler: (...args: any[]) => unknown): void => {
    registerPrivilegedIpcHandle(electronIpcMain, channelName, handler as any);
  },
};

interface StoreSchema {
  apiKey: string;
  defaultModel: string;
}

const store = new Store<StoreSchema>({
  name: 'council-settings',
  encryptionKey: process.env.COUNCIL_ENCRYPTION_KEY || 'council-default-key-change-in-production',
});

// Encryption utilities
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  // In production, this should come from a secure key management system
  // For now, we use a derived key from the machine-specific data
  const machineId = process.env.COUNCIL_ENCRYPTION_KEY || 'council-default-key';
  return crypto.scryptSync(machineId, 'council-salt', KEY_LENGTH);
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = getEncryptionKey();
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Combine salt + iv + authTag + encrypted
  return salt.toString('hex') + ':' + iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format');
  }
  
  const salt = Buffer.from(parts[0], 'hex');
  const iv = Buffer.from(parts[1], 'hex');
  const authTag = Buffer.from(parts[2], 'hex');
  const encrypted = parts[3];
  
  const key = getEncryptionKey();
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Model list cache
interface ModelInfo {
  name: string;
  displayName: string;
  description: string;
  supportedMethods: string[];
}

interface ModelCache {
  models: ModelInfo[];
  timestamp: number;
  apiKeyHash: string;
}

let modelCache: ModelCache | null = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_API_KEY_HEADER = 'x-goog-api-key';

type SettingsNetworkOperation = 'testConnection' | 'listModels';

const SETTINGS_NETWORK_PUBLIC_ERROR_MESSAGE: Record<SettingsNetworkOperation, string> = {
  testConnection: 'Unable to verify Gemini API key',
  listModels: 'Unable to load Gemini models',
};

export const mapSettingsNetworkFailureToPublicError = (
  operation: SettingsNetworkOperation
): string => SETTINGS_NETWORK_PUBLIC_ERROR_MESSAGE[operation];

export const createGeminiModelsRequest = (
  apiKey: string
): { readonly url: string; readonly init: RequestInit } => ({
  url: GEMINI_MODELS_URL,
  init: {
    headers: {
      [GEMINI_API_KEY_HEADER]: apiKey,
    },
  },
});

function getApiKeyHash(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex').substring(0, 16);
}

async function fetchAvailableModels(apiKey: string): Promise<ModelInfo[]> {
  const apiKeyHash = getApiKeyHash(apiKey);
  const now = Date.now();
  
  // Check cache
  if (modelCache && 
      modelCache.apiKeyHash === apiKeyHash && 
      now - modelCache.timestamp < CACHE_DURATION_MS) {
    return modelCache.models;
  }
  
  // Fetch from API
  const request = createGeminiModelsRequest(apiKey);
  const response = await fetch(request.url, request.init);
  
  if (!response.ok) {
    throw new Error(`GEMINI_MODELS_HTTP_${response.status}`);
  }
  
  const data = await response.json() as { models?: any[] };
  
  // Filter and format models
  const models: ModelInfo[] = data.models
    ?.filter((model: any) => 
      model.supportedGenerationMethods?.includes('generateContent')
    )
    ?.map((model: any) => ({
      name: model.name.replace('models/', ''),
      displayName: model.displayName || model.name.replace('models/', ''),
      description: model.description || '',
      supportedMethods: model.supportedGenerationMethods || [],
    }))
    ?.sort((a: ModelInfo, b: ModelInfo) => a.displayName.localeCompare(b.displayName)) || [];
  
  // Update cache
  modelCache = {
    models,
    timestamp: now,
    apiKeyHash,
  };
  
  return models;
}

export function setupSettingsHandlers(): void {
  // Get API key status without exposing plaintext key
  ipcMain.handle('settings:getApiKeyStatus', () => {
    try {
      const encrypted = (store as any).get('apiKey') as string | undefined;
      return {
        success: true,
        data: {
          configured: typeof encrypted === 'string' && encrypted.trim().length > 0,
        },
      };
    } catch (error) {
      console.error('Error loading API key status:', error);
      return { success: false, error: 'Failed to load API key status' };
    }
  });

  // Set API Key
  ipcMain.handle('settings:setApiKey', (_, key: string) => {
    try {
      const encrypted = encrypt(key);
      (store as any).set('apiKey', encrypted);
      return { success: true };
    } catch (error) {
      console.error('Error encrypting API key:', error);
      return { success: false, error: 'Failed to encrypt API key' };
    }
  });

  // Test Connection
  ipcMain.handle('settings:testConnection', async () => {
    try {
      const encrypted = (store as any).get('apiKey') as string | undefined;
      if (!encrypted) {
        return { success: false, error: 'API key not set' };
      }
      
      const apiKey = decrypt(encrypted);

      // Test the API key with a simple request
      const request = createGeminiModelsRequest(apiKey);
      const response = await fetch(request.url, request.init);
      
      if (response.ok) {
        return { success: true, data: true };
      } else {
        return {
          success: false,
          error: mapSettingsNetworkFailureToPublicError('testConnection'),
        };
      }
    } catch {
      console.error('Error testing Gemini API connection');
      return {
        success: false,
        error: mapSettingsNetworkFailureToPublicError('testConnection'),
      };
    }
  });

  // Generic get/set for other settings
  ipcMain.handle('settings:get', (_, key: string) => {
    try {
      const value = (store as any).get(key);
      return { success: true, data: value };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('settings:set', (_, key: string, value: unknown) => {
    try {
      (store as any).set(key, value);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // List available models
  ipcMain.handle('settings:listModels', async () => {
    try {
      const encrypted = (store as any).get('apiKey') as string | undefined;
      if (!encrypted) {
        return { success: false, error: 'API key not set' };
      }
      
      const apiKey = decrypt(encrypted);
      const models = await fetchAvailableModels(apiKey);
      
      return { success: true, data: models };
    } catch {
      console.error('Error fetching Gemini models');
      return {
        success: false,
        error: mapSettingsNetworkFailureToPublicError('listModels'),
      };
    }
  });
}
