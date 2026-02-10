import { describe, expect, it } from 'vitest';

import { decideSelectorFollowUpEffects } from './decide-selector-follow-up-effects';

describe('decide_selector_follow_up_effects_spec', () => {
  it.each([
    {
      name: 'plans_blackboard_merge_when_patch_is_present',
      input: {
        currentBlackboard: {
          consensus: 'old',
          conflicts: '',
          nextStep: '',
          facts: '',
        },
        updateBlackboard: { consensus: 'new' },
        isIntervention: false,
        interventionMessage: undefined,
        selectorReasoning: 'reason',
      },
      expectedTags: ['MergeBlackboard'],
    },
    {
      name: 'plans_intervention_message_when_intervention_has_message',
      input: {
        currentBlackboard: {
          consensus: '',
          conflicts: '',
          nextStep: '',
          facts: '',
        },
        updateBlackboard: {},
        isIntervention: true,
        interventionMessage: 'Steer back to goal',
        selectorReasoning: 'drift detected',
      },
      expectedTags: ['RecordInterventionMessage'],
    },
    {
      name: 'plans_both_effects_when_patch_and_intervention_exist',
      input: {
        currentBlackboard: {
          consensus: '',
          conflicts: '',
          nextStep: '',
          facts: '',
        },
        updateBlackboard: { nextStep: 'Implement API' },
        isIntervention: true,
        interventionMessage: 'Confirm assumptions',
        selectorReasoning: 'needs clarification',
      },
      expectedTags: ['MergeBlackboard', 'RecordInterventionMessage'],
    },
  ])('$name', ({ input, expectedTags }) => {
    const effects = decideSelectorFollowUpEffects(input);
    expect(effects.map((effect) => effect._tag)).toEqual(expectedTags);
  });
});
