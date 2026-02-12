import { describe, expect, it } from 'vitest';
import { Either } from 'effect';

import { decideNextAction } from './decide-next-action';

describe('decide_next_action_spec', () => {
  it('returns_wait_for_user_action_when_selector_requests_wait', () => {
    const decision = decideNextAction({
      selectedPersonaId: 'WAIT_FOR_USER',
      reasoning: 'Need user confirmation before proceeding',
      isIntervention: false,
      knownPersonaIds: ['speaker-a', 'speaker-b'],
      controlMode: 'automatic',
    });

    expect(Either.isRight(decision)).toBe(true);

    if (Either.isRight(decision)) {
      expect(decision.right).toEqual({
        _tag: 'WaitForUser',
        reasoning: 'Need user confirmation before proceeding',
      });
    }
  });

  it('returns_trigger_persona_action_when_selector_chooses_known_persona', () => {
    const decision = decideNextAction({
      selectedPersonaId: 'speaker-a',
      reasoning: 'Architect should resolve the open conflict',
      isIntervention: true,
      knownPersonaIds: ['speaker-a', 'speaker-b'],
      controlMode: 'automatic',
    });

    expect(Either.isRight(decision)).toBe(true);

    if (Either.isRight(decision)) {
      expect(decision.right).toEqual({
        _tag: 'TriggerPersona',
        personaId: 'speaker-a',
        reasoning: 'Architect should resolve the open conflict',
        isIntervention: true,
      });
    }
  });

  it('returns_suggest_persona_and_wait_action_in_manual_mode', () => {
    const decision = decideNextAction({
      selectedPersonaId: 'speaker-a',
      reasoning: 'Architect should resolve the open conflict',
      isIntervention: false,
      knownPersonaIds: ['speaker-a', 'speaker-b'],
      controlMode: 'manual',
    });

    expect(Either.isRight(decision)).toBe(true);

    if (Either.isRight(decision)) {
      expect(decision.right).toEqual({
        _tag: 'SuggestPersonaAndWaitForUser',
        personaId: 'speaker-a',
        reasoning: 'Architect should resolve the open conflict',
        isIntervention: false,
      });
    }
  });

  it('returns_domain_error_when_selector_chooses_missing_persona', () => {
    const decision = decideNextAction({
      selectedPersonaId: 'speaker-missing',
      reasoning: 'Missing speaker',
      isIntervention: false,
      knownPersonaIds: ['speaker-a'],
      controlMode: 'automatic',
    });

    expect(Either.isLeft(decision)).toBe(true);

    if (Either.isLeft(decision)) {
      expect(decision.left).toEqual({
        _tag: 'ConductorSelectedPersonaNotFoundError',
        message: 'Selected persona speaker-missing not found',
      });
    }
  });
});
