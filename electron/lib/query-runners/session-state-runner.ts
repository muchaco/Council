import { Effect } from 'effect';

import type {
  SessionStateInfrastructureError,
  SessionStateRepositoryService,
} from '../../../lib/application/use-cases';
import { SessionStateRepository } from '../../../lib/application/use-cases';
import type { Clock, IdGenerator } from '../../../lib/application/runtime';
import { LiveClockLayer } from '../../../lib/infrastructure/clock';
import { LiveIdGeneratorLayer } from '../../../lib/infrastructure/id';
import { runEffectOrThrow } from './run-effect.js';

export const createSessionStateRunner = (repository: SessionStateRepositoryService) =>
  async <A>(
    operation: Effect.Effect<
      A,
      SessionStateInfrastructureError,
      SessionStateRepository | Clock | IdGenerator
    >
  ): Promise<A> =>
    runEffectOrThrow(
      operation.pipe(
        Effect.provideService(SessionStateRepository, repository),
        Effect.provide(LiveClockLayer),
        Effect.provide(LiveIdGeneratorLayer)
      )
    );
