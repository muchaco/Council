import { Context, Effect } from 'effect';

import type { TagInput } from '../../../types';

export interface SessionTagCatalogEntry {
  readonly id: number;
  readonly name: string;
  readonly createdAt: string;
}

export interface SessionTagCatalogInfrastructureError {
  readonly _tag: 'SessionTagCatalogInfrastructureError';
  readonly source: 'repository';
  readonly message: string;
}

export interface CreateSessionTagCatalogEntryCommand {
  readonly name: string;
  readonly createdAt: string;
}

export interface SessionTagCatalogRepositoryService {
  readonly createTag: (
    command: CreateSessionTagCatalogEntryCommand
  ) => Effect.Effect<void, SessionTagCatalogInfrastructureError>;
  readonly getTagByName: (
    name: string
  ) => Effect.Effect<SessionTagCatalogEntry | null, SessionTagCatalogInfrastructureError>;
  readonly listActiveTags: () => Effect.Effect<readonly SessionTagCatalogEntry[], SessionTagCatalogInfrastructureError>;
  readonly deleteTag: (tagId: number) => Effect.Effect<void, SessionTagCatalogInfrastructureError>;
  readonly addTagToSession: (
    sessionId: string,
    tagId: number
  ) => Effect.Effect<void, SessionTagCatalogInfrastructureError>;
  readonly removeTagFromSession: (
    sessionId: string,
    tagId: number
  ) => Effect.Effect<void, SessionTagCatalogInfrastructureError>;
  readonly listTagNamesBySession: (
    sessionId: string
  ) => Effect.Effect<readonly string[], SessionTagCatalogInfrastructureError>;
  readonly cleanupOrphanedTags: () => Effect.Effect<number, SessionTagCatalogInfrastructureError>;
}

export class SessionTagCatalogRepository extends Context.Tag('SessionTagCatalogRepository')<
  SessionTagCatalogRepository,
  SessionTagCatalogRepositoryService
>() {}
