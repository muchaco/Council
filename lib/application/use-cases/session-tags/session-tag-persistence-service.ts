import { Context, Effect } from 'effect';

import type { SessionTagCatalogEntry } from '../../../core/domain/session-tags';

export interface SessionTagInfrastructureError {
  readonly _tag: 'SessionTagInfrastructureError';
  readonly message: string;
}

export interface SessionTagPersistenceService {
  readonly getTagByName: (tagName: string) => Effect.Effect<SessionTagCatalogEntry | null, SessionTagInfrastructureError>;
  readonly createTag: (tagName: string) => Effect.Effect<SessionTagCatalogEntry, SessionTagInfrastructureError>;
  readonly addTagToSession: (sessionId: string, tagId: number) => Effect.Effect<void, SessionTagInfrastructureError>;
  readonly removeTagFromSession: (sessionId: string, tagId: number) => Effect.Effect<void, SessionTagInfrastructureError>;
  readonly cleanupOrphanedTags: () => Effect.Effect<void, SessionTagInfrastructureError>;
  readonly getAllTags: () => Effect.Effect<readonly SessionTagCatalogEntry[], SessionTagInfrastructureError>;
}

export class SessionTagPersistence extends Context.Tag('SessionTagPersistence')<
  SessionTagPersistence,
  SessionTagPersistenceService
>() {}
