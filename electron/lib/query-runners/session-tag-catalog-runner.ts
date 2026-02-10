import { Effect } from 'effect';

import type {
  SessionTagCatalogInfrastructureError,
  SessionTagCatalogRepositoryService,
} from '../../../lib/application/use-cases';
import { SessionTagCatalogRepository } from '../../../lib/application/use-cases';
import type { Clock } from '../../../lib/application/runtime';
import { LiveClockLayer } from '../../../lib/infrastructure/clock';
import { runEffectOrThrow } from './run-effect.js';

export const createSessionTagCatalogRunner = (repository: SessionTagCatalogRepositoryService) =>
  async <A>(
    operation: Effect.Effect<A, SessionTagCatalogInfrastructureError, SessionTagCatalogRepository | Clock>
  ): Promise<A> =>
    runEffectOrThrow(
      operation.pipe(
        Effect.provideService(SessionTagCatalogRepository, repository),
        Effect.provide(LiveClockLayer)
      )
    );
