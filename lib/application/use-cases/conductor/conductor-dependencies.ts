import { Context, Effect } from 'effect';

import type {
  ConductorBlackboard,
  ConductorSelectorDecision,
  ConductorMessageSnapshot,
  ConductorPersonaSnapshot,
  ConductorSessionSnapshot,
} from '../../../core/domain/conductor';

export type ConductorInfrastructureError =
  | {
      readonly _tag: 'ConductorInfrastructureError';
      readonly source: 'repository';
      readonly message: string;
    }
  | {
      readonly _tag: 'ConductorInfrastructureError';
      readonly source: 'selector';
      readonly code: 'ExecutionFailed' | 'InvalidSelectorResponse';
      readonly message: string;
    }
  | {
      readonly _tag: 'ConductorInfrastructureError';
      readonly source: 'settings';
      readonly code: 'ApiKeyMissing' | 'ApiKeyDecryptFailed' | 'SettingsReadFailed';
      readonly message: string;
    };

export interface ConductorSelectorGenerationPolicy {
  readonly temperature: number;
  readonly maxOutputTokens: number;
}

export interface SelectNextSpeakerRequest {
  readonly providerId: string;
  readonly modelId: string;
  readonly apiKey: string;
  readonly selectorPrompt: string;
  readonly temperature: number;
  readonly maxOutputTokens: number;
}

export type SelectNextSpeakerResponse = ConductorSelectorDecision;

export interface ConductorTurnRepositoryService {
  readonly getSession: (
    sessionId: string
  ) => Effect.Effect<ConductorSessionSnapshot | null, ConductorInfrastructureError>;
  readonly getSessionPersonas: (
    sessionId: string
  ) => Effect.Effect<readonly ConductorPersonaSnapshot[], ConductorInfrastructureError>;
  readonly decrementAllHushTurns: (sessionId: string) => Effect.Effect<void, ConductorInfrastructureError>;
  readonly getLastMessages: (
    sessionId: string,
    limit: number
  ) => Effect.Effect<readonly ConductorMessageSnapshot[], ConductorInfrastructureError>;
  readonly updateBlackboard: (
    sessionId: string,
    blackboard: ConductorBlackboard
  ) => Effect.Effect<void, ConductorInfrastructureError>;
  readonly getNextTurnNumber: (sessionId: string) => Effect.Effect<number, ConductorInfrastructureError>;
  readonly createInterventionMessage: (input: {
    readonly messageId: string;
    readonly sessionId: string;
    readonly content: string;
    readonly turnNumber: number;
    readonly selectorReasoning: string;
  }) => Effect.Effect<void, ConductorInfrastructureError>;
  readonly incrementAutoReplyCount: (sessionId: string) => Effect.Effect<number, ConductorInfrastructureError>;
}

export interface ConductorSelectorGatewayService {
  readonly selectNextSpeaker: (
    request: SelectNextSpeakerRequest
  ) => Effect.Effect<SelectNextSpeakerResponse, ConductorInfrastructureError>;
}

export interface ConductorSettingsService {
  readonly getGeminiApiKey: Effect.Effect<string, ConductorInfrastructureError>;
  readonly getSelectorModel: Effect.Effect<string, ConductorInfrastructureError>;
  readonly getSelectorGenerationPolicy: Effect.Effect<
    ConductorSelectorGenerationPolicy,
    ConductorInfrastructureError
  >;
}

export class ConductorTurnRepository extends Context.Tag('ConductorTurnRepository')<
  ConductorTurnRepository,
  ConductorTurnRepositoryService
>() {}

export class ConductorSelectorGateway extends Context.Tag('ConductorSelectorGateway')<
  ConductorSelectorGateway,
  ConductorSelectorGatewayService
>() {}

export class ConductorSettings extends Context.Tag('ConductorSettings')<
  ConductorSettings,
  ConductorSettingsService
>() {}
