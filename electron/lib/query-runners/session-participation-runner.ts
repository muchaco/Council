import { Effect } from 'effect';

import type {
  SessionParticipationInfrastructureError,
  SessionParticipationRepositoryService,
} from '../../../lib/application/use-cases';
import { SessionParticipationRepository } from '../../../lib/application/use-cases';
import type { Clock } from '../../../lib/application/runtime';
import { LiveClockLayer } from '../../../lib/infrastructure/clock';
import { runEffectOrThrow } from './run-effect.js';

export const createSessionParticipationRunner = (
  repository: SessionParticipationRepositoryService
) =>
  async <A>(
    operation: Effect.Effect<
      A,
      SessionParticipationInfrastructureError,
      SessionParticipationRepository | Clock
    >
  ): Promise<A> =>
    runEffectOrThrow(
      operation.pipe(
        Effect.provideService(SessionParticipationRepository, repository),
        Effect.provide(LiveClockLayer)
      )
    );
