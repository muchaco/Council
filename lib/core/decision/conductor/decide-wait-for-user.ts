import { Option } from 'effect';

import type { SpeakerEligibilityPlan, WaitForUserPlan } from '../../plan/conductor-plan';
import { noEligibleSpeakerReasoning } from '../../plan/conductor-plan';

export const decideWaitForUser = (
  speakerEligibility: SpeakerEligibilityPlan
): Option.Option<WaitForUserPlan> =>
  speakerEligibility.eligibleSpeakers.length === 0
    ? Option.some({
        _tag: 'WaitForUser',
        reasoning: noEligibleSpeakerReasoning,
      })
    : Option.none();
