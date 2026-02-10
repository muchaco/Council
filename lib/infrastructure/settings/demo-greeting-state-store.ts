import { Effect, Layer, Ref } from 'effect';

import {
  DemoGreetingStateStore,
  type DemoGreetingStateStoreService,
} from '../../application/use-cases/demo-greeting/execute-demo-greeting';
import type { DemoGreetingState } from '../../core/domain/demo-greeting';

const initialDemoGreetingState: DemoGreetingState = {
  greetingCount: 0,
};

export const makeInMemoryDemoGreetingStateStoreLayer = (
  initialState: DemoGreetingState = initialDemoGreetingState
): Layer.Layer<DemoGreetingStateStore> =>
  Layer.effect(
    DemoGreetingStateStore,
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(initialState);

      const service: DemoGreetingStateStoreService = {
        getState: Ref.get(stateRef),
        saveState: (nextState: DemoGreetingState) => Ref.set(stateRef, nextState),
      };

      return service;
    })
  );
