import { describe, expect, it } from 'vitest';

import { decideConductorTurnShellPlan } from './conductor-turn-shell-plan';

describe('conductor_turn_shell_plan_spec', () => {
  it('maps_circuit_breaker_failure_to_pause_warning_plan', () => {
    const plan = decideConductorTurnShellPlan({
      success: false,
      code: 'CIRCUIT_BREAKER',
      error: 'Circuit breaker triggered',
    });

    expect(plan).toEqual({
      _tag: 'Failure',
      statePatch: { conductorPaused: true },
      toast: { level: 'warning', message: 'Circuit breaker triggered' },
      blackboardUpdate: {},
    });
  });

  it('maps_settings_failure_to_stop_and_pause_plan', () => {
    const plan = decideConductorTurnShellPlan({
      success: false,
      code: 'API_KEY_NOT_CONFIGURED',
      error: 'API key not configured',
    });

    expect(plan).toEqual({
      _tag: 'Failure',
      statePatch: { conductorRunning: false, conductorPaused: true },
      toast: { level: 'error', message: 'API key not configured' },
      blackboardUpdate: {},
    });
  });

  it('maps_wait_for_user_to_info_plan_and_blackboard_patch', () => {
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
      statePatch: { conductorRunning: false },
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
      statePatch: { conductorRunning: false },
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
