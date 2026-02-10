import { Effect, Either } from 'effect';

import type { CouncilChatRequest } from '../../../core/domain/council-chat';
import { prepareCouncilPersonaTurnPrompt } from '../../../core/decision/council-chat';
import type { CouncilChatDomainError } from '../../../core/errors/council-chat-error';
import {
  CouncilChatGateway,
  CouncilChatRepository,
  CouncilChatSettings,
  type CouncilChatInfrastructureError,
} from './council-chat-dependencies';

export interface ExecuteGenerateCouncilPersonaTurnInput {
  readonly request: CouncilChatRequest;
}

export interface ExecuteGenerateCouncilPersonaTurnResult {
  readonly content: string;
  readonly tokenCount: number;
}

export type CouncilChatUseCaseError = CouncilChatDomainError | CouncilChatInfrastructureError;

const estimateTokenCount = (text: string): number => Math.ceil(text.length / 4);

export const executeGenerateCouncilPersonaTurn = (
  input: ExecuteGenerateCouncilPersonaTurnInput
): Effect.Effect<
  ExecuteGenerateCouncilPersonaTurnResult,
  CouncilChatUseCaseError,
  CouncilChatRepository | CouncilChatGateway | CouncilChatSettings
> =>
  Effect.gen(function* () {
    const repository = yield* CouncilChatRepository;
    const gateway = yield* CouncilChatGateway;
    const settings = yield* CouncilChatSettings;

    const geminiApiKey = yield* settings.getGeminiApiKey;
    const generationPolicy = yield* settings.getGenerationPolicy;

    const sessionPersonas = yield* repository.getSessionPersonas(input.request.sessionId);

    const promptPrecheckDecision = prepareCouncilPersonaTurnPrompt(input.request, sessionPersonas, []);
    if (Either.isLeft(promptPrecheckDecision)) {
      return yield* Effect.fail(promptPrecheckDecision.left);
    }

    const recentMessages = yield* repository.getRecentMessages(
      input.request.sessionId,
      generationPolicy.defaultHistoryLimit
    );

    const promptDecision = prepareCouncilPersonaTurnPrompt(
      input.request,
      sessionPersonas,
      recentMessages
    );

    if (Either.isLeft(promptDecision)) {
      return yield* Effect.fail(promptDecision.left);
    }

    const generatedContent = yield* gateway.generateCouncilPersonaTurn({
      apiKey: geminiApiKey,
      model: promptDecision.right.model,
      temperature: promptDecision.right.temperature,
      maxOutputTokens: generationPolicy.maxOutputTokens,
      enhancedSystemPrompt: promptDecision.right.enhancedSystemPrompt,
      chatHistory: promptDecision.right.chatHistory,
      turnPrompt: promptDecision.right.turnPrompt,
    });

    return {
      content: generatedContent,
      tokenCount: estimateTokenCount(generatedContent),
    };
  });
