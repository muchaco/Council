import { Either } from 'effect';

import type { DemoGreetingInput, DemoGreetingState } from '../domain/demo-greeting';
import type { DomainError } from '../errors/domain-error';
import type { DemoGreetingPlan } from '../plan/demo-greeting-plan';

export const decideDemoGreeting = (
  input: DemoGreetingInput,
  state: DemoGreetingState
): Either.Either<DemoGreetingPlan, DomainError> => {
  const normalizedName = input.name.trim();

  if (normalizedName.length === 0) {
    return Either.left({
      _tag: 'EmptyNameError',
      message: 'Name must not be empty',
    });
  }

  return Either.right({
    nextState: {
      greetingCount: state.greetingCount + 1,
    },
    result: {
      normalizedName,
      greetingMessage: `Hello, ${normalizedName}!`,
    },
    effects: [
      {
        _tag: 'LogInfo',
        message: `Prepared greeting #${state.greetingCount + 1} for ${normalizedName}`,
      },
    ],
  });
};
