import { Effect } from 'effect';

import { Clock, IdGenerator } from '../../runtime';
import type { Session, SessionInput } from '../../../types';
import {
  SessionStateRepository,
  type SessionStateInfrastructureError,
  type UpdateSessionStateCommand,
} from './session-state-dependencies';

export const executeCreateSessionState = (
  input: SessionInput,
  orchestratorConfig?: { readonly enabled: boolean; readonly orchestratorPersonaId?: string }
): Effect.Effect<
  Session,
  SessionStateInfrastructureError,
  SessionStateRepository | IdGenerator | Clock
> =>
  Effect.gen(function* () {
    const repository = yield* SessionStateRepository;
    const idGenerator = yield* IdGenerator;
    const clock = yield* Clock;
    const id = yield* idGenerator.generate;
    const now = (yield* clock.now).toISOString();
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
): Effect.Effect<void, SessionStateInfrastructureError, SessionStateRepository | Clock> =>
  Effect.gen(function* () {
    const repository = yield* SessionStateRepository;
    const clock = yield* Clock;
    yield* repository.updateSession({ id: sessionId, now: (yield* clock.now).toISOString(), input });
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
): Effect.Effect<void, SessionStateInfrastructureError, SessionStateRepository | Clock> =>
  Effect.gen(function* () {
    const repository = yield* SessionStateRepository;
    const clock = yield* Clock;
    yield* repository.archiveSession(sessionId, (yield* clock.now).toISOString());
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
