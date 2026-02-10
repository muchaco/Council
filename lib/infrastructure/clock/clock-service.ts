import { Effect, Layer } from 'effect';

import { Clock } from '../../application/runtime';

export const LiveClockLayer: Layer.Layer<Clock> = Layer.succeed(Clock, {
  now: Effect.sync(() => new Date()),
});
