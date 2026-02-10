import { Effect } from 'effect';

import type {
  ConductorInfrastructureError,
  ConductorSelectorGatewayService,
  SelectNextSpeakerRequest,
  SelectNextSpeakerResponse,
} from '../../application/use-cases/conductor/conductor-dependencies';

const selectorError = (message: string): ConductorInfrastructureError => ({
  _tag: 'ConductorInfrastructureError',
  source: 'selector',
  message,
});

export const makeConductorSelectorGatewayFromExecutor = (
  execute: (request: SelectNextSpeakerRequest) => Promise<SelectNextSpeakerResponse>
): ConductorSelectorGatewayService => ({
  selectNextSpeaker: (request) =>
    Effect.tryPromise({
      try: () => execute(request),
      catch: (error) => selectorError(`Selector agent failed: ${(error as Error).message}`),
    }),
});
