import type {
  ConductorPersonaSnapshot,
  EligibleSpeaker,
  MutedSpeaker,
} from '../../domain/conductor';
import type { SpeakerEligibilityPlan } from '../../plan/conductor-plan';

export interface DecideSpeakerEligibilityInput {
  readonly personas: readonly ConductorPersonaSnapshot[];
  readonly orchestratorPersonaId: string;
  readonly lastSpeakerId: string | null;
}

export const decideSpeakerEligibility = (
  input: DecideSpeakerEligibilityInput
): SpeakerEligibilityPlan => {
  const eligibleSpeakers: EligibleSpeaker[] = [];
  const mutedSpeakers: MutedSpeaker[] = [];

  for (const persona of input.personas) {
    if (persona.hushTurnsRemaining > 0) {
      mutedSpeakers.push({
        id: persona.id,
        name: persona.name,
        remainingTurns: persona.hushTurnsRemaining,
      });
      continue;
    }

    const isConductor = persona.id === input.orchestratorPersonaId;
    const isLastSpeaker = input.lastSpeakerId !== null && persona.id === input.lastSpeakerId;

    if (!isConductor && !isLastSpeaker) {
      eligibleSpeakers.push({
        id: persona.id,
        name: persona.name,
        role: persona.role,
      });
    }
  }

  return {
    lastSpeakerId: input.lastSpeakerId,
    eligibleSpeakers,
    mutedSpeakers,
  };
};
