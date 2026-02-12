import { describe, expect, it } from 'vitest';
import { Either } from 'effect';

import type {
  ConductorPersonaSnapshot,
  ConductorSessionSnapshot,
} from '../../domain/conductor';
import { decideConductorSelectorPlan } from './decide-conductor-selector-plan';

const baseSession: ConductorSessionSnapshot = {
  sessionId: 'session-1',
  conductorEnabled: true,
  controlMode: 'automatic',
  autoReplyCount: 0,
  tokenCount: 0,
  problemDescription: 'Ship FCIS migration safely',
  outputGoal: 'Phased rollout plan',
  blackboard: { consensus: '', conflicts: '', nextStep: '', facts: '' },
};

const basePersonas: readonly ConductorPersonaSnapshot[] = [
  {
    id: 'speaker-a',
    name: 'Architect',
    role: 'Architecture',
    geminiModel: 'gemini-1.5-pro',
    hushTurnsRemaining: 0,
  },
];

describe('decide_conductor_selector_plan_spec', () => {
  it.each([
    {
      name: 'fails_when_no_personas_exist',
      personas: [] as readonly ConductorPersonaSnapshot[],
      messages: [{ personaId: null, content: 'Start planning rollout.' }],
      expectedLeft: {
        _tag: 'ConductorNoPersonasError',
        message: 'No personas in session',
      },
    },
    {
      name: 'returns_wait_for_user_before_selection_when_no_eligible_speakers_remain',
      personas: [{ ...basePersonas[0], hushTurnsRemaining: 1 }] as readonly ConductorPersonaSnapshot[],
      messages: [{ personaId: 'speaker-a', content: 'Last response from Architect' }],
      expectedRightTag: 'WaitForUserBeforeSelection',
    },
    {
      name: 'returns_selector_request_plan_when_eligible_speaker_exists',
      personas: basePersonas,
      messages: [{ personaId: null, content: 'What should we do first?' }],
      expectedRightTag: 'RequestSelectorDecision',
    },
  ])('$name', ({ personas, messages, expectedLeft, expectedRightTag }) => {
    const outcome = decideConductorSelectorPlan({
      session: baseSession,
      personas,
      messages: messages.map((message) => ({
        source: message.personaId === null ? 'user' : 'persona',
        ...message,
      })),
      selectorModel: 'gemini-2.5-flash',
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
      expect(outcome.right._tag).toBe(expectedRightTag);
      if (outcome.right._tag === 'RequestSelectorDecision') {
        expect(outcome.right.selectorModel).toBe('gemini-2.5-flash');
        expect(outcome.right.selectorPromptInput.availablePersonas).toEqual([
          { id: 'speaker-a', name: 'Architect', role: 'Architecture' },
        ]);
      }
    }
  });
});
