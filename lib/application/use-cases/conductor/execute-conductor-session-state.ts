import { Effect } from 'effect';

import {
  executeDisableSessionConductor,
  executeEnableSessionConductor,
  executeResetSessionAutoReplyCount,
  executeUpdateSessionBlackboard as executeUpdateSessionBlackboardState,
  SessionStateRepository,
  type SessionStateInfrastructureError,
} from '../session-state';
import { executeLoadSessionById, QueryLayerRepository, type QueryLayerInfrastructureError } from '../query-layer';
import type { BlackboardState } from '../../../types';

const emptyBlackboardState: BlackboardState = {
  consensus: '',
  conflicts: '',
  nextStep: '',
  facts: '',
};

export const executeEnableConductorForSession = (
  sessionId: string,
  mode: 'automatic' | 'manual'
): Effect.Effect<void, SessionStateInfrastructureError, SessionStateRepository> =>
  executeEnableSessionConductor(sessionId, mode);

export const executeDisableConductorForSession = (
  sessionId: string
): Effect.Effect<void, SessionStateInfrastructureError, SessionStateRepository> =>
  Effect.gen(function* () {
    yield* executeDisableSessionConductor(sessionId);
    yield* executeResetSessionAutoReplyCount(sessionId);
  });

export const executeGetSessionBlackboard = (
  sessionId: string
): Effect.Effect<BlackboardState | null, QueryLayerInfrastructureError, QueryLayerRepository> =>
  Effect.gen(function* () {
    const session = yield* executeLoadSessionById(sessionId);
    if (session === null) {
      return null;
    }

    return session.blackboard ?? emptyBlackboardState;
  });

export const executeUpdateSessionBlackboard = (
  sessionId: string,
  blackboard: BlackboardState
): Effect.Effect<void, SessionStateInfrastructureError, SessionStateRepository> =>
  executeUpdateSessionBlackboardState(sessionId, blackboard);
