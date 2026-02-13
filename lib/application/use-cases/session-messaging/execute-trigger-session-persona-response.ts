import { Effect } from 'effect';

import { decideSessionUsageUpdate } from '../../../core/decision/decide-session-usage-update';
import type { BlackboardState, Message, Persona, Session } from '../../../types';
import {
  SessionMessagePersistence,
  SessionPersonaResponseGateway,
  type SessionMessagingInfrastructureError,
} from './session-messaging-dependencies';

export interface SessionPersonaProfile extends Persona {
  readonly isConductor: boolean;
  readonly hushTurnsRemaining: number;
  readonly hushedAt: string | null;
}

export interface ExecuteTriggerSessionPersonaResponseInput {
  readonly session: Session;
  readonly persona: SessionPersonaProfile;
  readonly otherPersonas: readonly {
    readonly id: string;
    readonly name: string;
    readonly role: string;
  }[];
  readonly blackboard: BlackboardState;
  readonly providerId: string;
  readonly apiKey: string;
}

export interface ExecuteTriggerSessionPersonaResponseResult {
  readonly createdMessage: Message;
  readonly updatedSession: Session;
}

export const executeTriggerSessionPersonaResponse = (
  input: ExecuteTriggerSessionPersonaResponseInput
): Effect.Effect<
  ExecuteTriggerSessionPersonaResponseResult,
  SessionMessagingInfrastructureError,
  SessionPersonaResponseGateway | SessionMessagePersistence
> =>
  Effect.gen(function* () {
    const responseGateway = yield* SessionPersonaResponseGateway;
    const messagePersistence = yield* SessionMessagePersistence;

    const generatedResponse = yield* responseGateway.generatePersonaResponse({
      personaId: input.persona.id,
      sessionId: input.session.id,
      providerId: input.providerId,
      modelId: input.persona.geminiModel,
      apiKey: input.apiKey,
      systemPrompt: input.persona.systemPrompt,
      hiddenAgenda: input.persona.hiddenAgenda,
      verbosity: input.persona.verbosity,
      temperature: input.persona.temperature,
      problemContext: input.session.problemDescription,
      outputGoal: input.session.outputGoal,
      blackboard: input.blackboard,
      otherPersonas: input.otherPersonas,
    });

    const turnNumber = yield* messagePersistence.getNextTurnNumber(input.session.id);

    const createdMessage = yield* messagePersistence.createMessage({
      sessionId: input.session.id,
      personaId: input.persona.id,
      source: 'persona',
      content: generatedResponse.content,
      turnNumber,
      tokenCount: generatedResponse.tokenCount,
    });

    const usagePlan = decideSessionUsageUpdate(
      { tokenCount: input.session.tokenCount },
      { tokenCount: generatedResponse.tokenCount }
    );

    const updatedSession = yield* messagePersistence.updateSessionUsage(
      input.session.id,
      usagePlan.nextTokenCount,
      usagePlan.nextCostEstimate
    );

    return {
      createdMessage,
      updatedSession,
    };
  });
