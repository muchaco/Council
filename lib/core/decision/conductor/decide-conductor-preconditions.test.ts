import { describe, expect, it } from 'vitest';
import { Either } from 'effect';

import type { ConductorSessionSnapshot } from '../../domain/conductor';
import { decideConductorSessionPreconditions } from './decide-conductor-preconditions';

describe('decide_conductor_preconditions_spec', () => {
  it.each([
    {
      name: 'fails_when_session_is_missing',
      session: null,
      expected: {
        _tag: 'ConductorSessionNotFoundError',
        message: 'Session not found',
      },
    },
    {
      name: 'fails_when_conductor_is_disabled',
      session: {
        sessionId: 'session-1',
        conductorEnabled: false,
        controlMode: 'automatic',
        autoReplyCount: 0,
        tokenCount: 0,
        problemDescription: 'Problem',
        outputGoal: 'Goal',
        blackboard: null,
      },
      expected: {
        _tag: 'ConductorNotEnabledError',
        message: 'Conductor not enabled for this session',
      },
    },
    {
      name: 'fails_when_control_mode_is_invalid',
      session: {
        sessionId: 'session-1',
        conductorEnabled: true,
        controlMode: 'hybrid' as unknown as ConductorSessionSnapshot['controlMode'],
        autoReplyCount: 0,
        tokenCount: 0,
        problemDescription: 'Problem',
        outputGoal: 'Goal',
        blackboard: null,
      },
      expected: {
        _tag: 'ConductorInvalidControlModeError',
        message: 'Unsupported conductor control mode: hybrid',
      },
    },
  ])('$name', ({ session, expected }) => {
    const decision = decideConductorSessionPreconditions(
      session as ConductorSessionSnapshot | null
    );
    expect(Either.isLeft(decision)).toBe(true);
    if (Either.isLeft(decision)) {
      expect(decision.left).toEqual(expected);
    }
  });

  it('returns_session_preconditions_when_session_is_enabled_and_mode_is_valid', () => {
    const session: ConductorSessionSnapshot = {
      sessionId: 'session-1',
      conductorEnabled: true,
      controlMode: 'manual',
      autoReplyCount: 0,
      tokenCount: 0,
      problemDescription: 'Problem',
      outputGoal: 'Goal',
      blackboard: null,
    };

    const decision = decideConductorSessionPreconditions(session);
    expect(Either.isRight(decision)).toBe(true);
    if (Either.isRight(decision)) {
      expect(decision.right.session).toEqual(session);
    }
  });
});
