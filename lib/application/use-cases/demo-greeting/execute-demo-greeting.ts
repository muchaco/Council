import { Context, Effect, Either } from 'effect';

import { decideDemoGreeting } from '../../../core/decision/decide-demo-greeting';
import type {
  DemoGreetingInput,
  DemoGreetingResult,
  DemoGreetingState,
} from '../../../core/domain/demo-greeting';
import type { DomainError } from '../../../core/errors/domain-error';

export interface DemoGreetingStateStoreService {
  readonly getState: Effect.Effect<DemoGreetingState>;
  readonly saveState: (nextState: DemoGreetingState) => Effect.Effect<void>;
}

export class DemoGreetingStateStore extends Context.Tag('DemoGreetingStateStore')<
  DemoGreetingStateStore,
  DemoGreetingStateStoreService
>() {}

export const executeDemoGreeting = (
  input: DemoGreetingInput
): Effect.Effect<DemoGreetingResult, DomainError, DemoGreetingStateStore> =>
  Effect.gen(function* () {
    const stateStore = yield* DemoGreetingStateStore;
    const state = yield* stateStore.getState;
    const decision = decideDemoGreeting(input, state);
    if (Either.isLeft(decision)) {
      yield* Effect.fail(decision.left);
    }

    const plan = decision.right;

    for (const plannedEffect of plan.effects) {
      if (plannedEffect._tag === 'LogInfo') {
        yield* Effect.logInfo(plannedEffect.message);
      }
    }

    yield* stateStore.saveState(plan.nextState);

    return plan.result;
  });
