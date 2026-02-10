import { Either } from 'effect';

import type {
  AssignSessionTagCommand,
  SessionTagDecisionContext,
  SessionTagPolicy,
} from '../domain/session-tags';
import { defaultSessionTagPolicy } from '../domain/session-tags';
import type { DomainError } from '../errors/domain-error';
import type { AssignSessionTagPlan } from '../plan/session-tags-plan';

const normalizeSessionTagName = (rawTagName: string): string => rawTagName.trim().toLowerCase();

export const decideAssignSessionTag = (
  command: AssignSessionTagCommand,
  context: SessionTagDecisionContext,
  policy: SessionTagPolicy = defaultSessionTagPolicy
): Either.Either<AssignSessionTagPlan, DomainError> => {
  if (!context.sessionId) {
    return Either.left({
      _tag: 'SessionNotFoundError',
      message: 'Session not found',
    });
  }

  const normalizedTagName = normalizeSessionTagName(command.requestedTagName);

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

  const isTagAlreadyAssigned = context.assignedTagNames.some(
    (assignedTagName) => assignedTagName.toLowerCase() === normalizedTagName
  );

  if (isTagAlreadyAssigned) {
    return Either.left({
      _tag: 'SessionTagAlreadyAssignedError',
      message: 'Tag already exists',
    });
  }

  if (context.assignedTagNames.length >= policy.maxTagsPerSession) {
    return Either.left({
      _tag: 'SessionTagLimitReachedError',
      message: `Maximum ${policy.maxTagsPerSession} tags allowed per session`,
    });
  }

  const nextAssignedTagNames = [...context.assignedTagNames, normalizedTagName];

  return Either.right({
    normalizedTagName,
    nextAssignedTagNames,
    effects: [
      {
        _tag: 'EnsureSessionTagCatalogEntry',
        normalizedTagName,
      },
      {
        _tag: 'PersistSessionTagAssignment',
        sessionId: context.sessionId,
        normalizedTagName,
      },
    ],
  });
};
