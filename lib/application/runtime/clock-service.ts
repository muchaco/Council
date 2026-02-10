import { Context, Effect } from 'effect';

export interface ClockService {
  readonly now: Effect.Effect<Date>;
}

export class Clock extends Context.Tag('Clock')<Clock, ClockService>() {}
