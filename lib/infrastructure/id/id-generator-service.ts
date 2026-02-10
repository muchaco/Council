import { randomUUID } from 'node:crypto';

import { Effect, Layer } from 'effect';

import { IdGenerator } from '../../application/runtime';

export const LiveIdGeneratorLayer: Layer.Layer<IdGenerator> = Layer.succeed(IdGenerator, {
  generate: Effect.sync(() => randomUUID()),
});
