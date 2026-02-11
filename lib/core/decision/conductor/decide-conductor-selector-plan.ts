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
import { decideConductorParticipantPreconditions } from './decide-conductor-preconditions';
import { decideSpeakerEligibility } from './decide-speaker-eligibility';
import { decideWaitForUser } from './decide-wait-for-user';

export interface DecideConductorSelectorPlanInput {
  readonly session: ConductorSessionSnapshot;
  readonly personas: readonly ConductorPersonaSnapshot[];
  readonly messages: readonly ConductorMessageSnapshot[];
  readonly conductorPersonaId: string;
}

export const decideConductorSelectorPlan = (
  input: DecideConductorSelectorPlanInput
): Either.Either<ConductorSelectorPlan, ConductorDomainError> => {
  const participantPreconditions = decideConductorParticipantPreconditions(
    input.personas,
    input.conductorPersonaId
  );
  if (Either.isLeft(participantPreconditions)) {
    return Either.left(participantPreconditions.left);
  }

  const lastSpeakerId = findLastSpeakerId(input.messages);

  const speakerEligibility = decideSpeakerEligibility({
    personas: input.personas,
    conductorPersonaId: input.conductorPersonaId,
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
    selectorModel: participantPreconditions.right.conductorPersona.geminiModel,
    selectorPromptInput,
    currentBlackboard,
    conductorPersonaId: participantPreconditions.right.conductorPersona.id,
  });
};
