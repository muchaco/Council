import { Effect } from 'effect';

import type {
  CouncilTranscriptInfrastructureError,
  CouncilTranscriptRepositoryService,
} from '../../../lib/application/use-cases';
import { CouncilTranscriptRepository } from '../../../lib/application/use-cases';
import type { Clock, IdGenerator } from '../../../lib/application/runtime';
import { LiveClockLayer } from '../../../lib/infrastructure/clock';
import { LiveIdGeneratorLayer } from '../../../lib/infrastructure/id';
import { runEffectOrThrow } from './run-effect.js';

export const createCouncilTranscriptRunner = (repository: CouncilTranscriptRepositoryService) =>
  async <A>(
    operation: Effect.Effect<
      A,
      CouncilTranscriptInfrastructureError,
      CouncilTranscriptRepository | Clock | IdGenerator
    >
  ): Promise<A> =>
    runEffectOrThrow(
      operation.pipe(
        Effect.provideService(CouncilTranscriptRepository, repository),
        Effect.provide(LiveClockLayer),
        Effect.provide(LiveIdGeneratorLayer)
      )
    );
