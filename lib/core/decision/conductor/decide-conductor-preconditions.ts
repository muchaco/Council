import { Either } from 'effect';

import type {
  ConductorPersonaSnapshot,
  ConductorSessionSnapshot,
} from '../../domain/conductor';
import type { ConductorDomainError } from '../../errors/conductor-error';

export interface ConductorSessionPreconditions {
  readonly session: ConductorSessionSnapshot;
  readonly conductorPersonaId: string;
}

export interface ConductorParticipantPreconditions {
  readonly conductorPersona: ConductorPersonaSnapshot;
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

  if (!session.conductorEnabled || !session.conductorPersonaId) {
    return Either.left({
      _tag: 'ConductorNotEnabledError',
      message: 'Conductor not enabled for this session',
    });
  }

  return Either.right({
    session,
    conductorPersonaId: session.conductorPersonaId,
  });
};

export const decideConductorParticipantPreconditions = (
  personas: readonly ConductorPersonaSnapshot[],
  conductorPersonaId: string
): Either.Either<ConductorParticipantPreconditions, ConductorDomainError> => {
  if (personas.length === 0) {
    return Either.left({
      _tag: 'ConductorNoPersonasError',
      message: 'No personas in session',
    });
  }

  const conductorPersona = personas.find((persona) => persona.id === conductorPersonaId);
  if (!conductorPersona) {
    return Either.left({
      _tag: 'ConductorPersonaMissingError',
      message: 'Conductor persona not found',
    });
  }

  return Either.right({ conductorPersona });
};
