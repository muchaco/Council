import { describe, expect, it } from 'vitest';
import { Either } from 'effect';

import { decideAssignSessionTag } from './decide-assign-session-tag';

describe('decide_assign_session_tag_spec', () => {
  it('returns_assignment_plan_for_valid_tag_request', () => {
    const decision = decideAssignSessionTag(
      { requestedTagName: '  New-Tag  ' },
      {
        sessionId: 'session-1',
        assignedTagNames: ['existing-tag'],
        availableTagNames: ['existing-tag'],
      }
    );

    expect(Either.isRight(decision)).toBe(true);

    if (Either.isRight(decision)) {
      expect(decision.right.normalizedTagName).toBe('new-tag');
      expect(decision.right.nextAssignedTagNames).toEqual(['existing-tag', 'new-tag']);
      expect(decision.right.effects).toEqual([
        {
          _tag: 'EnsureSessionTagCatalogEntry',
          normalizedTagName: 'new-tag',
        },
        {
          _tag: 'PersistSessionTagAssignment',
          sessionId: 'session-1',
          normalizedTagName: 'new-tag',
        },
      ]);
    }
  });

  it('rejects_invalid_assignment_requests_in_table_driven_cases', () => {
    const cases = [
      {
        name: 'empty_tag_name',
        requestedTagName: '   ',
        assignedTagNames: [] as readonly string[],
        expectedErrorTag: 'SessionTagNameEmptyError',
        expectedMessage: 'Tag cannot be empty',
      },
      {
        name: 'tag_name_exceeds_max_length',
        requestedTagName: 'a'.repeat(21),
        assignedTagNames: [] as readonly string[],
        expectedErrorTag: 'SessionTagNameTooLongError',
        expectedMessage: 'Tag must be 20 characters or less',
      },
      {
        name: 'tag_already_assigned_case_insensitive',
        requestedTagName: 'Feature',
        assignedTagNames: ['feature'] as readonly string[],
        expectedErrorTag: 'SessionTagAlreadyAssignedError',
        expectedMessage: 'Tag already exists',
      },
      {
        name: 'tag_limit_reached',
        requestedTagName: 'fourth',
        assignedTagNames: ['a', 'b', 'c'] as readonly string[],
        expectedErrorTag: 'SessionTagLimitReachedError',
        expectedMessage: 'Maximum 3 tags allowed per session',
      },
    ] as const;

    for (const testCase of cases) {
      const decision = decideAssignSessionTag(
        { requestedTagName: testCase.requestedTagName },
        {
          sessionId: 'session-1',
          assignedTagNames: testCase.assignedTagNames,
          availableTagNames: [],
        }
      );

      expect(Either.isLeft(decision), testCase.name).toBe(true);

      if (Either.isLeft(decision)) {
        expect(decision.left._tag, testCase.name).toBe(testCase.expectedErrorTag);
        expect(decision.left.message, testCase.name).toBe(testCase.expectedMessage);
      }
    }
  });
});
