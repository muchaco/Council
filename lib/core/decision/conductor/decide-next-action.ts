import { Either } from 'effect';

import type { ConductorSelectedPersonaNotFoundError } from '../../errors/conductor-error';
import type { NextActionPlan } from '../../plan/conductor-plan';

export interface DecideNextActionInput {
  readonly selectedPersonaId: string | 'WAIT_FOR_USER';
  readonly reasoning: string;
  readonly isIntervention: boolean;
  readonly knownPersonaIds: readonly string[];
}

export const decideNextAction = (
  input: DecideNextActionInput
): Either.Either<NextActionPlan, ConductorSelectedPersonaNotFoundError> => {
  if (input.selectedPersonaId === 'WAIT_FOR_USER') {
    return Either.right({
      _tag: 'WaitForUser',
      reasoning: input.reasoning,
    });
  }

  if (!input.knownPersonaIds.includes(input.selectedPersonaId)) {
    return Either.left({
      _tag: 'ConductorSelectedPersonaNotFoundError',
      message: `Selected persona ${input.selectedPersonaId} not found`,
    });
  }

  return Either.right({
    _tag: 'TriggerPersona',
    personaId: input.selectedPersonaId,
    reasoning: input.reasoning,
    isIntervention: input.isIntervention,
  });
};
