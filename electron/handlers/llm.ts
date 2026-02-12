import { app, ipcMain as electronIpcMain } from 'electron';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Effect, Either } from 'effect';

import { decrypt } from './settings.js';
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
import { registerPrivilegedIpcHandle } from '../lib/security/privileged-ipc.js';

const ipcMain = {
  handle: (channelName: string, handler: (...args: any[]) => unknown): void => {
    registerPrivilegedIpcHandle(electronIpcMain, channelName, handler as any);
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

const mapErrorToMessage = (error: CouncilChatUseCaseError): string => error.message;

const generateCouncilPersonaTurnWithGemini = async (
  command: GenerateCouncilPersonaTurnCommand
): Promise<string> => {
  const genAI = new GoogleGenerativeAI(command.apiKey);

  const model = genAI.getGenerativeModel({
    model: command.model,
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
        return {
          success: false,
          error: mapErrorToMessage(outcome.left),
        };
      }

      return {
        success: true,
        data: {
          content: outcome.right.content,
          tokenCount: outcome.right.tokenCount,
        },
      };
    } catch (error) {
      console.error('Error in LLM chat:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });
}
