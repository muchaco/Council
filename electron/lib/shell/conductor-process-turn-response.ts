import { Either, type Either as EitherType } from 'effect';

import type {
  ConductorTurnUseCaseError,
  ExecuteConductorTurnResult,
} from '../../../lib/application/use-cases/conductor';
import type { ConductorProcessTurnResponse } from '../../../lib/types';

export const mapConductorTurnOutcomeToProcessTurnResponse = (
  outcome: EitherType.Either<ExecuteConductorTurnResult, ConductorTurnUseCaseError>
): ConductorProcessTurnResponse => {
  if (Either.isLeft(outcome)) {
    const error = outcome.left;

    if (error._tag === 'ConductorInfrastructureError' && error.source === 'selector') {
      return {
        success: false,
        error: 'Failed to select next speaker',
        code: 'SELECTOR_AGENT_ERROR',
      };
    }

    if (error._tag === 'ConductorInfrastructureError' && error.source === 'settings') {
      if (error.code === 'ApiKeyMissing') {
        return {
          success: false,
          error: 'Gemini API key is not configured',
          code: 'API_KEY_NOT_CONFIGURED',
        };
      }

      if (error.code === 'ApiKeyDecryptFailed') {
        return {
          success: false,
          error: 'Failed to decrypt Gemini API key',
          code: 'API_KEY_DECRYPT_FAILED',
        };
      }

      return {
        success: false,
        error: 'Unable to load conductor settings',
        code: 'SETTINGS_READ_ERROR',
      };
    }

    return {
      success: false,
      error: 'Unable to process conductor turn',
    };
  }

  const result = outcome.right;
  if (result._tag === 'CircuitBreakerStopped') {
    return {
      success: false,
      error: result.message,
      code: 'CIRCUIT_BREAKER',
    };
  }

  if (result._tag === 'WaitForUser') {
    return {
      success: true,
      action: 'WAIT_FOR_USER',
      reasoning: result.reasoning,
      blackboardUpdate: result.blackboardUpdate,
      ...(result.suggestedPersonaId
        ? {
            suggestedPersonaId: result.suggestedPersonaId,
            isInterventionSuggestion: result.isInterventionSuggestion,
          }
        : {}),
    };
  }

  return {
    success: true,
    action: 'TRIGGER_PERSONA',
    personaId: result.personaId,
    reasoning: result.reasoning,
    blackboardUpdate: result.blackboardUpdate,
    isIntervention: result.isIntervention,
    autoReplyCount: result.autoReplyCount,
    warning: result.warning,
  };
};
