import { Effect, Either } from 'effect';

import type { CouncilChatRequest } from '../../../core/domain/council-chat';
import { prepareCouncilPersonaTurnPrompt } from '../../../core/decision/council-chat';
import type { CouncilChatDomainError } from '../../../core/errors/council-chat-error';
import { LlmSettings } from '../../../infrastructure/settings/llm-settings';
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
  CouncilChatRepository | CouncilChatGateway | CouncilChatSettings | LlmSettings
> =>
  Effect.gen(function* () {
    const repository = yield* CouncilChatRepository;
    const gateway = yield* CouncilChatGateway;
    const settings = yield* CouncilChatSettings;
    const llmSettings = yield* LlmSettings;

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

    // Resolve provider from persona or settings fallback
    const providerId = input.request.providerId ?? (yield* llmSettings.getDefaultProvider());
    const apiKey = yield* llmSettings.getApiKey(providerId);
    const modelId = input.request.modelId ?? (yield* llmSettings.getDefaultModel(providerId));

    const generatedContent = yield* gateway.generateCouncilPersonaTurn({
      providerId,
      modelId,
      apiKey,
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
