import { randomUUID } from 'node:crypto';

import { Context, Effect, Layer } from 'effect';

export interface IdGeneratorService {
  readonly generate: Effect.Effect<string>;
}

export class IdGenerator extends Context.Tag('IdGenerator')<IdGenerator, IdGeneratorService>() {}

export const LiveIdGeneratorLayer: Layer.Layer<IdGenerator> = Layer.succeed(IdGenerator, {
  generate: Effect.sync(() => randomUUID()),
});
