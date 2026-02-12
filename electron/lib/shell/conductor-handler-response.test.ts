import { describe, expect, it } from 'vitest';

import {
  mapBlackboardLookupResponse,
  mapErrorFailureResponse,
  mapVoidSuccessResponse,
} from './conductor-handler-response';

describe('conductor_handler_response_mapper_spec', () => {
  it('maps_void_success_response_shape', () => {
    expect(mapVoidSuccessResponse()).toEqual({ success: true });
  });

  it('maps_unknown_error_to_failure_response', () => {
    expect(mapErrorFailureResponse(new Error('boom'))).toEqual({
      success: false,
      error: 'Conductor operation failed',
    });
  });

  it('maps_missing_session_to_not_found_blackboard_response', () => {
    expect(mapBlackboardLookupResponse(null)).toEqual({
      success: false,
      error: 'Session not found',
    });
  });

  it('maps_null_blackboard_to_empty_blackboard_state', () => {
    expect(mapBlackboardLookupResponse({ blackboard: null })).toEqual({
      success: true,
      data: {
        consensus: '',
        conflicts: '',
        nextStep: '',
        facts: '',
      },
    });
  });
});
