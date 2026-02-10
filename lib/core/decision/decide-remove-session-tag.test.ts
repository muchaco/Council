import { describe, expect, it } from 'vitest';
import { Either } from 'effect';

import { decideRemoveSessionTag } from './decide-remove-session-tag';

describe('decide_remove_session_tag_spec', () => {
  it('returns_removal_plan_for_known_catalog_tag', () => {
    const decision = decideRemoveSessionTag(
      { requestedTagName: '  TAG-B  ' },
      {
        sessionId: 'session-1',
        assignedTagNames: ['tag-a', 'tag-b', 'tag-c'],
        availableTagNames: ['tag-a', 'tag-b', 'tag-c'],
      }
    );

    expect(Either.isRight(decision)).toBe(true);

    if (Either.isRight(decision)) {
      expect(decision.right.normalizedTagName).toBe('tag-b');
      expect(decision.right.nextAssignedTagNames).toEqual(['tag-a', 'tag-c']);
      expect(decision.right.effects).toEqual([
        {
          _tag: 'PersistSessionTagRemoval',
          sessionId: 'session-1',
          normalizedTagName: 'tag-b',
        },
        {
          _tag: 'CleanupOrphanedSessionTags',
        },
        {
          _tag: 'RefreshSessionTagCatalog',
        },
      ]);
    }
  });

  it('rejects_removal_when_tag_is_missing_from_catalog', () => {
    const decision = decideRemoveSessionTag(
      { requestedTagName: 'missing-tag' },
      {
        sessionId: 'session-1',
        assignedTagNames: ['tag-a'],
        availableTagNames: ['tag-a'],
      }
    );

    expect(Either.isLeft(decision)).toBe(true);

    if (Either.isLeft(decision)) {
      expect(decision.left).toEqual({
        _tag: 'SessionTagNotInCatalogError',
        message: 'Tag not found',
      });
    }
  });
});
