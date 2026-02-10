import { Either } from 'effect';

import type {
  ConductorPersonaSnapshot,
  ConductorSessionSnapshot,
} from '../../domain/conductor';
import type { ConductorDomainError } from '../../errors/conductor-error';

export interface ConductorSessionPreconditions {
  readonly session: ConductorSessionSnapshot;
  readonly orchestratorPersonaId: string;
}

export interface ConductorParticipantPreconditions {
  readonly orchestratorPersona: ConductorPersonaSnapshot;
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

  if (!session.orchestratorEnabled || !session.orchestratorPersonaId) {
    return Either.left({
      _tag: 'ConductorNotEnabledError',
      message: 'Orchestrator not enabled for this session',
    });
  }

  return Either.right({
    session,
    orchestratorPersonaId: session.orchestratorPersonaId,
  });
};

export const decideConductorParticipantPreconditions = (
  personas: readonly ConductorPersonaSnapshot[],
  orchestratorPersonaId: string
): Either.Either<ConductorParticipantPreconditions, ConductorDomainError> => {
  if (personas.length === 0) {
    return Either.left({
      _tag: 'ConductorNoPersonasError',
      message: 'No personas in session',
    });
  }

  const orchestratorPersona = personas.find((persona) => persona.id === orchestratorPersonaId);
  if (!orchestratorPersona) {
    return Either.left({
      _tag: 'ConductorPersonaMissingError',
      message: 'Orchestrator persona not found',
    });
  }

  return Either.right({ orchestratorPersona });
};
