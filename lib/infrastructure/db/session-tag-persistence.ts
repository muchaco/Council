import { Effect } from 'effect';

import type { SessionTagCatalogEntry } from '../../core/domain/session-tags';
import type {
  SessionTagInfrastructureError,
  SessionTagPersistenceService,
} from '../../application/use-cases/session-tags/session-tag-persistence-service';

interface SessionTagElectronDB {
  readonly tags: {
    readonly create: (name: string) => Promise<{ success: boolean; data?: SessionTagCatalogEntry; error?: string }>;
    readonly getAll: () => Promise<{ success: boolean; data?: SessionTagCatalogEntry[]; error?: string }>;
    readonly getByName: (name: string) => Promise<{ success: boolean; data?: SessionTagCatalogEntry | null; error?: string }>;
    readonly cleanupOrphaned: () => Promise<{ success: boolean; error?: string }>;
  };
  readonly sessionTags: {
    readonly add: (sessionId: string, tagId: number) => Promise<{ success: boolean; error?: string }>;
    readonly remove: (sessionId: string, tagId: number) => Promise<{ success: boolean; error?: string }>;
  };
}

const infrastructureError = (message: string): SessionTagInfrastructureError => ({
  _tag: 'SessionTagInfrastructureError',
  message,
});

export const makeSessionTagPersistenceFromElectronDB = (
  electronDB: SessionTagElectronDB
): SessionTagPersistenceService => ({
  getTagByName: (tagName: string) =>
    Effect.tryPromise({
      try: () => electronDB.tags.getByName(tagName),
      catch: () => infrastructureError('Failed to load tag by name'),
    }).pipe(
      Effect.flatMap((result) => {
        if (!result.success) {
          return Effect.fail(infrastructureError(result.error ?? 'Failed to load tag by name'));
        }

        return Effect.succeed(result.data ?? null);
      })
    ),

  createTag: (tagName: string) =>
    Effect.tryPromise({
      try: () => electronDB.tags.create(tagName),
      catch: () => infrastructureError('Failed to create tag'),
    }).pipe(
      Effect.flatMap((result) => {
        if (!result.success || !result.data) {
          return Effect.fail(infrastructureError(result.error ?? 'Failed to create tag'));
        }

        return Effect.succeed(result.data);
      })
    ),

  addTagToSession: (sessionId: string, tagId: number) =>
    Effect.tryPromise({
      try: () => electronDB.sessionTags.add(sessionId, tagId),
      catch: () => infrastructureError('Failed to add tag to session'),
    }).pipe(
      Effect.flatMap((result) =>
        result.success
          ? Effect.void
          : Effect.fail(infrastructureError(result.error ?? 'Failed to add tag to session'))
      )
    ),

  removeTagFromSession: (sessionId: string, tagId: number) =>
    Effect.tryPromise({
      try: () => electronDB.sessionTags.remove(sessionId, tagId),
      catch: () => infrastructureError('Failed to remove tag from session'),
    }).pipe(
      Effect.flatMap((result) =>
        result.success
          ? Effect.void
          : Effect.fail(infrastructureError(result.error ?? 'Failed to remove tag from session'))
      )
    ),

  cleanupOrphanedTags: () =>
    Effect.tryPromise({
      try: () => electronDB.tags.cleanupOrphaned(),
      catch: () => infrastructureError('Failed to cleanup orphaned tags'),
    }).pipe(
      Effect.flatMap((result) =>
        result.success
          ? Effect.void
          : Effect.fail(infrastructureError(result.error ?? 'Failed to cleanup orphaned tags'))
      )
    ),

  getAllTags: () =>
    Effect.tryPromise({
      try: () => electronDB.tags.getAll(),
      catch: () => infrastructureError('Failed to load all tags'),
    }).pipe(
      Effect.flatMap((result) => {
        if (!result.success) {
          return Effect.fail(infrastructureError(result.error ?? 'Failed to load all tags'));
        }

        return Effect.succeed((result.data ?? []) as readonly SessionTagCatalogEntry[]);
      })
    ),
});
