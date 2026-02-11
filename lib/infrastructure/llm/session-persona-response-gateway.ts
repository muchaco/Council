import { Effect } from 'effect';

import type {
  SessionMessagingInfrastructureError,
  SessionPersonaResponseGatewayService,
  TriggerSessionPersonaResponseRequest,
} from '../../application/use-cases/session-messaging';

interface SessionPersonaResponseElectronLLM {
  readonly chat: (request: TriggerSessionPersonaResponseRequest) => Promise<{
    success: boolean;
    data?: {
      content: string;
      tokenCount: number;
    };
    error?: string;
  }>;
}

const infrastructureError = (
  source: SessionMessagingInfrastructureError['source'],
  message: string
): SessionMessagingInfrastructureError => ({
  _tag: 'SessionMessagingInfrastructureError',
  source,
  message,
});

const isValidGeneratedResponse = (
  value: unknown
): value is { content: string; tokenCount: number } => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.content === 'string' && typeof candidate.tokenCount === 'number';
};

export const makeSessionPersonaResponseGatewayFromElectronLLM = (
  electronLLM: SessionPersonaResponseElectronLLM
): SessionPersonaResponseGatewayService => ({
  generatePersonaResponse: (request) =>
    Effect.tryPromise({
      try: () => electronLLM.chat(request),
      catch: () => infrastructureError('llmGateway', 'Failed to generate persona response'),
    }).pipe(
      Effect.flatMap((result) => {
        if (!result.success || !isValidGeneratedResponse(result.data)) {
          return Effect.fail(
            infrastructureError(
              'llmGateway',
              result.error ?? (result.success ? 'Invalid generated response payload' : 'Failed to generate persona response')
            )
          );
        }

        return Effect.succeed(result.data);
      })
    ),
});
