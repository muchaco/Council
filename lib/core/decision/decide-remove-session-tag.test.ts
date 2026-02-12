import { describe, expect, it } from 'vitest';
import { Either } from 'effect';

import { decideRemoveSessionTag } from './decide-remove-session-tag';

describe('decide_remove_session_tag_spec', () => {
  it.each([
    {
      name: 'returns_removal_plan_for_known_catalog_tag',
      command: { requestedTagName: '  TAG-B  ' },
      context: {
        sessionId: 'session-1',
        assignedTagNames: ['tag-a', 'tag-b', 'tag-c'],
        availableTagNames: ['tag-a', 'tag-b', 'tag-c'],
      },
      expectRight: {
        normalizedTagName: 'tag-b',
        nextAssignedTagNames: ['tag-a', 'tag-c'],
      },
    },
    {
      name: 'removes_assigned_tag_case_insensitively_for_mixed_case_data',
      command: { requestedTagName: 'tag-b' },
      context: {
        sessionId: 'session-1',
        assignedTagNames: ['Tag-A', 'Tag-B'],
        availableTagNames: ['tag-a', 'tag-b'],
      },
      expectRight: {
        normalizedTagName: 'tag-b',
        nextAssignedTagNames: ['Tag-A'],
      },
    },
    {
      name: 'rejects_removal_when_session_is_missing',
      command: { requestedTagName: 'tag-a' },
      context: {
        sessionId: '',
        assignedTagNames: ['tag-a'],
        availableTagNames: ['tag-a'],
      },
      expectLeft: {
        _tag: 'SessionNotFoundError',
        message: 'Session not found',
      },
    },
    {
      name: 'rejects_removal_when_tag_is_missing_from_catalog',
      command: { requestedTagName: 'missing-tag' },
      context: {
        sessionId: 'session-1',
        assignedTagNames: ['tag-a'],
        availableTagNames: ['tag-a'],
      },
      expectLeft: {
        _tag: 'SessionTagNotInCatalogError',
        message: 'Tag not found',
      },
    },
    {
      name: 'rejects_removal_when_tag_exists_in_catalog_but_is_not_assigned',
      command: { requestedTagName: 'tag-b' },
      context: {
        sessionId: 'session-1',
        assignedTagNames: ['tag-a'],
        availableTagNames: ['tag-a', 'tag-b'],
      },
      expectLeft: {
        _tag: 'SessionTagNotAssignedError',
        message: 'Tag is not assigned to this session',
      },
    },
  ])('$name', ({ command, context, expectRight, expectLeft }) => {
    const decision = decideRemoveSessionTag(command, context);

    if (expectRight) {
      expect(Either.isRight(decision)).toBe(true);
      if (Either.isRight(decision)) {
        expect(decision.right.normalizedTagName).toBe(expectRight.normalizedTagName);
        expect(decision.right.nextAssignedTagNames).toEqual(expectRight.nextAssignedTagNames);
        expect(decision.right.effects).toEqual([
          {
            _tag: 'PersistSessionTagRemoval',
            sessionId: context.sessionId,
            normalizedTagName: expectRight.normalizedTagName,
          },
          {
            _tag: 'CleanupOrphanedSessionTags',
          },
          {
            _tag: 'RefreshSessionTagCatalog',
          },
        ]);
      }
      return;
    }

    expect(Either.isLeft(decision)).toBe(true);
    if (Either.isLeft(decision)) {
      expect(decision.left).toEqual(expectLeft);
    }
  });
});
