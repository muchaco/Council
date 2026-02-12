import { describe, expect, it } from 'vitest';

import { decideConductorTurnShellPlan } from './conductor-turn-shell-plan';

describe('conductor_turn_shell_plan_spec', () => {
  it('maps_circuit_breaker_failure_to_blocked_state', () => {
    const plan = decideConductorTurnShellPlan({
      success: false,
      code: 'CIRCUIT_BREAKER',
      error: 'Circuit breaker triggered',
    });

    expect(plan).toEqual({
      _tag: 'Failure',
      statePatch: { conductorFlowState: 'blocked' },
      toast: { level: 'warning', message: 'Circuit breaker triggered' },
      blackboardUpdate: {},
    });
  });

  it('maps_settings_failure_to_blocked_state', () => {
    const plan = decideConductorTurnShellPlan({
      success: false,
      code: 'API_KEY_NOT_CONFIGURED',
      error: 'API key not configured',
    });

    expect(plan).toEqual({
      _tag: 'Failure',
      statePatch: { conductorFlowState: 'blocked' },
      toast: { level: 'error', message: 'API key not configured' },
      blackboardUpdate: {},
    });
  });

  it('maps_selector_agent_error_to_blocked_state', () => {
    const plan = decideConductorTurnShellPlan({
      success: false,
      code: 'SELECTOR_AGENT_ERROR',
      error: 'Selector agent error',
    });

    expect(plan).toEqual({
      _tag: 'Failure',
      statePatch: { conductorFlowState: 'blocked' },
      toast: { level: 'error', message: 'Selector agent error' },
      blackboardUpdate: {},
    });
  });

  it('maps_wait_for_user_to_awaiting_input_state', () => {
    const plan = decideConductorTurnShellPlan({
      success: true,
      action: 'WAIT_FOR_USER',
      blackboardUpdate: {
        nextStep: 'Collect more user context',
      },
      reasoning: 'Need additional information',
    });

    expect(plan).toEqual({
      _tag: 'WaitForUser',
      statePatch: { conductorFlowState: 'awaiting_input' },
      toast: { level: 'info', message: 'Conductor waiting for user input' },
      blackboardUpdate: { nextStep: 'Collect more user context' },
      warning: undefined,
    });
  });

  it('preserves_manual_suggestion_fields_in_wait_for_user_plan', () => {
    const plan = decideConductorTurnShellPlan({
      success: true,
      action: 'WAIT_FOR_USER',
      blackboardUpdate: { nextStep: 'Ask architect to propose a rollout' },
      reasoning: 'Architect should speak next',
      suggestedPersonaId: 'persona-architect',
      isInterventionSuggestion: true,
    });

    expect(plan).toEqual({
      _tag: 'WaitForUser',
      statePatch: { conductorFlowState: 'awaiting_input' },
      toast: { level: 'info', message: 'Conductor waiting for user input' },
      blackboardUpdate: { nextStep: 'Ask architect to propose a rollout' },
      suggestedPersonaId: 'persona-architect',
      isInterventionSuggestion: true,
      warning: undefined,
    });
  });

  it('maps_trigger_persona_to_trigger_plan', () => {
    const plan = decideConductorTurnShellPlan({
      success: true,
      action: 'TRIGGER_PERSONA',
      personaId: 'persona-42',
      reasoning: 'High confidence match',
      blackboardUpdate: {},
      isIntervention: false,
      autoReplyCount: 3,
      warning: 'Low confidence selector result',
    });

    expect(plan).toEqual({
      _tag: 'TriggerPersona',
      personaId: 'persona-42',
      blackboardUpdate: {},
      warning: 'Low confidence selector result',
    });
  });
});
