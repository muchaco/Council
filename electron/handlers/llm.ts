import { app, ipcMain as electronIpcMain } from 'electron';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
  type GenerateCouncilPersonaTurnCommand,
} from '../../lib/application/use-cases/council-chat';
import { makeCouncilChatRepositoryFromSqlExecutor } from '../../lib/infrastructure/db';
import { makeCouncilChatGatewayFromExecutor } from '../../lib/infrastructure/llm';
import {
  createCouncilSettingsStore,
  makeCouncilChatSettingsService,
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
  model: string;
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
  model: z.string(),
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

const generateCouncilPersonaTurnWithGemini = async (
  command: GenerateCouncilPersonaTurnCommand
): Promise<string> => {
  const genAI = new GoogleGenerativeAI(command.apiKey);

  const model = genAI.getGenerativeModel({
    model: command.modelId,
    systemInstruction: command.enhancedSystemPrompt,
  });

  const chat = model.startChat({
    history: command.chatHistory.map((historyMessage) => ({
      role: historyMessage.role,
      parts: historyMessage.parts.map((part) => ({ text: part.text })),
    })),
    generationConfig: {
      temperature: command.temperature,
      maxOutputTokens: command.maxOutputTokens,
    },
  });

  const result = await chat.sendMessage(command.turnPrompt);
  return result.response.text();
};

export function setupLLMHandlers(): void {
  const repository = makeCouncilChatRepositoryFromSqlExecutor(makeElectronSqlQueryExecutor());
  const gateway = makeCouncilChatGatewayFromExecutor(generateCouncilPersonaTurnWithGemini);
  const settingsStore = createCouncilSettingsStore<{ apiKey: string }>(app.isPackaged);
  const settings = makeCouncilChatSettingsService(decrypt, settingsStore);

  ipcMain.handle('llm:chat', async (_, request: ChatRequest) => {
    try {
      const outcome = await Effect.runPromise(
        executeGenerateCouncilPersonaTurn({
          request: {
            personaId: request.personaId,
            sessionId: request.sessionId,
            model: request.model,
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
            model: request.model,
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
          model: request.model,
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
        model: request.model,
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
