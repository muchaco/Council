import { Effect, Either } from 'effect';

import { decideAssignSessionTag } from '../../../core/decision/decide-assign-session-tag';
import type { SessionTagCatalogEntry } from '../../../core/domain/session-tags';
import type { DomainError } from '../../../core/errors/domain-error';
import {
  SessionTagPersistence,
  type SessionTagInfrastructureError,
} from './session-tag-persistence-service';

export interface ExecuteAssignSessionTagInput {
  readonly sessionId: string;
  readonly requestedTagName: string;
  readonly assignedTagNames: readonly string[];
  readonly availableTags: readonly SessionTagCatalogEntry[];
}

export interface ExecuteAssignSessionTagResult {
  readonly normalizedTagName: string;
  readonly nextAssignedTagNames: readonly string[];
  readonly createdTag: SessionTagCatalogEntry | null;
}

export type SessionTagUseCaseError = DomainError | SessionTagInfrastructureError;

export const executeAssignSessionTag = (
  input: ExecuteAssignSessionTagInput
): Effect.Effect<ExecuteAssignSessionTagResult, SessionTagUseCaseError, SessionTagPersistence> =>
  Effect.gen(function* () {
    const persistence = yield* SessionTagPersistence;
    const decision = decideAssignSessionTag(
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
    let ensuredCatalogEntry: SessionTagCatalogEntry | null = null;
    let catalogEntryToAddToStore: SessionTagCatalogEntry | null = null;

    for (const plannedEffect of plan.effects) {
      switch (plannedEffect._tag) {
        case 'EnsureSessionTagCatalogEntry': {
          const existingCatalogEntry = input.availableTags.find(
            (availableTag) => availableTag.name.toLowerCase() === plannedEffect.normalizedTagName
          );

          ensuredCatalogEntry =
            existingCatalogEntry ??
            (yield* persistence.getTagByName(plannedEffect.normalizedTagName).pipe(
              Effect.flatMap((catalogEntry) =>
                catalogEntry ? Effect.succeed(catalogEntry) : persistence.createTag(plannedEffect.normalizedTagName)
              )
            ));

          if (!existingCatalogEntry) {
            catalogEntryToAddToStore = ensuredCatalogEntry;
          }
          break;
        }

        case 'PersistSessionTagAssignment': {
          if (ensuredCatalogEntry === null) {
            return yield* Effect.fail({
              _tag: 'SessionTagNotInCatalogError',
              message: 'Tag not found',
            } satisfies DomainError);
          }

          yield* persistence.addTagToSession(plannedEffect.sessionId, ensuredCatalogEntry.id);
          break;
        }

        default: {
          const _exhaustive: never = plannedEffect;
          return _exhaustive;
        }
      }
    }

    return {
      normalizedTagName: plan.normalizedTagName,
      nextAssignedTagNames: plan.nextAssignedTagNames,
      createdTag: catalogEntryToAddToStore,
    };
  });
