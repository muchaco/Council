import { Either } from 'effect';

import type { ConductorControlMode } from '../../domain/conductor';
import type { ConductorSelectedPersonaNotFoundError } from '../../errors/conductor-error';
import type { NextActionPlan } from '../../plan/conductor-plan';

export interface DecideNextActionInput {
  readonly selectedPersonaId: string | 'WAIT_FOR_USER';
  readonly reasoning: string;
  readonly isIntervention: boolean;
  readonly knownPersonaIds: readonly string[];
  readonly controlMode: ConductorControlMode;
}

const normalizePersonaId = (id: string): string => id.trim().toLowerCase();

export const decideNextAction = (
  input: DecideNextActionInput
): Either.Either<NextActionPlan, ConductorSelectedPersonaNotFoundError> => {
  const normalizedSelectedId = normalizePersonaId(input.selectedPersonaId);

  if (normalizedSelectedId === 'wait_for_user') {
    return Either.right({
      _tag: 'WaitForUser',
      reasoning: input.reasoning,
    });
  }

  const normalizedKnownIds = input.knownPersonaIds.map(normalizePersonaId);
  if (!normalizedKnownIds.includes(normalizedSelectedId)) {
    return Either.left({
      _tag: 'ConductorSelectedPersonaNotFoundError',
      message: `Selected persona ${input.selectedPersonaId} not found`,
    });
  }

  if (input.controlMode === 'manual') {
    return Either.right({
      _tag: 'SuggestPersonaAndWaitForUser',
      personaId: input.selectedPersonaId,
      reasoning: input.reasoning,
      isIntervention: input.isIntervention,
    });
  }

  return Either.right({
    _tag: 'TriggerPersona',
    personaId: input.selectedPersonaId,
    reasoning: input.reasoning,
    isIntervention: input.isIntervention,
  });
};
