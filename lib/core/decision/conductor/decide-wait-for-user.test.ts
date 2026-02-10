import { describe, expect, it } from 'vitest';
import { Option } from 'effect';

import { decideWaitForUser } from './decide-wait-for-user';

describe('decide_wait_for_user_spec', () => {
  it('returns_wait_for_user_when_no_eligible_speakers_remain', () => {
    const decision = decideWaitForUser({
      lastSpeakerId: 'speaker-a',
      eligibleSpeakers: [],
      mutedSpeakers: [],
    });

    expect(Option.isSome(decision)).toBe(true);

    if (Option.isSome(decision)) {
      expect(decision.value).toEqual({
        _tag: 'WaitForUser',
        reasoning: 'All personas have spoken. Waiting for user input before next cycle.',
      });
    }
  });

  it('returns_none_when_eligible_speakers_exist', () => {
    const decision = decideWaitForUser({
      lastSpeakerId: null,
      eligibleSpeakers: [{ id: 'speaker-a', name: 'Architect', role: 'Architecture' }],
      mutedSpeakers: [],
    });

    expect(Option.isNone(decision)).toBe(true);
  });
});
