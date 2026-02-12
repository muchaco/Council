import { Either } from 'effect';

import type { ConductorSessionSnapshot } from '../../domain/conductor';
import type { ConductorDomainError } from '../../errors/conductor-error';

export interface ConductorSessionPreconditions {
  readonly session: ConductorSessionSnapshot;
}

export const decideConductorSessionPreconditions = (
  session: ConductorSessionSnapshot | null
): Either.Either<ConductorSessionPreconditions, ConductorDomainError> => {
  if (session === null) {
    return Either.left({
      _tag: 'ConductorSessionNotFoundError',
      message: 'Session not found',
    });
  }

  if (!session.conductorEnabled) {
    return Either.left({
      _tag: 'ConductorNotEnabledError',
      message: 'Conductor not enabled for this session',
    });
  }

  if (session.controlMode !== 'automatic' && session.controlMode !== 'manual') {
    return Either.left({
      _tag: 'ConductorInvalidControlModeError',
      message: `Unsupported conductor control mode: ${String(session.controlMode)}`,
    });
  }

  return Either.right({
    session,
  });
};
