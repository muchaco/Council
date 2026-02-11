import { describe, expect, it } from 'vitest';
import { Either } from 'effect';

import type { ConductorBlackboard, ConductorSelectorDecision } from '../../domain/conductor';
import { decideConductorTurnOutcomePlan } from './decide-conductor-turn-outcome';

const baseBlackboard: ConductorBlackboard = {
  consensus: '',
  conflicts: '',
  nextStep: '',
  facts: '',
};

describe('decide_conductor_turn_outcome_plan_spec', () => {
  it.each([
    {
      name: 'returns_wait_for_user_outcome_when_selector_requests_wait',
      selectorResult: {
        selectedPersonaId: 'WAIT_FOR_USER',
        reasoning: 'Need user direction before continuing.',
        isIntervention: false,
        updateBlackboard: { nextStep: 'Await user input' },
      } satisfies ConductorSelectorDecision,
      knownPersonaIds: ['speaker-a'],
      expectedTag: 'WaitForUserAfterSelection',
    },
    {
      name: 'returns_trigger_persona_outcome_with_follow_up_effects',
      selectorResult: {
        selectedPersonaId: 'speaker-a',
        reasoning: 'Architect should define rollout boundaries.',
        isIntervention: true,
        interventionMessage: 'Refocus on migration risk gates.',
        updateBlackboard: { nextStep: 'Define migration risk gates' },
      } satisfies ConductorSelectorDecision,
      knownPersonaIds: ['speaker-a'],
      expectedTag: 'TriggerPersonaAfterSelection',
    },
    {
      name: 'fails_when_selector_returns_unknown_persona',
      selectorResult: {
        selectedPersonaId: 'unknown-speaker',
        reasoning: 'unknown persona selected',
        isIntervention: false,
        updateBlackboard: {},
      } satisfies ConductorSelectorDecision,
      knownPersonaIds: ['speaker-a'],
      expectedLeft: {
        _tag: 'ConductorSelectedPersonaNotFoundError',
        message: 'Selected persona unknown-speaker not found',
      },
    },
  ])('$name', ({ selectorResult, knownPersonaIds, expectedTag, expectedLeft }) => {
    const outcome = decideConductorTurnOutcomePlan({
      currentBlackboard: baseBlackboard,
      selectorResult,
      knownPersonaIds,
    });

    if (expectedLeft) {
      expect(Either.isLeft(outcome)).toBe(true);
      if (Either.isLeft(outcome)) {
        expect(outcome.left).toEqual(expectedLeft);
      }
      return;
    }

    expect(Either.isRight(outcome)).toBe(true);
    if (Either.isRight(outcome)) {
      expect(outcome.right._tag).toBe(expectedTag);
      if (outcome.right._tag === 'TriggerPersonaAfterSelection') {
        expect(outcome.right.followUpEffects.map((effect) => effect._tag)).toEqual([
          'MergeBlackboard',
          'RecordInterventionMessage',
        ]);
      }
    }
  });
});
