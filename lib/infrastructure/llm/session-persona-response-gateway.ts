import { Effect } from 'effect';

import type {
  SessionMessagingInfrastructureError,
  SessionPersonaResponseGatewayService,
  TriggerSessionPersonaResponseRequest,
} from '../../application/use-cases/session-messaging';
import type { ProviderRegistry } from './provider-registry.js';
import { getAdapter } from './provider-registry.js';

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

// Legacy factory for backward compatibility with existing tests
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

// New factory using provider registry for provider abstraction
export const createSessionPersonaResponseGateway = (
  registry: ProviderRegistry
): SessionPersonaResponseGatewayService => ({
  generatePersonaResponse: (request) => {
    const adapter = getAdapter(registry, request.providerId);

    return adapter.generateResponse({
      modelId: request.modelId,
      apiKey: request.apiKey,
      systemPrompt: request.systemPrompt,
      messages: [
        { role: 'user', content: buildPersonaPrompt(request) },
      ],
      temperature: request.temperature,
    }).pipe(
      Effect.map(response => ({
        content: response.content,
        tokenCount: response.tokenCount ?? 0,
      })),
      Effect.mapError((error): SessionMessagingInfrastructureError => ({
        _tag: 'SessionMessagingInfrastructureError',
        source: 'llmGateway',
        message: `Failed to generate persona response: ${error._tag}`,
      }))
    );
  },
});

// Helper to build the persona prompt from request parameters
const buildPersonaPrompt = (request: TriggerSessionPersonaResponseRequest): string => {
  const parts: string[] = [];

  if (request.problemContext) {
    parts.push(`Problem Context: ${request.problemContext}`);
  }

  if (request.outputGoal) {
    parts.push(`Output Goal: ${request.outputGoal}`);
  }

  if (request.blackboard) {
    if (request.blackboard.consensus) {
      parts.push(`Consensus: ${request.blackboard.consensus}`);
    }
    if (request.blackboard.conflicts) {
      parts.push(`Conflicts: ${request.blackboard.conflicts}`);
    }
    if (request.blackboard.nextStep) {
      parts.push(`Next Step: ${request.blackboard.nextStep}`);
    }
    if (request.blackboard.facts) {
      parts.push(`Facts: ${request.blackboard.facts}`);
    }
  }

  if (request.otherPersonas && request.otherPersonas.length > 0) {
    parts.push('Other Participants:');
    request.otherPersonas.forEach(p => {
      parts.push(`- ${p.name} (${p.role})`);
    });
  }

  if (request.hiddenAgenda) {
    parts.push(`Hidden Agenda: ${request.hiddenAgenda}`);
  }

  if (request.verbosity) {
    parts.push(`Verbosity: ${request.verbosity}`);
  }

  return parts.join('\n\n');
};
