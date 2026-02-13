import { app, ipcMain as electronIpcMain } from 'electron';
import crypto from 'crypto';
import { z } from 'zod';
import { Effect } from 'effect';
import { registerPrivilegedIpcHandle } from '../lib/security/privileged-ipc.js';
import { logDiagnosticsError, logDiagnosticsEvent } from '../lib/diagnostics/logger.js';
import {
  createCouncilSettingsStore,
  resolveCouncilEncryptionKey,
} from '../../lib/infrastructure/settings/council-settings-security.js';
import {
  createProviderRegistry,
  getAdapter,
} from '../../lib/infrastructure/llm/provider-registry.js';
import {
  createGeminiGatewayAdapter,
} from '../../lib/infrastructure/llm/gemini-gateway-adapter.js';
import type { LlmProviderConfig } from '../../lib/infrastructure/settings/llm-settings.js';
import type { PrivilegedIpcHandleOptions } from '../lib/security/privileged-ipc.js';

const ipcMain = {
  handle: (
    channelName: string,
    handler: (...args: any[]) => unknown,
    options?: PrivilegedIpcHandleOptions
  ): void => {
    registerPrivilegedIpcHandle(electronIpcMain, channelName, handler as any, options);
  },
};

const noArgsSchema = z.tuple([]);
const apiKeyValueSchema = z.string().min(1);
const defaultModelValueSchema = z.string().min(1);
const providerIdSchema = z.string().min(1);

interface StoreSchema {
  apiKey: string;
  defaultModel: string;
  providers: Record<string, LlmProviderConfig>;
  defaultProvider: string;
}

const store = createCouncilSettingsStore<StoreSchema>(app.isPackaged);

// Initialize provider registry with Gemini adapter
const providerRegistry = createProviderRegistry();
// Register Gemini adapter
(providerRegistry as Record<string, unknown>)['gemini'] = createGeminiGatewayAdapter();

// Encryption utilities
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

const ENCRYPTION_KEY_MATERIAL = resolveCouncilEncryptionKey({
  councilEncryptionKey: process.env.COUNCIL_ENCRYPTION_KEY,
  isPackaged: app.isPackaged,
  developmentBootstrapKeyPath: process.env.COUNCIL_DEV_ENCRYPTION_KEY_PATH,
});

function getEncryptionKey(): Buffer {
  return crypto.scryptSync(ENCRYPTION_KEY_MATERIAL, 'council-salt', KEY_LENGTH);
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Combine iv + authTag + encrypted
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3 && parts.length !== 4) {
    throw new Error('Invalid encrypted data format');
  }

  const hasLegacySalt = parts.length === 4;
  const iv = Buffer.from(parts[hasLegacySalt ? 1 : 0], 'hex');
  const authTag = Buffer.from(parts[hasLegacySalt ? 2 : 1], 'hex');
  const encrypted = parts[hasLegacySalt ? 3 : 2];
  
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
const DEFAULT_PROVIDER = 'gemini';

type SettingsNetworkOperation = 'testConnection' | 'listModels';

