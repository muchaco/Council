import { describe, expect, it } from 'vitest';

import { decideCircuitBreaker } from './decide-circuit-breaker';

describe('decide_circuit_breaker_spec', () => {
  it.each([
    {
      name: 'pauses_when_auto_reply_limit_reached',
      input: { autoReplyCount: 8, tokenCount: 10 },
      expectedTag: 'PauseForUserConfirmation',
      expectedMessage:
        'Circuit breaker: Maximum 8 auto-replies reached. Click continue to proceed.',
    },
    {
      name: 'pauses_when_token_budget_limit_reached',
      input: { autoReplyCount: 3, tokenCount: 100_000 },
      expectedTag: 'PauseForUserConfirmation',
      expectedMessage: 'Token budget exceeded (100,000 / 100,000). Session paused.',
    },
    {
      name: 'warns_when_token_budget_warning_reached',
      input: { autoReplyCount: 3, tokenCount: 75_000 },
      expectedTag: 'ContinueWithBudgetWarning',
      expectedWarning: 'Warning: Token usage at 75% of budget',
    },
    {
      name: 'continues_when_under_thresholds',
      input: { autoReplyCount: 2, tokenCount: 49_999 },
      expectedTag: 'ContinueWithinBudget',
    },
  ])('$name', ({ input, expectedTag, expectedMessage, expectedWarning }) => {
    const decision = decideCircuitBreaker(input);

    expect(decision._tag).toBe(expectedTag);

    if (expectedMessage) {
      expect(decision).toEqual({
        _tag: expectedTag,
        message: expectedMessage,
      });
    }

    if (expectedWarning) {
      expect(decision).toEqual({
        _tag: expectedTag,
        warning: expectedWarning,
      });
    }
  });
});
