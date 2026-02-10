import { Effect } from 'effect';

import type { Tag, TagInput } from '../../../types';
import {
  SessionTagCatalogRepository,
  type SessionTagCatalogInfrastructureError,
} from './session-tag-catalog-dependencies';

const nowIso = (): string => new Date().toISOString();

export const executeCreateSessionTagCatalogEntry = (
  input: TagInput
): Effect.Effect<Tag, SessionTagCatalogInfrastructureError, SessionTagCatalogRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionTagCatalogRepository;
    const createdAt = nowIso();

    yield* repository.createTag({ name: input.name, createdAt });
    const created = yield* repository.getTagByName(input.name);

    if (created === null) {
      return yield* Effect.fail({
        _tag: 'SessionTagCatalogInfrastructureError',
        source: 'repository',
        message: 'Tag not found after creation',
      } as const);
    }

    return created;
  });

export const executeLoadSessionTagByName = (
  name: string
): Effect.Effect<Tag | null, SessionTagCatalogInfrastructureError, SessionTagCatalogRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionTagCatalogRepository;
    return yield* repository.getTagByName(name);
  });

export const executeLoadActiveSessionTagCatalog = (): Effect.Effect<
  Tag[],
  SessionTagCatalogInfrastructureError,
  SessionTagCatalogRepository
> =>
  Effect.gen(function* () {
    const repository = yield* SessionTagCatalogRepository;
    const tags = yield* repository.listActiveTags();
    return [...tags];
  });

export const executeDeleteSessionTagCatalogEntry = (
  tagId: number
): Effect.Effect<void, SessionTagCatalogInfrastructureError, SessionTagCatalogRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionTagCatalogRepository;
    yield* repository.deleteTag(tagId);
  });

export const executeAssignSessionTagCatalogEntryToSession = (
  sessionId: string,
  tagId: number
): Effect.Effect<void, SessionTagCatalogInfrastructureError, SessionTagCatalogRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionTagCatalogRepository;
    yield* repository.addTagToSession(sessionId, tagId);
  });

export const executeRemoveSessionTagCatalogEntryFromSession = (
  sessionId: string,
  tagId: number
): Effect.Effect<void, SessionTagCatalogInfrastructureError, SessionTagCatalogRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionTagCatalogRepository;
    yield* repository.removeTagFromSession(sessionId, tagId);
  });

export const executeLoadSessionTagNames = (
  sessionId: string
): Effect.Effect<string[], SessionTagCatalogInfrastructureError, SessionTagCatalogRepository> =>
  Effect.gen(function* () {
    const repository = yield* SessionTagCatalogRepository;
    const tags = yield* repository.listTagNamesBySession(sessionId);
    return [...tags];
  });

export const executeCleanupOrphanedSessionTags = (): Effect.Effect<
  number,
  SessionTagCatalogInfrastructureError,
  SessionTagCatalogRepository
> =>
  Effect.gen(function* () {
    const repository = yield* SessionTagCatalogRepository;
    return yield* repository.cleanupOrphanedTags();
  });
