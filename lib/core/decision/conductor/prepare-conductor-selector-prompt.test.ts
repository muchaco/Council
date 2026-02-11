import { describe, expect, it } from 'vitest';

import { prepareConductorSelectorPrompt } from './prepare-conductor-selector-prompt';

describe('prepare_conductor_selector_prompt_spec', () => {
  it('renders_selector_prompt_with_blackboard_and_persona_sections', () => {
    const prompt = prepareConductorSelectorPrompt({
      problemDescription: 'Stabilize migration',
      outputGoal: 'Deliver phased rollout plan',
      blackboard: {
        consensus: 'Need risk-first rollout',
        conflicts: 'Feature freeze timing',
        nextStep: 'Define rollback gates',
        facts: 'Current branch has pending refactors',
      },
      recentConversation: [
        { role: 'user', personaName: 'User', content: 'What is the first rollout constraint?' },
        { role: 'model', personaName: 'Architect', content: 'Start with bounded canary scope.' },
      ],
      availablePersonas: [
        { id: 'architect', name: 'Architect', role: 'Architecture' },
        { id: 'operator', name: 'Operator', role: 'Operations' },
      ],
      hushedPersonas: [{ id: 'researcher', name: 'Researcher', remainingTurns: 2 }],
      lastSpeakerId: 'architect',
    });

    expect(prompt).toContain('PROBLEM: Stabilize migration');
    expect(prompt).toContain('OUTPUT GOAL: Deliver phased rollout plan');
    expect(prompt).toContain('Consensus: Need risk-first rollout');
    expect(prompt).toContain('Architect: Start with bounded canary scope.');
    expect(prompt).toContain('HUSHED PERSONAS (temporarily muted):');
    expect(prompt).toContain('You CANNOT select the persona who spoke last: Architect');
  });
});
