import { Effect } from 'effect';

import type {
  ConductorTurnRepositoryService,
  ConductorInfrastructureError,
} from '../../application/use-cases/conductor/conductor-dependencies';
import type {
  ConductorBlackboard,
  ConductorMessageSnapshot,
  ConductorPersonaSnapshot,
  ConductorSessionSnapshot,
} from '../../core/domain/conductor';

interface ConductorQueries {
  readonly getSession: (sessionId: string) => Promise<ConductorSessionSnapshot | null>;
  readonly getSessionPersonas: (sessionId: string) => Promise<readonly ConductorPersonaSnapshot[]>;
  readonly decrementAllHushTurns: (sessionId: string) => Promise<void>;
  readonly getLastMessages: (
    sessionId: string,
    limit: number
  ) => Promise<readonly ConductorMessageSnapshot[]>;
  readonly updateBlackboard: (sessionId: string, blackboard: ConductorBlackboard) => Promise<void>;
  readonly getNextTurnNumber: (sessionId: string) => Promise<number>;
  readonly createMessage: (input: {
    readonly sessionId: string;
    readonly personaId: string;
    readonly content: string;
    readonly turnNumber: number;
    readonly metadata: {
      readonly isIntervention: true;
      readonly selectorReasoning: string;
    };
  }) => Promise<void>;
  readonly incrementAutoReplyCount: (sessionId: string) => Promise<number>;
}

interface ElectronConductorSession {
  readonly id: string;
  readonly orchestratorEnabled: boolean;
  readonly orchestratorPersonaId: string | null;
  readonly autoReplyCount: number;
  readonly tokenCount: number;
  readonly problemDescription: string;
  readonly outputGoal: string;
  readonly blackboard: ConductorBlackboard | null;
}

interface ElectronConductorQueries {
  readonly getSession: (sessionId: string) => Promise<ElectronConductorSession | null>;
  readonly getSessionPersonas: (sessionId: string) => Promise<readonly ConductorPersonaSnapshot[]>;
  readonly decrementAllHushTurns: (sessionId: string) => Promise<void>;
  readonly getLastMessages: (
    sessionId: string,
    limit: number
  ) => Promise<readonly ConductorMessageSnapshot[]>;
  readonly updateBlackboard: (sessionId: string, blackboard: ConductorBlackboard) => Promise<void>;
  readonly getNextTurnNumber: (sessionId: string) => Promise<number>;
  readonly createMessage: (input: {
    readonly sessionId: string;
    readonly personaId: string;
    readonly content: string;
    readonly turnNumber: number;
    readonly metadata: {
      readonly isIntervention: true;
      readonly selectorReasoning: string;
    };
  }) => Promise<unknown>;
  readonly incrementAutoReplyCount: (sessionId: string) => Promise<number>;
}

const repositoryError = (message: string): ConductorInfrastructureError => ({
  _tag: 'ConductorInfrastructureError',
  source: 'repository',
  message,
});

export const makeConductorTurnRepositoryFromQueries = (
  queries: ConductorQueries
): ConductorTurnRepositoryService => ({
  getSession: (sessionId) =>
    Effect.tryPromise({
      try: () => queries.getSession(sessionId),
      catch: () => repositoryError('Failed to load session'),
    }),

  getSessionPersonas: (sessionId) =>
    Effect.tryPromise({
      try: () => queries.getSessionPersonas(sessionId),
      catch: () => repositoryError('Failed to load session personas'),
    }),

  decrementAllHushTurns: (sessionId) =>
    Effect.tryPromise({
      try: () => queries.decrementAllHushTurns(sessionId),
      catch: () => repositoryError('Failed to decrement hush turns'),
    }),

  getLastMessages: (sessionId, limit) =>
    Effect.tryPromise({
      try: () => queries.getLastMessages(sessionId, limit),
      catch: () => repositoryError('Failed to load recent messages'),
    }),

  updateBlackboard: (sessionId, blackboard) =>
    Effect.tryPromise({
      try: () => queries.updateBlackboard(sessionId, blackboard),
      catch: () => repositoryError('Failed to update blackboard'),
    }),

  getNextTurnNumber: (sessionId) =>
    Effect.tryPromise({
      try: () => queries.getNextTurnNumber(sessionId),
      catch: () => repositoryError('Failed to load next turn number'),
    }),

  createInterventionMessage: (input) =>
    Effect.tryPromise({
      try: () =>
        queries.createMessage({
          sessionId: input.sessionId,
          personaId: input.personaId,
          content: input.content,
          turnNumber: input.turnNumber,
          metadata: {
            isIntervention: true,
            selectorReasoning: input.selectorReasoning,
          },
        }),
      catch: () => repositoryError('Failed to create intervention message'),
    }),

  incrementAutoReplyCount: (sessionId) =>
    Effect.tryPromise({
      try: () => queries.incrementAutoReplyCount(sessionId),
      catch: () => repositoryError('Failed to increment auto-reply count'),
    }),
});

export const makeConductorTurnRepositoryFromElectronQueries = (
  queries: ElectronConductorQueries
): ConductorTurnRepositoryService =>
  makeConductorTurnRepositoryFromQueries({
    getSession: async (sessionId) => {
      const session = await queries.getSession(sessionId);
      if (!session) {
        return null;
      }

      return {
        sessionId: session.id,
        orchestratorEnabled: session.orchestratorEnabled,
        orchestratorPersonaId: session.orchestratorPersonaId,
        autoReplyCount: session.autoReplyCount,
        tokenCount: session.tokenCount,
        problemDescription: session.problemDescription,
        outputGoal: session.outputGoal,
        blackboard: session.blackboard,
      };
    },
    getSessionPersonas: (sessionId) => queries.getSessionPersonas(sessionId),
    decrementAllHushTurns: (sessionId) => queries.decrementAllHushTurns(sessionId),
    getLastMessages: (sessionId, limit) => queries.getLastMessages(sessionId, limit),
    updateBlackboard: (sessionId, blackboard) => queries.updateBlackboard(sessionId, blackboard),
    getNextTurnNumber: (sessionId) => queries.getNextTurnNumber(sessionId),
    createMessage: (input) =>
      queries
        .createMessage({
          sessionId: input.sessionId,
          personaId: input.personaId,
          content: input.content,
          turnNumber: input.turnNumber,
          metadata: input.metadata,
        })
        .then(() => undefined),
    incrementAutoReplyCount: (sessionId) => queries.incrementAutoReplyCount(sessionId),
  });
