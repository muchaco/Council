import { Either, Option } from 'effect';

import {
  emptyConductorBlackboard,
  findLastSpeakerId,
  toSelectorConversationMessages,
  type ConductorMessageSnapshot,
  type ConductorPersonaSnapshot,
  type ConductorSessionSnapshot,
} from '../../domain/conductor';
import type { ConductorDomainError } from '../../errors/conductor-error';
import type { ConductorSelectorPlan } from '../../plan/conductor-plan';
import { decideSpeakerEligibility } from './decide-speaker-eligibility';
import { decideWaitForUser } from './decide-wait-for-user';

export interface DecideConductorSelectorPlanInput {
  readonly session: ConductorSessionSnapshot;
  readonly personas: readonly ConductorPersonaSnapshot[];
  readonly messages: readonly ConductorMessageSnapshot[];
  readonly selectorModel: string;
}

export const decideConductorSelectorPlan = (
  input: DecideConductorSelectorPlanInput
): Either.Either<ConductorSelectorPlan, ConductorDomainError> => {
  if (input.personas.length === 0) {
    return Either.left({
      _tag: 'ConductorNoPersonasError',
      message: 'No personas in session',
    });
  }

  const lastSpeakerId = findLastSpeakerId(input.messages);

  const speakerEligibility = decideSpeakerEligibility({
    personas: input.personas,
    lastSpeakerId,
  });

  const waitForUser = decideWaitForUser(speakerEligibility);
  if (Option.isSome(waitForUser)) {
    return Either.right({
      _tag: 'WaitForUserBeforeSelection',
      reasoning: waitForUser.value.reasoning,
    });
  }

  const currentBlackboard = input.session.blackboard ?? emptyConductorBlackboard;
  const selectorPromptInput = {
    problemDescription: input.session.problemDescription,
    outputGoal: input.session.outputGoal,
    blackboard: currentBlackboard,
    recentConversation: toSelectorConversationMessages(input.messages, input.personas),
    availablePersonas: speakerEligibility.eligibleSpeakers,
    hushedPersonas: speakerEligibility.mutedSpeakers,
    lastSpeakerId,
  };

  return Either.right({
    _tag: 'RequestSelectorDecision',
    selectorModel: input.selectorModel,
    selectorPromptInput,
    currentBlackboard,
  });
};
