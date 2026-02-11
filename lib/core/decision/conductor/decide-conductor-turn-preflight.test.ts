import { describe, expect, it } from 'vitest';
import { Either } from 'effect';

import type { ConductorSessionSnapshot } from '../../domain/conductor';
import { decideConductorTurnPreflight } from './decide-conductor-turn-preflight';

const baseSession: ConductorSessionSnapshot = {
  sessionId: 'session-1',
  conductorEnabled: true,
  conductorPersonaId: 'conductor',
  autoReplyCount: 0,
  tokenCount: 0,
  problemDescription: 'Ship FCIS migration safely',
  outputGoal: 'Phased rollout plan',
  blackboard: { consensus: '', conflicts: '', nextStep: '', facts: '' },
};

describe('decide_conductor_turn_preflight_spec', () => {
  it.each([
    {
      name: 'fails_when_session_is_missing',
      session: null,
      expectedLeft: {
        _tag: 'ConductorSessionNotFoundError',
        message: 'Session not found',
      },
    },
    {
      name: 'stops_when_circuit_breaker_is_triggered',
      session: { ...baseSession, autoReplyCount: 8 },
      expectedRight: {
        _tag: 'StopForCircuitBreaker',
        message: 'Circuit breaker: Maximum 8 auto-replies reached. Click continue to proceed.',
      },
    },
    {
      name: 'continues_with_warning_when_token_budget_is_high',
      session: { ...baseSession, tokenCount: 70_000 },
      expectedRight: {
        _tag: 'ContinueConductorTurn',
        warning: 'Warning: Token usage at 70% of budget',
      },
    },
  ])('$name', ({ session, expectedLeft, expectedRight }) => {
    const outcome = decideConductorTurnPreflight(session);

    if (expectedLeft) {
      expect(Either.isLeft(outcome)).toBe(true);
      if (Either.isLeft(outcome)) {
        expect(outcome.left).toEqual(expectedLeft);
      }
      return;
    }

    expect(Either.isRight(outcome)).toBe(true);
    if (Either.isRight(outcome)) {
      expect(outcome.right._tag).toBe(expectedRight._tag);
      if (expectedRight._tag === 'StopForCircuitBreaker') {
        expect(outcome.right).toEqual(expectedRight);
      }
      if (expectedRight._tag === 'ContinueConductorTurn' && outcome.right._tag === 'ContinueConductorTurn') {
        expect(outcome.right.warning).toBe(expectedRight.warning);
        expect(outcome.right.conductorPersonaId).toBe('conductor');
      }
    }
  });
});
