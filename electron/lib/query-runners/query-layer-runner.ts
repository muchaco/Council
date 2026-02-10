import { Effect } from 'effect';

import type {
  QueryLayerInfrastructureError,
  QueryLayerRepositoryService,
} from '../../../lib/application/use-cases';
import { QueryLayerRepository } from '../../../lib/application/use-cases';
import { runEffectOrThrow } from './run-effect.js';

export const createQueryLayerRunner = (repository: QueryLayerRepositoryService) =>
  async <A>(
    operation: Effect.Effect<A, QueryLayerInfrastructureError, QueryLayerRepository | never>
  ): Promise<A> =>
    runEffectOrThrow(operation.pipe(Effect.provideService(QueryLayerRepository, repository)));
