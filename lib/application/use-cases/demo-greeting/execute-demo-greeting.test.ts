import { describe, expect, layer } from '@effect/vitest';
import { Effect, Either } from 'effect';

import {
  DemoGreetingStateStore,
  executeDemoGreeting,
} from './execute-demo-greeting';
import { makeInMemoryDemoGreetingStateStoreLayer } from '../../../infrastructure/settings/demo-greeting-state-store';

describe('execute_demo_greeting_use_case_spec', () => {
  layer(makeInMemoryDemoGreetingStateStoreLayer({ greetingCount: 0 }))((it) => {
    it.effect('executes_core_decision_and_persists_state_with_layer', () =>
      Effect.gen(function* () {
        const first = yield* executeDemoGreeting({ name: 'Ada' });
        const second = yield* executeDemoGreeting({ name: 'Grace' });
        const stateStore = yield* DemoGreetingStateStore;
        const finalState = yield* stateStore.getState;

        expect(first.greetingMessage).toBe('Hello, Ada!');
        expect(second.greetingMessage).toBe('Hello, Grace!');
        expect(finalState.greetingCount).toBe(2);
      })
    );
  });

  layer(makeInMemoryDemoGreetingStateStoreLayer())((it) => {
    it.effect('surfaces_domain_error_from_core_for_invalid_input', () =>
      Effect.gen(function* () {
        const result = yield* executeDemoGreeting({ name: '   ' }).pipe(Effect.either);

        expect(Either.isLeft(result)).toBe(true);

        if (Either.isLeft(result)) {
          expect(result.left).toEqual({
            _tag: 'EmptyNameError',
            message: 'Name must not be empty',
          });
        }
      })
    );
  });
});
