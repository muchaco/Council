import { app, ipcMain as electronIpcMain } from 'electron';
import { Effect, Either } from 'effect';
import { z } from 'zod';

import { decrypt } from './settings.js';
import { logDiagnosticsError, logDiagnosticsEvent } from '../lib/diagnostics/logger.js';
import { makeElectronSqlQueryExecutor } from '../lib/sql-query-executor.js';
import type { BlackboardState } from '../lib/types.js';
import {
  CouncilChatGateway,
  CouncilChatRepository,
  CouncilChatSettings,
  executeGenerateCouncilPersonaTurn,
  type CouncilChatUseCaseError,
} from '../../lib/application/use-cases/council-chat';
import { makeCouncilChatRepositoryFromSqlExecutor } from '../../lib/infrastructure/db';
import {
  createCouncilChatGateway,
  createProviderRegistry,
  createGeminiGatewayAdapter,
} from '../../lib/infrastructure/llm';
import {
  createCouncilSettingsStore,
  makeCouncilChatSettingsService,
  LlmSettings,
  type LlmProviderConfig,
  type ProviderId,
} from '../../lib/infrastructure/settings';
import {
  registerPrivilegedIpcHandle,
  type PrivilegedIpcHandleOptions,
} from '../lib/security/privileged-ipc.js';

const ipcMain = {
  handle: (
    channelName: string,
    handler: (...args: any[]) => unknown,
    options?: PrivilegedIpcHandleOptions
  ): void => {
    registerPrivilegedIpcHandle(electronIpcMain, channelName, handler as any, options);
  },
};

interface ChatRequest {
  personaId: string;
  sessionId: string;
  modelId: string;
  providerId?: string;
  systemPrompt: string;
  hiddenAgenda?: string;
  verbosity?: string;
  temperature: number;
  problemContext: string;
  outputGoal: string;
  blackboard: BlackboardState;
  otherPersonas: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

const chatRequestSchema = z.object({
  personaId: z.string(),
  sessionId: z.string(),
  modelId: z.string(),
  providerId: z.string().optional(),
  systemPrompt: z.string(),
  hiddenAgenda: z.string().optional(),
  verbosity: z.string().optional(),
  temperature: z.number(),
  problemContext: z.string(),
  outputGoal: z.string(),
  blackboard: z.object({
    consensus: z.string(),
    conflicts: z.string(),
    nextStep: z.string(),
    facts: z.string(),
  }),
  otherPersonas: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      role: z.string(),
    })
  ),
});

const mapErrorToMessage = (error: CouncilChatUseCaseError): string => {
  if (error._tag === 'CouncilChatPersonaNotFoundError') {
    return 'Selected persona is not available in this session';
  }

  if (error.source === 'settings') {
    if (error.code === 'ApiKeyMissing') {
      return 'Gemini API key is not configured';
    }

    if (error.code === 'ApiKeyDecryptFailed') {
      return 'Failed to decrypt Gemini API key';
    }

    return 'Unable to load model settings';
  }

  if (error.source === 'llmGateway') {
    if (error.code === 'AuthenticationFailed') {
      return 'Gemini authentication failed';
    }

    if (error.code === 'ModelNotFound') {
      return 'Selected model is unavailable';
    }

    if (error.code === 'RateLimited') {
      return 'Gemini request limit reached';
    }

    if (error.code === 'Timeout') {
      return 'Gemini request timed out';
    }

    return 'Unable to generate response';
  }

  return 'Unable to load required session data';
};
const LLM_CHAT_PUBLIC_ERROR_MESSAGE = 'Unable to generate response';

const DEFAULT_PROVIDER = 'gemini';

