import { Effect } from 'effect';

import {
  SessionParticipationRepository,
  type SessionParticipantProfile,
  type SessionParticipationInfrastructureError,
} from './session-participation-dependencies';
import { mapPersistedSessionParticipantRowToSessionPersona } from './session-participation-mapper';

export const executeLoadSessionParticipants = (
  sessionId: string
): Effect.Effect<
  SessionParticipantProfile[],
  SessionParticipationInfrastructureError,
  SessionParticipationRepository
> =>
  Effect.gen(function* () {
    const repository = yield* SessionParticipationRepository;
    const persistedParticipants = yield* repository.listSessionParticipants(sessionId);
    return persistedParticipants.map(mapPersistedSessionParticipantRowToSessionPersona);
  });

const nowIso = (): string => new Date().toISOString();

export const executeAddSessionParticipant = (
  sessionId: string,
  personaId: string,
  isOrchestrator = false
): Effect.Effect<void, SessionParticipationInfrastructureError, SessionParticipationRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionParticipationRepository;
    yield* repository.addSessionParticipant(sessionId, personaId, isOrchestrator);
  });

export const executeSetSessionParticipantHush = (
  sessionId: string,
  personaId: string,
  turns: number
): Effect.Effect<void, SessionParticipationInfrastructureError, SessionParticipationRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionParticipationRepository;
    yield* repository.setParticipantHush({
      sessionId,
      personaId,
      turns,
      hushedAt: nowIso(),
    });
  });

export const executeDecrementSessionParticipantHush = (
  sessionId: string,
  personaId: string
): Effect.Effect<number, SessionParticipationInfrastructureError, SessionParticipationRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionParticipationRepository;
    yield* repository.decrementParticipantHush(sessionId, personaId);
    return yield* repository.readParticipantHushTurns(sessionId, personaId);
  });

export const executeClearSessionParticipantHush = (
  sessionId: string,
  personaId: string
): Effect.Effect<void, SessionParticipationInfrastructureError, SessionParticipationRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionParticipationRepository;
    yield* repository.clearParticipantHush(sessionId, personaId);
  });

export const executeDecrementAllSessionParticipantHushTurns = (
  sessionId: string
): Effect.Effect<void, SessionParticipationInfrastructureError, SessionParticipationRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionParticipationRepository;
    yield* repository.decrementAllParticipantHushTurns(sessionId);
  });

export const executeLoadHushedSessionParticipantIds = (
  sessionId: string
): Effect.Effect<readonly string[], SessionParticipationInfrastructureError, SessionParticipationRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionParticipationRepository;
    return yield* repository.listHushedParticipantIds(sessionId);
  });

export const executeRemoveSessionParticipant = (
  sessionId: string,
  personaId: string
): Effect.Effect<void, SessionParticipationInfrastructureError, SessionParticipationRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionParticipationRepository;
    yield* repository.removeSessionParticipant(sessionId, personaId);
  });
