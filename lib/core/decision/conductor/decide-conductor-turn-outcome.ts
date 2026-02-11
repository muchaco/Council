import { Either } from 'effect';

import type {
  ConductorBlackboard,
  ConductorSelectorDecision,
} from '../../domain/conductor';
import type { ConductorDomainError } from '../../errors/conductor-error';
import type {
  ConductorTurnOutcomePlan,
  NextActionPlan,
} from '../../plan/conductor-plan';
import { decideNextAction } from './decide-next-action';
import { decideSelectorFollowUpEffects } from './decide-selector-follow-up-effects';

export interface DecideConductorTurnOutcomePlanInput {
  readonly currentBlackboard: ConductorBlackboard;
  readonly selectorResult: ConductorSelectorDecision;
  readonly knownPersonaIds: readonly string[];
}

export const decideConductorTurnOutcomePlan = (
  input: DecideConductorTurnOutcomePlanInput
): Either.Either<ConductorTurnOutcomePlan, ConductorDomainError> => {
  const followUpEffects = decideSelectorFollowUpEffects({
    currentBlackboard: input.currentBlackboard,
    updateBlackboard: input.selectorResult.updateBlackboard,
    isIntervention: input.selectorResult.isIntervention,
    interventionMessage: input.selectorResult.interventionMessage,
    selectorReasoning: input.selectorResult.reasoning,
  });

  const nextActionDecision = decideNextAction({
    selectedPersonaId: input.selectorResult.selectedPersonaId,
    reasoning: input.selectorResult.reasoning,
    isIntervention: input.selectorResult.isIntervention,
    knownPersonaIds: input.knownPersonaIds,
  });

  if (Either.isLeft(nextActionDecision)) {
    return Either.left(nextActionDecision.left);
  }

  const nextAction: NextActionPlan = nextActionDecision.right;
  if (nextAction._tag === 'WaitForUser') {
    return Either.right({
      _tag: 'WaitForUserAfterSelection',
      reasoning: nextAction.reasoning,
      blackboardUpdate: input.selectorResult.updateBlackboard,
      followUpEffects,
    });
  }

  return Either.right({
    _tag: 'TriggerPersonaAfterSelection',
    personaId: nextAction.personaId,
    reasoning: nextAction.reasoning,
    isIntervention: nextAction.isIntervention,
    blackboardUpdate: input.selectorResult.updateBlackboard,
    followUpEffects,
  });
};
