import { Either } from 'effect';

import type { SessionTagPolicy } from '../domain/session-tags';
import { defaultSessionTagPolicy } from '../domain/session-tags';
import type { DomainError } from '../errors/domain-error';

const normalizeSessionTagName = (rawTagName: string): string => rawTagName.trim().toLowerCase();

export interface ValidatedSessionTagRequestList {
  readonly normalizedTagNames: readonly string[];
}

export const decideValidateSessionTagRequestList = (
  requestedTagNames: readonly string[],
  policy: SessionTagPolicy = defaultSessionTagPolicy
): Either.Either<ValidatedSessionTagRequestList, DomainError> => {
  if (requestedTagNames.length > policy.maxTagsPerSession) {
    return Either.left({
      _tag: 'SessionTagLimitReachedError',
      message: `Maximum ${policy.maxTagsPerSession} tags allowed per session`,
    });
  }

  const normalizedTagNames: string[] = [];

  for (const requestedTagName of requestedTagNames) {
    const normalizedTagName = normalizeSessionTagName(requestedTagName);

    if (!normalizedTagName) {
      return Either.left({
        _tag: 'SessionTagNameEmptyError',
        message: 'Tag cannot be empty',
      });
    }

    if (normalizedTagName.length > policy.maxTagLength) {
      return Either.left({
        _tag: 'SessionTagNameTooLongError',
        message: `Tag must be ${policy.maxTagLength} characters or less`,
      });
    }

    if (normalizedTagNames.includes(normalizedTagName)) {
      return Either.left({
        _tag: 'SessionTagAlreadyAssignedError',
        message: 'Tag already exists',
      });
    }

    normalizedTagNames.push(normalizedTagName);
  }

  return Either.right({ normalizedTagNames });
};
