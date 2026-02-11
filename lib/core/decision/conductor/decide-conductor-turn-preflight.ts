import { Either } from 'effect';

import type {
  AutoReplySafetyPolicy,
  ConductorSessionSnapshot,
} from '../../domain/conductor';
import type { ConductorDomainError } from '../../errors/conductor-error';
import type { ConductorTurnPreflightPlan } from '../../plan/conductor-plan';
import {
  decideConductorSessionPreconditions,
} from './decide-conductor-preconditions';
import { decideCircuitBreaker } from './decide-circuit-breaker';

export const decideConductorTurnPreflight = (
  session: ConductorSessionSnapshot | null,
  autoReplySafetyPolicy?: AutoReplySafetyPolicy
): Either.Either<ConductorTurnPreflightPlan, ConductorDomainError> => {
  const sessionPreconditions = decideConductorSessionPreconditions(session);
  if (Either.isLeft(sessionPreconditions)) {
    return Either.left(sessionPreconditions.left);
  }

  const circuitBreakerDecision = decideCircuitBreaker(
    sessionPreconditions.right.session,
    autoReplySafetyPolicy
  );

  if (circuitBreakerDecision._tag === 'PauseForUserConfirmation') {
    return Either.right({
      _tag: 'StopForCircuitBreaker',
      message: circuitBreakerDecision.message,
    });
  }

  return Either.right({
    _tag: 'ContinueConductorTurn',
    session: sessionPreconditions.right.session,
    conductorPersonaId: sessionPreconditions.right.conductorPersonaId,
    warning:
      circuitBreakerDecision._tag === 'ContinueWithBudgetWarning'
        ? circuitBreakerDecision.warning
        : undefined,
  });
};