// Create LlmSettings service from electron-store
const makeLlmSettingsService = (
  decryptFn: (encrypted: string) => string,
  store: { get: (key: string) => unknown; set: (key: string, value: unknown) => void }
): typeof LlmSettings.Service => ({
  getApiKey: (providerId: ProviderId) => Effect.sync(() => {
    const providers = store.get('providers') as Record<string, LlmProviderConfig> | undefined;
    if (providers?.[providerId]?.apiKey) {
      return providers[providerId].apiKey;
    }
    // Fallback to legacy apiKey for gemini
    if (providerId === DEFAULT_PROVIDER) {
      const encrypted = store.get('apiKey') as string | undefined;
      if (encrypted) {
        return decryptFn(encrypted);
      }
    }
    return '';
  }),
  getDefaultProvider: () => Effect.sync(() => {
    const defaultProvider = store.get('defaultProvider') as string | undefined;
    return defaultProvider ?? DEFAULT_PROVIDER;
  }),
  getDefaultModel: (providerId: ProviderId) => Effect.sync(() => {
    const providers = store.get('providers') as Record<string, LlmProviderConfig> | undefined;
    if (providers?.[providerId]?.defaultModel) {
      return providers[providerId].defaultModel;
    }
    // Fallback to legacy defaultModel
    if (providerId === DEFAULT_PROVIDER) {
      const defaultModel = store.get('defaultModel') as string | undefined;
      return defaultModel ?? 'gemini-2.5-flash';
    }
    return 'gemini-2.5-flash';
  }),
  getProviderConfig: (providerId: ProviderId) => Effect.sync(() => {
    const providers = store.get('providers') as Record<string, LlmProviderConfig> | undefined;
    const config = providers?.[providerId];
    return config ?? {
      providerId,
      apiKey: '',
      defaultModel: 'gemini-2.5-flash',
      isEnabled: false,
    };
  }),
  listConfiguredProviders: () => Effect.sync(() => {
    const providers = store.get('providers') as Record<string, LlmProviderConfig> | undefined;
    return Object.keys(providers ?? {});
  }),
  setProviderConfig: (config: LlmProviderConfig) => Effect.sync(() => {
    const existing = store.get('providers') as Record<string, LlmProviderConfig> | undefined;
    const providers = { ...existing, [config.providerId]: config };
    store.set('providers', providers);
  }),
  setDefaultProvider: (providerId: ProviderId) => Effect.sync(() => {
    store.set('defaultProvider', providerId);
  }),
});

export function setupLLMHandlers(): void {
  const repository = makeCouncilChatRepositoryFromSqlExecutor(makeElectronSqlQueryExecutor());
  
  // Initialize provider registry with Gemini adapter
  const registry = createProviderRegistry();
  (registry as Record<string, unknown>)['gemini'] = createGeminiGatewayAdapter();
  
  const gateway = createCouncilChatGateway(registry);
  const settingsStore = createCouncilSettingsStore<{ apiKey: string; providers?: Record<string, unknown>; defaultProvider?: string }>(app.isPackaged);
  const settings = makeCouncilChatSettingsService(decrypt, settingsStore);
  const llmSettings = makeLlmSettingsService(decrypt, settingsStore as unknown as { get: (key: string) => unknown; set: (key: string, value: unknown) => void });

  ipcMain.handle('llm:chat', async (_, request: ChatRequest) => {
    try {
      const outcome = await Effect.runPromise(
        executeGenerateCouncilPersonaTurn({
          request: {
            personaId: request.personaId,
            sessionId: request.sessionId,
            model: request.modelId,
            modelId: request.modelId,
            providerId: request.providerId,
            systemPrompt: request.systemPrompt,
            hiddenAgenda: request.hiddenAgenda,
            verbosity: request.verbosity,
            temperature: request.temperature,
            problemContext: request.problemContext,
            outputGoal: request.outputGoal,
            blackboard: request.blackboard,
            otherPersonas: request.otherPersonas,
          },
        }).pipe(
          Effect.provideService(CouncilChatRepository, repository),
          Effect.provideService(CouncilChatGateway, gateway),
          Effect.provideService(CouncilChatSettings, settings),
          Effect.provideService(LlmSettings, llmSettings),
          Effect.either
        )
      );

      if (Either.isLeft(outcome)) {
        const errorSource = 'source' in outcome.left ? outcome.left.source : 'domain';
        const errorCode = 'code' in outcome.left ? outcome.left.code : null;

        logDiagnosticsEvent({
          event_name: 'llm.chat.completed',
          level: 'error',
          context: {
            session_id: request.sessionId,
            persona_id: request.personaId,
            model_id: request.modelId,
            provider_id: request.providerId,
            outcome: 'domain_failure',
            error_tag: outcome.left._tag,
            error_source: errorSource,
            error_code: errorCode,
          },
        });

        return {
          success: false,
          error: mapErrorToMessage(outcome.left),
        };
      }

      logDiagnosticsEvent({
        event_name: 'llm.chat.completed',
        context: {
          session_id: request.sessionId,
          persona_id: request.personaId,
          model_id: request.modelId,
          provider_id: request.providerId,
          outcome: 'success',
          token_count: outcome.right.tokenCount,
          response_characters: outcome.right.content.length,
        },
      });

      return {
        success: true,
        data: {
          content: outcome.right.content,
          tokenCount: outcome.right.tokenCount,
        },
      };
    } catch (error) {
      logDiagnosticsError('llm.chat.failed', error, {
        session_id: request.sessionId,
        persona_id: request.personaId,
        model_id: request.modelId,
        provider_id: request.providerId,
      });
      return {
        success: false,
        error: LLM_CHAT_PUBLIC_ERROR_MESSAGE,
      };
    }
  }, {
    argsSchema: z.tuple([chatRequestSchema]),
    rateLimit: {
      maxRequests: 12,
      windowMs: 60_000,
    },
  });
}
