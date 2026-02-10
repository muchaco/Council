import { Either } from 'effect';

import type { RemoveSessionTagCommand, SessionTagDecisionContext } from '../domain/session-tags';
import type { DomainError } from '../errors/domain-error';
import type { RemoveSessionTagPlan } from '../plan/session-tags-plan';

const normalizeSessionTagName = (rawTagName: string): string => rawTagName.trim().toLowerCase();

export const decideRemoveSessionTag = (
  command: RemoveSessionTagCommand,
  context: SessionTagDecisionContext
): Either.Either<RemoveSessionTagPlan, DomainError> => {
  if (!context.sessionId) {
    return Either.left({
      _tag: 'SessionNotFoundError',
      message: 'Session not found',
    });
  }

  const normalizedTagName = normalizeSessionTagName(command.requestedTagName);
  const tagExistsInCatalog = context.availableTagNames.some(
    (availableTagName) => availableTagName.toLowerCase() === normalizedTagName
  );

  if (!tagExistsInCatalog) {
    return Either.left({
      _tag: 'SessionTagNotInCatalogError',
      message: 'Tag not found',
    });
  }

  const tagIsAssignedToSession = context.assignedTagNames.some(
    (assignedTagName) => assignedTagName.toLowerCase() === normalizedTagName
  );

  if (!tagIsAssignedToSession) {
    return Either.left({
      _tag: 'SessionTagNotAssignedError',
      message: 'Tag is not assigned to this session',
    });
  }

  const nextAssignedTagNames = context.assignedTagNames.filter(
    (assignedTagName) => assignedTagName.toLowerCase() !== normalizedTagName
  );

  return Either.right({
    normalizedTagName,
    nextAssignedTagNames,
    effects: [
      {
        _tag: 'PersistSessionTagRemoval',
        sessionId: context.sessionId,
        normalizedTagName,
      },
      {
        _tag: 'CleanupOrphanedSessionTags',
      },
      {
        _tag: 'RefreshSessionTagCatalog',
      },
    ],
  });
};
