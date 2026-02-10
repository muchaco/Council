import { Effect, Either, Option } from 'effect';

import {
  emptyConductorBlackboard,
  findLastSpeakerId,
  toSelectorConversationMessages,
  type ConductorBlackboard,
  type AutoReplySafetyPolicy,
} from '../../../core/domain/conductor';
import {
  decideCircuitBreaker,
  decideConductorParticipantPreconditions,
  decideConductorSessionPreconditions,
  decideNextAction,
  decideSelectorFollowUpEffects,
  decideSpeakerEligibility,
  decideWaitForUser,
} from '../../../core/decision/conductor';
import type { ConductorDomainError } from '../../../core/errors/conductor-error';
import {
  ConductorSelectorGateway,
  ConductorTurnRepository,
  type ConductorInfrastructureError,
} from './conductor-dependencies';

export interface ExecuteConductorTurnInput {
  readonly sessionId: string;
  readonly recentMessageLimit?: number;
  readonly autoReplySafetyPolicy?: AutoReplySafetyPolicy;
}

export interface ExecuteConductorTurnCircuitBreakerStopped {
  readonly _tag: 'CircuitBreakerStopped';
  readonly message: string;
}

export interface ExecuteConductorTurnWaitForUser {
  readonly _tag: 'WaitForUser';
  readonly reasoning: string;
  readonly blackboardUpdate: Partial<ConductorBlackboard>;
}

export interface ExecuteConductorTurnTriggerPersona {
  readonly _tag: 'TriggerPersona';
  readonly personaId: string;
  readonly reasoning: string;
  readonly blackboardUpdate: Partial<ConductorBlackboard>;
  readonly isIntervention: boolean;
  readonly autoReplyCount: number;
  readonly warning?: string;
}

export type ExecuteConductorTurnResult =
  | ExecuteConductorTurnCircuitBreakerStopped
  | ExecuteConductorTurnWaitForUser
  | ExecuteConductorTurnTriggerPersona;

export type ConductorTurnUseCaseError = ConductorDomainError | ConductorInfrastructureError;

export const executeConductorTurn = (
  input: ExecuteConductorTurnInput
): Effect.Effect<
  ExecuteConductorTurnResult,
  ConductorTurnUseCaseError,
  ConductorTurnRepository | ConductorSelectorGateway
> =>
  Effect.gen(function* () {
    const repository = yield* ConductorTurnRepository;
    const selectorGateway = yield* ConductorSelectorGateway;

    const sessionDecision = decideConductorSessionPreconditions(
      yield* repository.getSession(input.sessionId)
    );
    if (Either.isLeft(sessionDecision)) {
      return yield* Effect.fail(sessionDecision.left);
    }

    const { session, orchestratorPersonaId } = sessionDecision.right;

    const circuitBreakerDecision = decideCircuitBreaker(session, input.autoReplySafetyPolicy);
    if (circuitBreakerDecision._tag === 'PauseForUserConfirmation') {
      return {
        _tag: 'CircuitBreakerStopped',
        message: circuitBreakerDecision.message,
      };
    }

    yield* repository.decrementAllHushTurns(input.sessionId);
    const personas = yield* repository.getSessionPersonas(input.sessionId);

    const participantsDecision = decideConductorParticipantPreconditions(
      personas,
      orchestratorPersonaId
    );
    if (Either.isLeft(participantsDecision)) {
      return yield* Effect.fail(participantsDecision.left);
    }
    const { orchestratorPersona } = participantsDecision.right;

    const messages = yield* repository.getLastMessages(input.sessionId, input.recentMessageLimit ?? 10);
    const lastSpeakerId = findLastSpeakerId(messages);

    const speakerEligibility = decideSpeakerEligibility({
      personas,
      orchestratorPersonaId,
      lastSpeakerId,
    });

    const waitForUser = decideWaitForUser(speakerEligibility);
    if (Option.isSome(waitForUser)) {
      return {
        _tag: 'WaitForUser',
        reasoning: waitForUser.value.reasoning,
        blackboardUpdate: {},
      };
    }

    const blackboard = session.blackboard ?? emptyConductorBlackboard;

    const selectorResult = yield* selectorGateway.selectNextSpeaker({
      sessionId: input.sessionId,
      selectorModel: orchestratorPersona.geminiModel,
      recentMessages: toSelectorConversationMessages(messages, personas),
      blackboard,
      availablePersonas: speakerEligibility.eligibleSpeakers,
      hushedPersonas: speakerEligibility.mutedSpeakers,
      problemDescription: session.problemDescription,
      outputGoal: session.outputGoal,
      lastSpeakerId,
    });

    const followUpEffects = decideSelectorFollowUpEffects({
      currentBlackboard: blackboard,
      updateBlackboard: selectorResult.updateBlackboard,
      isIntervention: selectorResult.isIntervention,
      interventionMessage: selectorResult.interventionMessage,
      selectorReasoning: selectorResult.reasoning,
    });

    for (const followUpEffect of followUpEffects) {
      switch (followUpEffect._tag) {
        case 'MergeBlackboard': {
          yield* repository.updateBlackboard(input.sessionId, followUpEffect.nextBlackboard);
          break;
        }
        case 'RecordInterventionMessage': {
          const turnNumber = yield* repository.getNextTurnNumber(input.sessionId);
          yield* repository.createInterventionMessage({
            sessionId: input.sessionId,
            personaId: orchestratorPersona.id,
            content: followUpEffect.messageContent,
            turnNumber,
            selectorReasoning: followUpEffect.selectorReasoning,
          });
          break;
        }
        default: {
          const _exhaustive: never = followUpEffect;
          return _exhaustive;
        }
      }
    }

    const nextActionDecision = decideNextAction({
      selectedPersonaId: selectorResult.selectedPersonaId,
      reasoning: selectorResult.reasoning,
      isIntervention: selectorResult.isIntervention,
      knownPersonaIds: personas.map((persona) => persona.id),
    });

    if (Either.isLeft(nextActionDecision)) {
      return yield* Effect.fail(nextActionDecision.left);
    }

    const nextAction = nextActionDecision.right;
    if (nextAction._tag === 'WaitForUser') {
      return {
        _tag: 'WaitForUser',
        reasoning: nextAction.reasoning,
        blackboardUpdate: selectorResult.updateBlackboard,
      };
    }

    const autoReplyCount = yield* repository.incrementAutoReplyCount(input.sessionId);

    return {
      _tag: 'TriggerPersona',
      personaId: nextAction.personaId,
      reasoning: nextAction.reasoning,
      blackboardUpdate: selectorResult.updateBlackboard,
      isIntervention: nextAction.isIntervention,
      autoReplyCount,
      warning:
        circuitBreakerDecision._tag === 'ContinueWithBudgetWarning'
          ? circuitBreakerDecision.warning
          : undefined,
    };
  });
