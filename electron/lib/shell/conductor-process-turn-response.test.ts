import { describe, expect, it } from 'vitest';
import { Either } from 'effect';

import { mapConductorTurnOutcomeToProcessTurnResponse } from './conductor-process-turn-response';

describe('conductor_process_turn_response_mapper_spec', () => {
  it('maps_selector_error_to_selector_agent_code', () => {
    const response = mapConductorTurnOutcomeToProcessTurnResponse(
      Either.left({
        _tag: 'ConductorInfrastructureError',
        source: 'selector',
        code: 'ExecutionFailed',
        message: 'Selector timed out',
      })
    );

    expect(response).toEqual({
      success: false,
      error: 'Selector timed out',
      code: 'SELECTOR_AGENT_ERROR',
    });
  });

  it('maps_api_key_missing_to_settings_specific_code', () => {
    const response = mapConductorTurnOutcomeToProcessTurnResponse(
      Either.left({
        _tag: 'ConductorInfrastructureError',
        source: 'settings',
        code: 'ApiKeyMissing',
        message: 'API key not configured',
      })
    );

    expect(response).toEqual({
      success: false,
      error: 'API key not configured',
      code: 'API_KEY_NOT_CONFIGURED',
    });
  });

  it('maps_api_key_decrypt_failure_to_settings_specific_code', () => {
    const response = mapConductorTurnOutcomeToProcessTurnResponse(
      Either.left({
        _tag: 'ConductorInfrastructureError',
        source: 'settings',
        code: 'ApiKeyDecryptFailed',
        message: 'Unable to decrypt key',
      })
    );

    expect(response).toEqual({
      success: false,
      error: 'Unable to decrypt key',
      code: 'API_KEY_DECRYPT_FAILED',
    });
  });

  it('maps_settings_read_failures_to_settings_read_error_code', () => {
    const response = mapConductorTurnOutcomeToProcessTurnResponse(
      Either.left({
        _tag: 'ConductorInfrastructureError',
        source: 'settings',
        code: 'SettingsReadFailed',
        message: 'Settings store unavailable',
      })
    );

    expect(response).toEqual({
      success: false,
      error: 'Settings store unavailable',
      code: 'SETTINGS_READ_ERROR',
    });
  });

  it('maps_wait_for_user_success_response', () => {
    const response = mapConductorTurnOutcomeToProcessTurnResponse(
      Either.right({
        _tag: 'WaitForUser',
        reasoning: 'Need user clarification',
        blackboardUpdate: { nextStep: 'Await user clarification' },
      })
    );

    expect(response).toEqual({
      success: true,
      action: 'WAIT_FOR_USER',
      reasoning: 'Need user clarification',
      blackboardUpdate: { nextStep: 'Await user clarification' },
    });
  });
});
