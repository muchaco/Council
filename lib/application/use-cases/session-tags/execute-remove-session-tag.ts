import { Effect, Either } from 'effect';

import { decideRemoveSessionTag } from '../../../core/decision/decide-remove-session-tag';
import type { SessionTagCatalogEntry } from '../../../core/domain/session-tags';
import type { DomainError } from '../../../core/errors/domain-error';
import {
  SessionTagPersistence,
  type SessionTagInfrastructureError,
} from './session-tag-persistence-service';

export interface ExecuteRemoveSessionTagInput {
  readonly sessionId: string;
  readonly requestedTagName: string;
  readonly assignedTagNames: readonly string[];
  readonly availableTags: readonly SessionTagCatalogEntry[];
}

export interface ExecuteRemoveSessionTagResult {
  readonly normalizedTagName: string;
  readonly nextAssignedTagNames: readonly string[];
  readonly refreshedTagCatalog: readonly SessionTagCatalogEntry[] | null;
}

export type SessionTagRemovalUseCaseError = DomainError | SessionTagInfrastructureError;

export const executeRemoveSessionTag = (
  input: ExecuteRemoveSessionTagInput
): Effect.Effect<ExecuteRemoveSessionTagResult, SessionTagRemovalUseCaseError, SessionTagPersistence> =>
  Effect.gen(function* () {
    const persistence = yield* SessionTagPersistence;
    const decision = decideRemoveSessionTag(
      { requestedTagName: input.requestedTagName },
      {
        sessionId: input.sessionId,
        assignedTagNames: input.assignedTagNames,
        availableTagNames: input.availableTags.map((availableTag) => availableTag.name),
      }
    );

    if (Either.isLeft(decision)) {
      return yield* Effect.fail(decision.left);
    }

    const plan = decision.right;
    const matchedTag = input.availableTags.find(
      (availableTag) => availableTag.name === plan.normalizedTagName
    );

    if (!matchedTag) {
      return yield* Effect.fail({
        _tag: 'SessionTagNotInCatalogError',
        message: 'Tag not found',
      } satisfies DomainError);
    }

    yield* persistence.removeTagFromSession(input.sessionId, matchedTag.id);

    const refreshedTagCatalog = yield* Effect.gen(function* () {
      yield* persistence.cleanupOrphanedTags();
      return yield* persistence.getAllTags();
    }).pipe(Effect.catchAll(() => Effect.succeed<readonly SessionTagCatalogEntry[] | null>(null)));

    return {
      normalizedTagName: plan.normalizedTagName,
      nextAssignedTagNames: plan.nextAssignedTagNames,
      refreshedTagCatalog,
    };
  });
