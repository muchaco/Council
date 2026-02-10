import { Context, Effect } from 'effect';

export interface IdGeneratorService {
  readonly generate: Effect.Effect<string>;
}

export class IdGenerator extends Context.Tag('IdGenerator')<IdGenerator, IdGeneratorService>() {}
