import { Context, Effect } from 'effect';

import type {
  ConductorBlackboard,
  ConductorMessageSnapshot,
  ConductorPersonaSnapshot,
  ConductorSessionSnapshot,
  EligibleSpeaker,
  MutedSpeaker,
} from '../../../core/domain/conductor';

export interface ConductorInfrastructureError {
  readonly _tag: 'ConductorInfrastructureError';
  readonly source: 'repository' | 'selector';
  readonly message: string;
}

export interface SelectNextSpeakerRequest {
  readonly sessionId: string;
  readonly selectorModel: string;
  readonly recentMessages: ReadonlyArray<{
    readonly role: 'user' | 'model';
    readonly content: string;
    readonly personaName: string;
  }>;
  readonly blackboard: ConductorBlackboard;
  readonly availablePersonas: readonly EligibleSpeaker[];
  readonly hushedPersonas: readonly MutedSpeaker[];
  readonly problemDescription: string;
  readonly outputGoal: string;
  readonly lastSpeakerId: string | null;
}

export interface SelectNextSpeakerResponse {
  readonly selectedPersonaId: string | 'WAIT_FOR_USER';
  readonly reasoning: string;
  readonly isIntervention: boolean;
  readonly interventionMessage?: string;
  readonly updateBlackboard: Partial<ConductorBlackboard>;
}

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
    readonly sessionId: string;
    readonly personaId: string;
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

export class ConductorTurnRepository extends Context.Tag('ConductorTurnRepository')<
  ConductorTurnRepository,
  ConductorTurnRepositoryService
>() {}

export class ConductorSelectorGateway extends Context.Tag('ConductorSelectorGateway')<
  ConductorSelectorGateway,
  ConductorSelectorGatewayService
>() {}
