import { Effect } from 'effect';

import type { Session } from '../../../types';
import {
  QueryLayerRepository,
  type QueryLayerInfrastructureError,
} from './query-layer-dependencies';
import { mapPersistedSessionSnapshotRowToSession } from './session-snapshot-mapper';

export const executeLoadSessions = (): Effect.Effect<
  Session[],
  QueryLayerInfrastructureError,
  QueryLayerRepository
> =>
  Effect.gen(function* () {
    const repository = yield* QueryLayerRepository;
    const persistedSessions = yield* repository.listSessions();
    const persistedSessionTags = yield* repository.listSessionTagNamesBySessionIds(
      persistedSessions.map((session) => session.id)
    );

    const tagsBySessionId = new Map<string, string[]>();
    for (const persistedTag of persistedSessionTags) {
      const tagsForSession = tagsBySessionId.get(persistedTag.sessionId) ?? [];
      tagsForSession.push(persistedTag.tagName);
      tagsBySessionId.set(persistedTag.sessionId, tagsForSession);
    }

    return persistedSessions.map((persistedSession) =>
      mapPersistedSessionSnapshotRowToSession(
        persistedSession,
        tagsBySessionId.get(persistedSession.id) ?? []
      )
    );
  });
