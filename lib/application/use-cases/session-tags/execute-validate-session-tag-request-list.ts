import { Effect, Either } from 'effect';

import { decideValidateSessionTagRequestList } from '../../../core/decision';
import type { DomainError } from '../../../core/errors/domain-error';

export const executeValidateSessionTagRequestList = (
  requestedTagNames: readonly string[]
): Effect.Effect<readonly string[], DomainError> => {
  const outcome = decideValidateSessionTagRequestList(requestedTagNames);

  if (Either.isLeft(outcome)) {
    return Effect.fail(outcome.left);
  }

  return Effect.succeed(outcome.right.normalizedTagNames);
};
