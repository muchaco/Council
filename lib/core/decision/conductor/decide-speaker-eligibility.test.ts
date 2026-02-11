import { describe, expect, it } from 'vitest';

import { decideSpeakerEligibility } from './decide-speaker-eligibility';

describe('decide_speaker_eligibility_spec', () => {
  const personas = [
    {
      id: 'conductor',
      name: 'Conductor',
      role: 'System',
      geminiModel: 'gemini-1.5-flash',
      hushTurnsRemaining: 0,
    },
    {
      id: 'speaker-a',
      name: 'Architect',
      role: 'Architecture',
      geminiModel: 'gemini-1.5-pro',
      hushTurnsRemaining: 0,
    },
    {
      id: 'speaker-b',
      name: 'Analyst',
      role: 'Analysis',
      geminiModel: 'gemini-1.5-pro',
      hushTurnsRemaining: 0,
    },
  ] as const;

  it.each([
    {
      name: 'excludes_last_speaker_when_not_muted',
      overrides: {
        'speaker-a': 0,
        'speaker-b': 0,
      },
      lastSpeakerId: 'speaker-b',
      expectedEligibleIds: ['speaker-a'],
      expectedMutedIds: [],
    },
    {
      name: 'excludes_muted_speakers_and_includes_others',
      overrides: {
        'speaker-a': 2,
        'speaker-b': 0,
      },
      lastSpeakerId: null,
      expectedEligibleIds: ['speaker-b'],
      expectedMutedIds: ['speaker-a'],
    },
    {
      name: 'returns_no_eligible_speakers_when_only_non_conductor_is_last_or_muted',
      overrides: {
        'speaker-a': 1,
        'speaker-b': 0,
      },
      lastSpeakerId: 'speaker-b',
      expectedEligibleIds: [],
      expectedMutedIds: ['speaker-a'],
    },
  ])('$name', ({ overrides, lastSpeakerId, expectedEligibleIds, expectedMutedIds }) => {
    const eligibility = decideSpeakerEligibility({
      personas: personas.map((persona) => ({
        ...persona,
        hushTurnsRemaining: overrides[persona.id as keyof typeof overrides] ?? 0,
      })),
      conductorPersonaId: 'conductor',
      lastSpeakerId,
    });

    expect(eligibility.eligibleSpeakers.map((speaker) => speaker.id)).toEqual(expectedEligibleIds);
    expect(eligibility.mutedSpeakers.map((speaker) => speaker.id)).toEqual(expectedMutedIds);
  });
});
