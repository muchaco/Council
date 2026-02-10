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

  it('returns_domain_error_when_selector_chooses_missing_persona', () => {
    const decision = decideNextAction({
      selectedPersonaId: 'speaker-missing',
      reasoning: 'Missing speaker',
      isIntervention: false,
      knownPersonaIds: ['speaker-a'],
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
