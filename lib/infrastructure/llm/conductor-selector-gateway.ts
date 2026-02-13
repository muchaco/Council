import { Effect } from 'effect';

import type {
  ConductorBlackboard,
  ConductorSelectorDecision,
} from '../../core/domain/conductor';
import type {
  ConductorInfrastructureError,
  ConductorSelectorGatewayService,
  SelectNextSpeakerRequest,
} from '../../application/use-cases/conductor/conductor-dependencies';
import type { ProviderRegistry } from './provider-registry.js';
import { getAdapter } from './provider-registry.js';

const selectorError = (
  code: ConductorInfrastructureError extends infer E
    ? E extends { source: 'selector'; code: infer C }
      ? C
      : never
    : never,
  message: string
): ConductorInfrastructureError => ({
  _tag: 'ConductorInfrastructureError',
  source: 'selector',
  code,
  message,
});

const asConductorBlackboardPatch = (value: unknown): Partial<ConductorBlackboard> => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const parsed = value as Record<string, unknown>;
  return {
    ...(typeof parsed.consensus === 'string' ? { consensus: parsed.consensus } : {}),
    ...(typeof parsed.conflicts === 'string' ? { conflicts: parsed.conflicts } : {}),
    ...(typeof parsed.nextStep === 'string' ? { nextStep: parsed.nextStep } : {}),
    ...(typeof parsed.facts === 'string' ? { facts: parsed.facts } : {}),
  };
};

const parseSelectorDecision = (rawText: string): ConductorSelectorDecision => {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in selector response');
  }

  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  if (typeof parsed.selectedPersonaId !== 'string') {
    throw new Error('Selector response missing selectedPersonaId');
  }

  const normalizedPersonaId = parsed.selectedPersonaId.trim();

  return {
    selectedPersonaId: normalizedPersonaId,
    reasoning:
      typeof parsed.reasoning === 'string' && parsed.reasoning.trim().length > 0
        ? parsed.reasoning
        : 'No reasoning provided',
    isIntervention: Boolean(parsed.isIntervention),
    interventionMessage:
      typeof parsed.interventionMessage === 'string' ? parsed.interventionMessage : undefined,
    updateBlackboard: asConductorBlackboardPatch(parsed.updateBlackboard),
  };
};

// Legacy factory for backward compatibility with existing tests
export const makeConductorSelectorGatewayFromExecutor = (
  execute: (request: SelectNextSpeakerRequest) => Promise<string>
): ConductorSelectorGatewayService => ({
  selectNextSpeaker: (request) =>
    Effect.tryPromise<string, ConductorInfrastructureError>({
      try: () => execute(request),
      catch: (error) =>
        selectorError(
          'ExecutionFailed',
          `Selector agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        ),
    }).pipe(
      Effect.flatMap((rawResponse) =>
        Effect.try<ConductorSelectorDecision, ConductorInfrastructureError>({
          try: () => parseSelectorDecision(rawResponse),
          catch: (error) =>
            selectorError(
              'InvalidSelectorResponse',
              `Selector response parsing failed: ${
                error instanceof Error ? error.message : 'Unknown parse error'
              }`
            ),
        })
      )
    ),
});

// New factory using provider registry for provider abstraction
export const createConductorSelectorGateway = (
  registry: ProviderRegistry
): ConductorSelectorGatewayService => ({
  selectNextSpeaker: (request) => {
    const adapter = getAdapter(registry, request.providerId);

    return adapter.generateResponse({
      modelId: request.modelId,
      apiKey: request.apiKey,
      systemPrompt: undefined,
      messages: [
        { role: 'user', content: request.selectorPrompt },
      ],
      temperature: request.temperature,
      maxTokens: request.maxOutputTokens,
    }).pipe(
      Effect.map(response => parseSelectorDecision(response.content)),
      Effect.mapError((error): ConductorInfrastructureError => ({
        _tag: 'ConductorInfrastructureError',
        source: 'selector',
        code: 'ExecutionFailed',
        message: `Selector agent failed: ${error._tag}`,
      }))
    );
  },
});
