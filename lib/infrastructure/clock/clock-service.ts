import { Context, Effect, Layer } from 'effect';

export interface ClockService {
  readonly now: Effect.Effect<Date>;
}

export class Clock extends Context.Tag('Clock')<Clock, ClockService>() {}

export const LiveClockLayer: Layer.Layer<Clock> = Layer.succeed(Clock, {
  now: Effect.sync(() => new Date()),
});
