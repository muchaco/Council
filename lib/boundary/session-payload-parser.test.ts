import { describe, expect, it } from 'vitest';

import { parseSessionPayload, parseSessionPayloadList } from './session-payload-parser';

const validSessionPayload = {
  id: 'session-1',
  title: 'Session title',
  problemDescription: 'Problem',
  outputGoal: 'Goal',
  status: 'active',
  tokenCount: 42,
  costEstimate: 1.25,
  conductorEnabled: true,
  conductorPersonaId: 'persona-1',
  blackboard: {
    consensus: '',
    conflicts: '',
    nextStep: '',
    facts: '',
  },
  autoReplyCount: 3,
  tokenBudget: 10000,
  summary: null,
  archivedAt: null,
  tags: ['alpha', 'beta'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('session payload parser', () => {
  it('parses_session_with_valid_tags', () => {
    const parsed = parseSessionPayload(validSessionPayload);

    expect(parsed).not.toBeNull();
    expect(parsed?.tags).toEqual(['alpha', 'beta']);
  });

  it('rejects_missing_tags_in_strict_mode', () => {
    const payloadWithoutTags = { ...validSessionPayload };
    delete (payloadWithoutTags as { tags?: unknown }).tags;

    const parsed = parseSessionPayload(payloadWithoutTags);

    expect(parsed).toBeNull();
  });

  it('uses_fallback_tags_when_missing_tags_are_allowed', () => {
    const payloadWithoutTags = { ...validSessionPayload };
    delete (payloadWithoutTags as { tags?: unknown }).tags;

    const parsed = parseSessionPayload(payloadWithoutTags, {
      allowMissingTags: true,
      fallbackTags: ['fallback-tag'],
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.tags).toEqual(['fallback-tag']);
  });

  it('parses_list_with_consistent_rules', () => {
    const payloadWithoutTags = { ...validSessionPayload };
    delete (payloadWithoutTags as { tags?: unknown }).tags;

    const parsed = parseSessionPayloadList([payloadWithoutTags], {
      allowMissingTags: true,
      fallbackTags: [],
    });

    expect(parsed).toEqual([
      {
        ...payloadWithoutTags,
        tags: [],
      },
    ]);
  });
});
