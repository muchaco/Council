import { Context, Effect } from 'effect';

export interface PersistedSessionParticipantRow {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly systemPrompt: string;
  readonly geminiModel: string;
  readonly temperature: number;
  readonly color: string;
  readonly hiddenAgenda: string | undefined;
  readonly verbosity: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly isConductor: number | boolean;
  readonly hushTurnsRemaining: number | null;
  readonly hushedAt: string | null;
}

export interface SessionParticipantProfile {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly systemPrompt: string;
  readonly geminiModel: string;
  readonly temperature: number;
  readonly color: string;
  readonly hiddenAgenda: string | undefined;
  readonly verbosity: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly isConductor: boolean;
  readonly hushTurnsRemaining: number;
  readonly hushedAt: string | null;
}

export interface SessionParticipationInfrastructureError {
  readonly _tag: 'SessionParticipationInfrastructureError';
  readonly source: 'repository';
  readonly message: string;
}

export interface SetParticipantHushCommand {
  readonly sessionId: string;
  readonly personaId: string;
  readonly turns: number;
  readonly hushedAt: string;
}

export interface SessionParticipationRepositoryService {
  readonly addSessionParticipant: (
    sessionId: string,
    personaId: string,
    isConductor: boolean
  ) => Effect.Effect<void, SessionParticipationInfrastructureError>;
  readonly listSessionParticipants: (
    sessionId: string
  ) => Effect.Effect<readonly PersistedSessionParticipantRow[], SessionParticipationInfrastructureError>;
  readonly setParticipantHush: (
    command: SetParticipantHushCommand
  ) => Effect.Effect<void, SessionParticipationInfrastructureError>;
  readonly decrementParticipantHush: (
    sessionId: string,
    personaId: string
  ) => Effect.Effect<void, SessionParticipationInfrastructureError>;
  readonly readParticipantHushTurns: (
    sessionId: string,
    personaId: string
  ) => Effect.Effect<number, SessionParticipationInfrastructureError>;
  readonly clearParticipantHush: (
    sessionId: string,
    personaId: string
  ) => Effect.Effect<void, SessionParticipationInfrastructureError>;
  readonly decrementAllParticipantHushTurns: (
    sessionId: string
  ) => Effect.Effect<void, SessionParticipationInfrastructureError>;
  readonly listHushedParticipantIds: (
    sessionId: string
  ) => Effect.Effect<readonly string[], SessionParticipationInfrastructureError>;
  readonly removeSessionParticipant: (
    sessionId: string,
    personaId: string
  ) => Effect.Effect<void, SessionParticipationInfrastructureError>;
}

export class SessionParticipationRepository extends Context.Tag('SessionParticipationRepository')<
  SessionParticipationRepository,
  SessionParticipationRepositoryService
>() {}
