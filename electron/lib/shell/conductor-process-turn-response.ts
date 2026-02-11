import { Either, type Either as EitherType } from 'effect';

import type {
  ConductorTurnUseCaseError,
  ExecuteConductorTurnResult,
} from '../../../lib/application/use-cases/conductor';
import type { ConductorBlackboard } from '../../../lib/core/domain/conductor';

export type ConductorProcessTurnResponse =
  | {
      readonly success: false;
      readonly error: string;
      readonly code?:
        | 'SELECTOR_AGENT_ERROR'
        | 'API_KEY_NOT_CONFIGURED'
        | 'API_KEY_DECRYPT_FAILED'
        | 'SETTINGS_READ_ERROR'
        | 'CIRCUIT_BREAKER';
    }
  | {
      readonly success: true;
      readonly action: 'WAIT_FOR_USER';
      readonly reasoning: string;
      readonly blackboardUpdate: Partial<ConductorBlackboard>;
    }
  | {
      readonly success: true;
      readonly action: 'TRIGGER_PERSONA';
      readonly personaId: string;
      readonly reasoning: string;
      readonly blackboardUpdate: Partial<ConductorBlackboard>;
      readonly isIntervention: boolean;
      readonly autoReplyCount: number;
      readonly warning?: string;
    };

export const mapConductorTurnOutcomeToProcessTurnResponse = (
  outcome: EitherType.Either<ExecuteConductorTurnResult, ConductorTurnUseCaseError>
): ConductorProcessTurnResponse => {
  if (Either.isLeft(outcome)) {
    const error = outcome.left;

    if (error._tag === 'ConductorInfrastructureError' && error.source === 'selector') {
      return {
        success: false,
        error: error.message,
        code: 'SELECTOR_AGENT_ERROR',
      };
    }

    if (error._tag === 'ConductorInfrastructureError' && error.source === 'settings') {
      if (error.code === 'ApiKeyMissing') {
        return {
          success: false,
          error: error.message,
          code: 'API_KEY_NOT_CONFIGURED',
        };
      }

      if (error.code === 'ApiKeyDecryptFailed') {
        return {
          success: false,
          error: error.message,
          code: 'API_KEY_DECRYPT_FAILED',
        };
      }

      return {
        success: false,
        error: error.message,
        code: 'SETTINGS_READ_ERROR',
      };
    }

    return {
      success: false,
      error: error.message,
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
