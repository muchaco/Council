import { describe, expect, it } from 'vitest';
import { Either } from 'effect';

import { decideDemoGreeting } from './decide-demo-greeting';

describe('decide_demo_greeting_spec', () => {
  it('returns_plan_when_name_is_valid', () => {
    const decision = decideDemoGreeting(
      { name: '  Ada Lovelace  ' },
      { greetingCount: 2 }
    );

    expect(Either.isRight(decision)).toBe(true);

    if (Either.isRight(decision)) {
      expect(decision.right.result.normalizedName).toBe('Ada Lovelace');
      expect(decision.right.result.greetingMessage).toBe('Hello, Ada Lovelace!');
      expect(decision.right.nextState.greetingCount).toBe(3);
      expect(decision.right.effects).toEqual([
        {
          _tag: 'LogInfo',
          message: 'Prepared greeting #3 for Ada Lovelace',
        },
      ]);
    }
  });

  it('returns_domain_error_when_name_is_empty_after_trim', () => {
    const decision = decideDemoGreeting(
      { name: '   ' },
      { greetingCount: 10 }
    );

    expect(Either.isLeft(decision)).toBe(true);

    if (Either.isLeft(decision)) {
      expect(decision.left).toEqual({
        _tag: 'EmptyNameError',
        message: 'Name must not be empty',
      });
    }
  });
});
