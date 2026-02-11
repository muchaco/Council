import { describe, expect, it } from 'vitest';

import { Either } from 'effect';

import { decideValidateSessionTagRequestList } from './decide-validate-session-tag-request-list';

describe('decide_validate_session_tag_request_list_spec', () => {
  it('normalizes_valid_requested_tags', () => {
    const outcome = decideValidateSessionTagRequestList([' Feature ', 'Bug-Fix']);

    expect(Either.isRight(outcome)).toBe(true);
    if (Either.isRight(outcome)) {
      expect(outcome.right.normalizedTagNames).toEqual(['feature', 'bug-fix']);
    }
  });

  it('fails_when_requested_tag_count_exceeds_limit', () => {
    const outcome = decideValidateSessionTagRequestList(['a', 'b', 'c', 'd']);

    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left._tag).toBe('SessionTagLimitReachedError');
    }
  });

  it('fails_when_any_requested_tag_is_empty_after_trim', () => {
    const outcome = decideValidateSessionTagRequestList(['feature', '   ']);

    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left._tag).toBe('SessionTagNameEmptyError');
    }
  });

  it('fails_when_any_requested_tag_exceeds_max_length_after_normalization', () => {
    const tooLongTag = 'a'.repeat(21);
    const outcome = decideValidateSessionTagRequestList([tooLongTag]);

    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left._tag).toBe('SessionTagNameTooLongError');
    }
  });

  it('fails_on_duplicate_requested_tags_case_insensitively', () => {
    const outcome = decideValidateSessionTagRequestList(['Bug', 'bug']);

    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left._tag).toBe('SessionTagAlreadyAssignedError');
    }
  });

  it('accepts_requested_tag_count_at_exact_policy_boundary', () => {
    const outcome = decideValidateSessionTagRequestList(['a', 'b', 'c']);

    expect(Either.isRight(outcome)).toBe(true);
    if (Either.isRight(outcome)) {
      expect(outcome.right.normalizedTagNames).toEqual(['a', 'b', 'c']);
    }
  });

  it('normalizes_whitespace_and_case_before_duplicate_detection', () => {
    const outcome = decideValidateSessionTagRequestList([' Feature ', 'feature']);

    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left._tag).toBe('SessionTagAlreadyAssignedError');
    }
  });
});
