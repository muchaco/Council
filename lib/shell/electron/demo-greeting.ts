import { Effect } from 'effect';

import { executeDemoGreeting } from '../../application/use-cases/demo-greeting/execute-demo-greeting';
import { makeInMemoryDemoGreetingStateStoreLayer } from '../../infrastructure/settings/demo-greeting-state-store';

export const runDemoGreeting = (name: string): Promise<string> =>
  Effect.runPromise(
    executeDemoGreeting({ name }).pipe(
      Effect.provide(makeInMemoryDemoGreetingStateStoreLayer()),
      Effect.map((result) => result.greetingMessage)
    )
  );
