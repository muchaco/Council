import { Effect, Either } from 'effect';

import { IdGenerator } from '../../runtime';
import { type ConductorBlackboard, type AutoReplySafetyPolicy } from '../../../core/domain/conductor';
import {
  decideConductorParticipantPreconditions,
  decideConductorSelectorPlan,
  decideConductorTurnOutcomePlan,
  decideConductorTurnPreflight,
  prepareConductorSelectorPrompt,
} from '../../../core/decision/conductor';
import type { ConductorDomainError } from '../../../core/errors/conductor-error';
import {
  ConductorSettings,
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
  ConductorTurnRepository | ConductorSelectorGateway | ConductorSettings | IdGenerator
> =>
  Effect.gen(function* () {
    const repository = yield* ConductorTurnRepository;
    const selectorGateway = yield* ConductorSelectorGateway;
    const settings = yield* ConductorSettings;
    const idGenerator = yield* IdGenerator;

    const session = yield* repository.getSession(input.sessionId);
    const preflightDecision = decideConductorTurnPreflight(session, input.autoReplySafetyPolicy);
    if (Either.isLeft(preflightDecision)) {
      return yield* Effect.fail(preflightDecision.left);
    }

    const preflightPlan = preflightDecision.right;
    if (preflightPlan._tag === 'StopForCircuitBreaker') {
      return {
        _tag: 'CircuitBreakerStopped',
        message: preflightPlan.message,
      };
    }

    const precheckPersonas = yield* repository.getSessionPersonas(input.sessionId);
    const participantPrecheckDecision = decideConductorParticipantPreconditions(
      precheckPersonas,
      preflightPlan.conductorPersonaId
    );
    if (Either.isLeft(participantPrecheckDecision)) {
      return yield* Effect.fail(participantPrecheckDecision.left);
    }

    yield* repository.decrementAllHushTurns(input.sessionId);
    const personas = yield* repository.getSessionPersonas(input.sessionId);
    const messages = yield* repository.getLastMessages(input.sessionId, input.recentMessageLimit ?? 10);

    const selectorPlanDecision = decideConductorSelectorPlan({
      session: preflightPlan.session,
      personas,
      messages,
      conductorPersonaId: preflightPlan.conductorPersonaId,
    });

    if (Either.isLeft(selectorPlanDecision)) {
      return yield* Effect.fail(selectorPlanDecision.left);
    }

    const selectorPlan = selectorPlanDecision.right;
    if (selectorPlan._tag === 'WaitForUserBeforeSelection') {
      return {
        _tag: 'WaitForUser',
        reasoning: selectorPlan.reasoning,
        blackboardUpdate: {},
      };
    }

    const geminiApiKey = yield* settings.getGeminiApiKey;
    const selectorGenerationPolicy = yield* settings.getSelectorGenerationPolicy;

    const selectorResult = yield* selectorGateway.selectNextSpeaker({
      apiKey: geminiApiKey,
      selectorModel: selectorPlan.selectorModel,
      selectorPrompt: prepareConductorSelectorPrompt(selectorPlan.selectorPromptInput),
      temperature: selectorGenerationPolicy.temperature,
      maxOutputTokens: selectorGenerationPolicy.maxOutputTokens,
    });

    const outcomePlanDecision = decideConductorTurnOutcomePlan({
      currentBlackboard: selectorPlan.currentBlackboard,
      selectorResult,
      knownPersonaIds: personas.map((persona) => persona.id),
    });

    if (Either.isLeft(outcomePlanDecision)) {
      return yield* Effect.fail(outcomePlanDecision.left);
    }

    const outcomePlan = outcomePlanDecision.right;

    for (const followUpEffect of outcomePlan.followUpEffects) {
      switch (followUpEffect._tag) {
        case 'MergeBlackboard': {
          yield* repository.updateBlackboard(input.sessionId, followUpEffect.nextBlackboard);
          break;
        }
        case 'RecordInterventionMessage': {
          const messageId = yield* idGenerator.generate;
          const turnNumber = yield* repository.getNextTurnNumber(input.sessionId);
          yield* repository.createInterventionMessage({
            messageId,
            sessionId: input.sessionId,
            personaId: selectorPlan.conductorPersonaId,
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

    if (outcomePlan._tag === 'WaitForUserAfterSelection') {
      return {
        _tag: 'WaitForUser',
        reasoning: outcomePlan.reasoning,
        blackboardUpdate: outcomePlan.blackboardUpdate,
      };
    }

    const autoReplyCount = yield* repository.incrementAutoReplyCount(input.sessionId);

    return {
      _tag: 'TriggerPersona',
      personaId: outcomePlan.personaId,
      reasoning: outcomePlan.reasoning,
      blackboardUpdate: outcomePlan.blackboardUpdate,
      isIntervention: outcomePlan.isIntervention,
      autoReplyCount,
      warning: preflightPlan.warning,
    };
  });
