import { Context, Effect } from 'effect';

import type { BlackboardState, Message, Session } from '../../../types';

export interface TriggerSessionPersonaResponseRequest {
  readonly personaId: string;
  readonly sessionId: string;
  readonly model: string;
  readonly systemPrompt: string;
  readonly hiddenAgenda?: string;
  readonly verbosity?: string;
  readonly temperature: number;
  readonly problemContext: string;
  readonly outputGoal: string;
  readonly blackboard: BlackboardState;
  readonly otherPersonas: readonly {
    readonly id: string;
    readonly name: string;
    readonly role: string;
  }[];
}

export interface CreateSessionMessageCommand {
  readonly sessionId: string;
  readonly personaId: string | null;
  readonly content: string;
  readonly turnNumber: number;
  readonly tokenCount: number;
}

export interface SessionMessagingInfrastructureError {
  readonly _tag: 'SessionMessagingInfrastructureError';
  readonly source: 'llmGateway' | 'messagePersistence' | 'sessionState';
  readonly message: string;
}

export interface SessionPersonaResponseGatewayService {
  readonly generatePersonaResponse: (
    request: TriggerSessionPersonaResponseRequest
  ) => Effect.Effect<{ readonly content: string; readonly tokenCount: number }, SessionMessagingInfrastructureError>;
}

export interface SessionMessagePersistenceService {
  readonly getNextTurnNumber: (
    sessionId: string
  ) => Effect.Effect<number, SessionMessagingInfrastructureError>;
  readonly createMessage: (
    command: CreateSessionMessageCommand
  ) => Effect.Effect<Message, SessionMessagingInfrastructureError>;
  readonly updateSessionUsage: (
    sessionId: string,
    tokenCount: number,
    costEstimate: number
  ) => Effect.Effect<Session, SessionMessagingInfrastructureError>;
}

export class SessionPersonaResponseGateway extends Context.Tag('SessionPersonaResponseGateway')<
  SessionPersonaResponseGateway,
  SessionPersonaResponseGatewayService
>() {}

export class SessionMessagePersistence extends Context.Tag('SessionMessagePersistence')<
  SessionMessagePersistence,
  SessionMessagePersistenceService
>() {}
