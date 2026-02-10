import { Context, Effect } from 'effect';

import type {
  CouncilChatMessageSnapshot,
  CouncilChatPersonaSnapshot,
  CouncilGatewayHistoryMessage,
} from '../../../core/domain/council-chat';

export type CouncilChatInfrastructureError =
  | {
      readonly _tag: 'CouncilChatInfrastructureError';
      readonly source: 'repository';
      readonly code: 'QueryFailed';
      readonly message: string;
    }
  | {
      readonly _tag: 'CouncilChatInfrastructureError';
      readonly source: 'settings';
      readonly code: 'ApiKeyMissing' | 'ApiKeyDecryptFailed' | 'SettingsReadFailed';
      readonly message: string;
    }
  | {
      readonly _tag: 'CouncilChatInfrastructureError';
      readonly source: 'llmGateway';
      readonly code:
        | 'AuthenticationFailed'
        | 'ModelNotFound'
        | 'RateLimited'
        | 'Timeout'
        | 'NetworkError'
        | 'Unknown';
      readonly message: string;
    };

export interface CouncilChatGenerationPolicy {
  readonly maxOutputTokens: number;
  readonly defaultHistoryLimit: number;
}

export interface GenerateCouncilPersonaTurnCommand {
  readonly apiKey: string;
  readonly model: string;
  readonly temperature: number;
  readonly maxOutputTokens: number;
  readonly enhancedSystemPrompt: string;
  readonly chatHistory: readonly CouncilGatewayHistoryMessage[];
  readonly turnPrompt: string;
}

export interface CouncilChatRepositoryService {
  readonly getSessionPersonas: (
    sessionId: string
  ) => Effect.Effect<readonly CouncilChatPersonaSnapshot[], CouncilChatInfrastructureError>;
  readonly getRecentMessages: (
    sessionId: string,
    limit: number
  ) => Effect.Effect<readonly CouncilChatMessageSnapshot[], CouncilChatInfrastructureError>;
}

export interface CouncilChatGatewayService {
  readonly generateCouncilPersonaTurn: (
    command: GenerateCouncilPersonaTurnCommand
  ) => Effect.Effect<string, CouncilChatInfrastructureError>;
}

export interface CouncilChatSettingsService {
  readonly getGeminiApiKey: Effect.Effect<string, CouncilChatInfrastructureError>;
  readonly getGenerationPolicy: Effect.Effect<CouncilChatGenerationPolicy, CouncilChatInfrastructureError>;
}

export class CouncilChatRepository extends Context.Tag('CouncilChatRepository')<
  CouncilChatRepository,
  CouncilChatRepositoryService
>() {}

export class CouncilChatGateway extends Context.Tag('CouncilChatGateway')<
  CouncilChatGateway,
  CouncilChatGatewayService
>() {}

export class CouncilChatSettings extends Context.Tag('CouncilChatSettings')<
  CouncilChatSettings,
  CouncilChatSettingsService
>() {}
