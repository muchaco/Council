import { describe, expect, it } from 'vitest';
import { Either } from 'effect';

import type {
  CouncilChatMessageSnapshot,
  CouncilChatPersonaSnapshot,
  CouncilChatRequest,
} from '../../domain/council-chat';
import { prepareCouncilPersonaTurnPrompt } from './prepare-council-persona-turn-prompt';

const request: CouncilChatRequest = {
  personaId: 'persona-1',
  sessionId: 'session-1',
  model: 'gemini-1.5-pro',
  systemPrompt: 'Be concise.',
  hiddenAgenda: 'Push toward phased rollout.',
  verbosity: '2 short paragraphs',
  temperature: 0.6,
  problemContext: 'We need a migration sequence.',
  outputGoal: 'Produce a rollout recommendation',
  blackboard: {
    consensus: 'Need parity first',
    conflicts: 'Timing trade-offs',
    nextStep: 'Define phase owners',
    facts: 'Phase 1 and 2 shipped',
  },
  otherPersonas: [
    { id: 'persona-2', name: 'Architect', role: 'Architecture Lead' },
    { id: 'persona-3', name: 'PM', role: 'Product Manager' },
  ],
};

const personas: readonly CouncilChatPersonaSnapshot[] = [
  { id: 'persona-1', name: 'Operator', role: 'Migration Operator' },
  { id: 'persona-2', name: 'Architect', role: 'Architecture Lead' },
];

const recentMessages: readonly CouncilChatMessageSnapshot[] = [
  { personaId: null, content: 'Can we keep handler behavior unchanged?' },
  { personaId: 'persona-2', content: 'Yes, by preserving shell contracts.' },
];

describe('prepare_council_persona_turn_prompt_spec', () => {
  it('builds_model_history_and_turn_prompt_using_council_language', () => {
    const decision = prepareCouncilPersonaTurnPrompt(request, personas, recentMessages);

    expect(Either.isRight(decision)).toBe(true);
    if (Either.isRight(decision)) {
      expect(decision.right.enhancedSystemPrompt).toContain('Push toward phased rollout.');
      expect(decision.right.enhancedSystemPrompt).toContain('VERBOSITY INSTRUCTION: 2 short paragraphs');
      expect(decision.right.chatHistory).toEqual([
        { role: 'user', parts: [{ text: 'User: Can we keep handler behavior unchanged?' }] },
        { role: 'user', parts: [{ text: 'Architect: Yes, by preserving shell contracts.' }] },
      ]);
      expect(decision.right.turnPrompt).toContain('You are Operator, a member of a multi-agent Council');
      expect(decision.right.turnPrompt).toContain('FELLOW COUNCIL MEMBERS:');
      expect(decision.right.turnPrompt).toContain('- Architect (Architecture Lead)');
      expect(decision.right.turnPrompt).toContain('[Turn 2] Architect (Architecture Lead): Yes, by preserving shell contracts.');
    }
  });

  it('returns_domain_error_when_request_persona_is_not_part_of_session', () => {
    const decision = prepareCouncilPersonaTurnPrompt(
      { ...request, personaId: 'missing' },
      personas,
      recentMessages
    );

    expect(Either.isLeft(decision)).toBe(true);
    if (Either.isLeft(decision)) {
      expect(decision.left).toEqual({
        _tag: 'CouncilChatPersonaNotFoundError',
        message: 'Persona not found in session',
      });
    }
  });
});
