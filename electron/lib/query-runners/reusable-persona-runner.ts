import { Effect } from 'effect';

import type {
  ReusablePersonaInfrastructureError,
  ReusablePersonaRepositoryService,
} from '../../../lib/application/use-cases';
import { ReusablePersonaRepository } from '../../../lib/application/use-cases';
import type { Clock, IdGenerator } from '../../../lib/application/runtime';
import { LiveClockLayer } from '../../../lib/infrastructure/clock';
import { LiveIdGeneratorLayer } from '../../../lib/infrastructure/id';
import { runEffectOrThrow } from './run-effect.js';

export const createReusablePersonaRunner = (repository: ReusablePersonaRepositoryService) =>
  async <A>(
    operation: Effect.Effect<
      A,
      ReusablePersonaInfrastructureError,
      ReusablePersonaRepository | Clock | IdGenerator
    >
  ): Promise<A> =>
    runEffectOrThrow(
      operation.pipe(
        Effect.provideService(ReusablePersonaRepository, repository),
        Effect.provide(LiveClockLayer),
        Effect.provide(LiveIdGeneratorLayer)
      )
    );
