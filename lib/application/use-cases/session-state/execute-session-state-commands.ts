import { Effect } from 'effect';

import type { Session, SessionInput } from '../../../types';
import {
  SessionStateRepository,
  type SessionStateInfrastructureError,
  type UpdateSessionStateCommand,
} from './session-state-dependencies';

const createId = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const randomValue = (Math.random() * 16) | 0;
    const value = token === 'x' ? randomValue : (randomValue & 0x3) | 0x8;
    return value.toString(16);
  });

const nowIso = (): string => new Date().toISOString();

export const executeCreateSessionState = (
  input: SessionInput,
  orchestratorConfig?: { readonly enabled: boolean; readonly orchestratorPersonaId?: string }
): Effect.Effect<Session, SessionStateInfrastructureError, SessionStateRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionStateRepository;
    const id = createId();
    const now = nowIso();
    const orchestratorEnabled = orchestratorConfig?.enabled ?? false;
    const orchestratorPersonaId = orchestratorConfig?.orchestratorPersonaId ?? null;

    yield* repository.createSession({
      id,
      now,
      input,
      orchestratorEnabled,
      orchestratorPersonaId,
    });

    return {
      id,
      title: input.title,
      problemDescription: input.problemDescription,
      outputGoal: input.outputGoal,
      status: 'active',
      tokenCount: 0,
      costEstimate: 0,
      orchestratorEnabled,
      orchestratorPersonaId,
      blackboard: null,
      autoReplyCount: 0,
      tokenBudget: 100000,
      summary: null,
      archivedAt: null,
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
  });

export const executeUpdateSessionState = (
  sessionId: string,
  input: UpdateSessionStateCommand['input']
): Effect.Effect<void, SessionStateInfrastructureError, SessionStateRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionStateRepository;
    yield* repository.updateSession({ id: sessionId, now: nowIso(), input });
  });

export const executeDeleteSessionState = (
  sessionId: string
): Effect.Effect<void, SessionStateInfrastructureError, SessionStateRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionStateRepository;
    yield* repository.deleteSession(sessionId);
  });

export const executeUpdateSessionBlackboard = (
  sessionId: string,
  blackboard: unknown
): Effect.Effect<void, SessionStateInfrastructureError, SessionStateRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionStateRepository;
    yield* repository.updateBlackboard(sessionId, blackboard);
  });

export const executeUpdateSessionSummary = (
  sessionId: string,
  summary: string
): Effect.Effect<void, SessionStateInfrastructureError, SessionStateRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionStateRepository;
    yield* repository.updateSessionSummary(sessionId, summary);
  });

export const executeIncrementSessionAutoReplyCount = (
  sessionId: string
): Effect.Effect<number, SessionStateInfrastructureError, SessionStateRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionStateRepository;
    yield* repository.incrementAutoReplyCount(sessionId);
    return yield* repository.readAutoReplyCount(sessionId);
  });

export const executeResetSessionAutoReplyCount = (
  sessionId: string
): Effect.Effect<void, SessionStateInfrastructureError, SessionStateRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionStateRepository;
    yield* repository.resetAutoReplyCount(sessionId);
  });

export const executeEnableSessionOrchestrator = (
  sessionId: string,
  orchestratorPersonaId: string
): Effect.Effect<void, SessionStateInfrastructureError, SessionStateRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionStateRepository;
    yield* repository.enableOrchestrator(sessionId, orchestratorPersonaId);
  });

export const executeDisableSessionOrchestrator = (
  sessionId: string
): Effect.Effect<void, SessionStateInfrastructureError, SessionStateRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionStateRepository;
    yield* repository.disableOrchestrator(sessionId);
  });

export const executeArchiveSession = (
  sessionId: string
): Effect.Effect<void, SessionStateInfrastructureError, SessionStateRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionStateRepository;
    yield* repository.archiveSession(sessionId, nowIso());
  });

export const executeUnarchiveSession = (
  sessionId: string
): Effect.Effect<void, SessionStateInfrastructureError, SessionStateRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionStateRepository;
    yield* repository.unarchiveSession(sessionId);
  });

export const executeIsSessionArchived = (
  sessionId: string
): Effect.Effect<boolean, SessionStateInfrastructureError, SessionStateRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionStateRepository;
    return yield* repository.isSessionArchived(sessionId);
  });