const SETTINGS_NETWORK_PUBLIC_ERROR_MESSAGE: Record<SettingsNetworkOperation, string> = {
  testConnection: 'Unable to verify API key',
  listModels: 'Unable to load models',
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
    logDiagnosticsEvent({
      event_name: 'settings.model_catalog.fetch.completed',
      context: {
        outcome: 'success',
        source: 'cache',
        model_count: modelCache.models.length,
      },
    });
    return modelCache.models;
  }
  
  // Fetch from API
  const request = createGeminiModelsRequest(apiKey);
  const response = await fetch(request.url, request.init);
  
  if (!response.ok) {
    logDiagnosticsEvent({
      event_name: 'settings.model_catalog.fetch.completed',
      level: 'error',
      context: {
        outcome: 'network_error',
        source: 'remote',
        status_code: response.status,
      },
    });
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

  logDiagnosticsEvent({
    event_name: 'settings.model_catalog.fetch.completed',
    context: {
      outcome: 'success',
      source: 'remote',
      model_count: models.length,
      cache_ttl_ms: CACHE_DURATION_MS,
    },
  });
  
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
      logDiagnosticsError('settings.api_key_status.failed', error);
      return { success: false, error: 'Failed to load API key status' };
    }
  }, {
    argsSchema: noArgsSchema,
  });

  // Set API Key
  ipcMain.handle('settings:setApiKey', (_, key: string) => {
    try {
      const encrypted = encrypt(key);
      (store as any).set('apiKey', encrypted);
      return { success: true };
    } catch (error) {
      logDiagnosticsError('settings.set_api_key.failed', error);
      return { success: false, error: 'Failed to encrypt API key' };
    }
  }, {
    argsSchema: z.tuple([apiKeyValueSchema]),
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
    } catch (error) {
      logDiagnosticsError('settings.test_connection.failed', error);
      return {
        success: false,
        error: mapSettingsNetworkFailureToPublicError('testConnection'),
      };
    }
  }, {
    argsSchema: noArgsSchema,
    rateLimit: {
      maxRequests: 30,
      windowMs: 60_000,
    },
  });

  ipcMain.handle('settings:getDefaultModel', () => {
    try {
      const value = (store as any).get('defaultModel');
      return { success: true, data: value };
    } catch (error) {
      logDiagnosticsError('settings.get_default_model.failed', error);
      return { success: false, error: 'Failed to load default model' };
    }
  }, {
    argsSchema: noArgsSchema,
  });

  ipcMain.handle('settings:setDefaultModel', (_, defaultModel: string) => {
    try {
      (store as any).set('defaultModel', defaultModel);
      return { success: true };
    } catch (error) {
      logDiagnosticsError('settings.set_default_model.failed', error, {
        has_default_model: defaultModel.trim().length > 0,
      });
      return { success: false, error: 'Failed to save default model' };
    }
  }, {
    argsSchema: z.tuple([defaultModelValueSchema]),
  });

  // Get model catalog for a specific provider
  ipcMain.handle('settings:getModelCatalog', async (_event, providerId?: string) => {
    try {
      const targetProvider = providerId ?? DEFAULT_PROVIDER;
      
      // Get provider config or fall back to legacy settings
      const providers = (store as any).get('providers') as Record<string, LlmProviderConfig> | undefined;
      const providerConfig = providers?.[targetProvider];
      
      let apiKey: string | undefined;
      
      if (providerConfig?.apiKey) {
        apiKey = providerConfig.apiKey;
      } else {
        // Fallback to legacy apiKey for gemini
        const encrypted = (store as any).get('apiKey') as string | undefined;
        if (encrypted) {
          apiKey = decrypt(encrypted);
        }
      }
      
      if (!apiKey) {
        modelCache = null;
        return {
          success: true,
          data: {
            configured: false,
            models: [],
            fetchedAtEpochMs: null,
          },
        };
      }

      // Use provider registry to fetch models
      const adapter = getAdapter(providerRegistry, targetProvider);
      const result = await Effect.runPromise(
        adapter.listModels(apiKey).pipe(Effect.either)
      );

      if (result._tag === 'Left') {
        logDiagnosticsEvent({
          event_name: 'settings.model_catalog.fetch.completed',
          level: 'error',
          context: {
            outcome: 'error',
            provider: targetProvider,
            error_tag: result.left._tag,
          },
        });
        return {
          success: false,
          error: mapSettingsNetworkFailureToPublicError('listModels'),
        };
      }

      // Map to legacy ModelInfo format
      const models: ModelInfo[] = result.right.map(m => ({
        name: m.id,
        displayName: m.displayName,
        description: m.description ?? '',
        supportedMethods: m.supportsStreaming ? ['generateContent', 'streamGenerateContent'] : ['generateContent'],
      }));

      return {
        success: true,
        data: {
          configured: true,
          models,
          fetchedAtEpochMs: Date.now(),
        },
      };
    } catch (error) {
      logDiagnosticsError('settings.get_model_catalog.failed', error);
      return {
        success: false,
        error: mapSettingsNetworkFailureToPublicError('listModels'),
      };
    }
  }, {
    argsSchema: z.union([z.tuple([]), z.tuple([providerIdSchema.optional()])]),
    rateLimit: {
      maxRequests: 30,
      windowMs: 60_000,
    },
  });

  // Get provider configuration
  ipcMain.handle('settings:getProviderConfig', async (_event, providerId: string) => {
    try {
      const providers = (store as any).get('providers') as Record<string, LlmProviderConfig> | undefined;
      const config = providers?.[providerId];
      
      // If no provider config found and it's gemini, migrate from legacy
      if (!config && providerId === DEFAULT_PROVIDER) {
        const encrypted = (store as any).get('apiKey') as string | undefined;
        const defaultModel = (store as any).get('defaultModel') as string | undefined;
        
        if (encrypted) {
          const legacyConfig: LlmProviderConfig = {
            providerId: DEFAULT_PROVIDER,
            apiKey: decrypt(encrypted),
            defaultModel: defaultModel ?? 'gemini-2.5-flash',
            isEnabled: true,
          };
          return { success: true, data: legacyConfig };
        }
      }
      
      if (!config) {
        return { success: false, error: 'Provider not configured' };
      }
      
      return { success: true, data: config };
    } catch (error) {
      logDiagnosticsError('settings.get_provider_config.failed', error, { provider_id: providerId });
      return { success: false, error: 'Failed to load provider configuration' };
    }
  }, {
    argsSchema: z.tuple([providerIdSchema]),
  });

  // Set provider configuration
  ipcMain.handle('settings:setProviderConfig', async (_event, config: LlmProviderConfig) => {
    try {
      const providers = (store as any).get('providers') as Record<string, LlmProviderConfig> | undefined;
      const updatedProviders = { ...providers, [config.providerId]: config };
      (store as any).set('providers', updatedProviders);
      
      logDiagnosticsEvent({
        event_name: 'settings.provider_config.set',
        context: {
          provider_id: config.providerId,
          is_enabled: config.isEnabled,
        },
      });
      
      return { success: true };
    } catch (error) {
      logDiagnosticsError('settings.set_provider_config.failed', error, { provider_id: config.providerId });
      return { success: false, error: 'Failed to save provider configuration' };
    }
  }, {
    argsSchema: z.tuple([z.object({
      providerId: z.string(),
      apiKey: z.string(),
      defaultModel: z.string(),
      isEnabled: z.boolean(),
    })]),
  });

  // Get default provider
  ipcMain.handle('settings:getDefaultProvider', async () => {
    try {
      const defaultProvider = (store as any).get('defaultProvider') as string | undefined;
      return { success: true, data: defaultProvider ?? DEFAULT_PROVIDER };
    } catch (error) {
      logDiagnosticsError('settings.get_default_provider.failed', error);
      return { success: true, data: DEFAULT_PROVIDER };
    }
  }, {
    argsSchema: noArgsSchema,
  });

  // Set default provider
  ipcMain.handle('settings:setDefaultProvider', async (_event, providerId: string) => {
    try {
      (store as any).set('defaultProvider', providerId);
      
      logDiagnosticsEvent({
        event_name: 'settings.default_provider.set',
        context: {
          provider_id: providerId,
        },
      });
      
      return { success: true };
    } catch (error) {
      logDiagnosticsError('settings.set_default_provider.failed', error, { provider_id: providerId });
      return { success: false, error: 'Failed to set default provider' };
    }
  }, {
    argsSchema: z.tuple([providerIdSchema]),
  });

}
