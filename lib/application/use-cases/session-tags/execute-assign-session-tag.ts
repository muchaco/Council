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
    const existingCatalogEntry = input.availableTags.find(
      (availableTag) => availableTag.name === plan.normalizedTagName
    );

    const ensuredCatalogEntry =
      existingCatalogEntry ??
      (yield* persistence.getTagByName(plan.normalizedTagName).pipe(
        Effect.flatMap((catalogEntry) =>
          catalogEntry ? Effect.succeed(catalogEntry) : persistence.createTag(plan.normalizedTagName)
        )
      ));

    const createdTag = existingCatalogEntry ? null : ensuredCatalogEntry;

    yield* persistence.addTagToSession(input.sessionId, ensuredCatalogEntry.id);

    return {
      normalizedTagName: plan.normalizedTagName,
      nextAssignedTagNames: plan.nextAssignedTagNames,
      createdTag,
    };
  });
