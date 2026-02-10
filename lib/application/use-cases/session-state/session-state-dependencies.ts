import { Context, Effect } from 'effect';

import type { SessionInput } from '../../../types';

export interface SessionStateInfrastructureError {
  readonly _tag: 'SessionStateInfrastructureError';
  readonly source: 'repository';
  readonly message: string;
}

export interface CreateSessionStateCommand {
  readonly id: string;
  readonly now: string;
  readonly input: SessionInput;
  readonly orchestratorEnabled: boolean;
  readonly orchestratorPersonaId: string | null;
}

export interface UpdateSessionStateCommand {
  readonly id: string;
  readonly now: string;
  readonly input: Partial<SessionInput> & {
    readonly status?: string;
    readonly tokenCount?: number;
    readonly costEstimate?: number;
    readonly orchestratorEnabled?: boolean;
    readonly orchestratorPersonaId?: string | null;
    readonly blackboard?: unknown;
    readonly autoReplyCount?: number;
    readonly tokenBudget?: number;
    readonly summary?: string | null;
  };
}

export interface SessionStateRepositoryService {
  readonly createSession: (command: CreateSessionStateCommand) => Effect.Effect<void, SessionStateInfrastructureError>;
  readonly updateSession: (command: UpdateSessionStateCommand) => Effect.Effect<void, SessionStateInfrastructureError>;
  readonly deleteSession: (sessionId: string) => Effect.Effect<void, SessionStateInfrastructureError>;
  readonly updateBlackboard: (
    sessionId: string,
    blackboard: unknown
  ) => Effect.Effect<void, SessionStateInfrastructureError>;
  readonly updateSessionSummary: (
    sessionId: string,
    summary: string
  ) => Effect.Effect<void, SessionStateInfrastructureError>;
  readonly incrementAutoReplyCount: (sessionId: string) => Effect.Effect<void, SessionStateInfrastructureError>;
  readonly readAutoReplyCount: (sessionId: string) => Effect.Effect<number, SessionStateInfrastructureError>;
  readonly resetAutoReplyCount: (sessionId: string) => Effect.Effect<void, SessionStateInfrastructureError>;
  readonly enableOrchestrator: (
    sessionId: string,
    orchestratorPersonaId: string
  ) => Effect.Effect<void, SessionStateInfrastructureError>;
  readonly disableOrchestrator: (sessionId: string) => Effect.Effect<void, SessionStateInfrastructureError>;
  readonly archiveSession: (sessionId: string, archivedAt: string) => Effect.Effect<void, SessionStateInfrastructureError>;
  readonly unarchiveSession: (sessionId: string) => Effect.Effect<void, SessionStateInfrastructureError>;
  readonly isSessionArchived: (sessionId: string) => Effect.Effect<boolean, SessionStateInfrastructureError>;
}

export class SessionStateRepository extends Context.Tag('SessionStateRepository')<
  SessionStateRepository,
  SessionStateRepositoryService
>() {}
