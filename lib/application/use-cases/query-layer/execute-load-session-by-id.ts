import { Effect } from 'effect';

import type { Session } from '../../../types';
import {
  QueryLayerRepository,
  type QueryLayerInfrastructureError,
} from './query-layer-dependencies';
import { mapPersistedSessionSnapshotRowToSession } from './session-snapshot-mapper';

export const executeLoadSessionById = (
  sessionId: string
): Effect.Effect<Session | null, QueryLayerInfrastructureError, QueryLayerRepository> =>
  Effect.gen(function* () {
    const repository = yield* QueryLayerRepository;
    const persistedSession = yield* repository.getSessionById(sessionId);
    if (persistedSession === null) {
      return null;
    }

    const tags = yield* repository.listSessionTagNames(sessionId);
    return mapPersistedSessionSnapshotRowToSession(persistedSession, tags);
  });
