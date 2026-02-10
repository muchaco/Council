import { Effect } from 'effect';

import { Clock, IdGenerator } from '../../runtime';
import type { Message, MessageInput } from '../../../types';
import {
  CouncilTranscriptRepository,
  type CouncilTranscriptInfrastructureError,
} from './council-transcript-dependencies';
import { mapPersistedCouncilTranscriptMessageRowToMessage } from './council-transcript-mapper';

export const executeCreateCouncilTranscriptMessage = (
  input: MessageInput
): Effect.Effect<
  Message,
  CouncilTranscriptInfrastructureError,
  CouncilTranscriptRepository | IdGenerator | Clock
> =>
  Effect.gen(function* () {
    const repository = yield* CouncilTranscriptRepository;
    const idGenerator = yield* IdGenerator;
    const clock = yield* Clock;
    const messageId = yield* idGenerator.generate;
    const createdAt = (yield* clock.now).toISOString();
    const tokenCount = input.tokenCount ?? 0;

    yield* repository.createMessage({
      id: messageId,
      now: createdAt,
      sessionId: input.sessionId,
      personaId: input.personaId,
      content: input.content,
      turnNumber: input.turnNumber,
      tokenCount,
      metadata: input.metadata ?? null,
    });

    return {
      id: messageId,
      sessionId: input.sessionId,
      personaId: input.personaId,
      content: input.content,
      turnNumber: input.turnNumber,
      tokenCount,
      metadata: input.metadata ?? null,
      createdAt,
    };
  });

export const executeLoadNextCouncilTurnNumber = (
  sessionId: string
): Effect.Effect<number, CouncilTranscriptInfrastructureError, CouncilTranscriptRepository> =>
  Effect.gen(function* () {
    const repository = yield* CouncilTranscriptRepository;
    const maxTurnNumber = yield* repository.readMaxTurnNumber(sessionId);
    return maxTurnNumber + 1;
  });

export const executeLoadCouncilTranscript = (
  sessionId: string
): Effect.Effect<Message[], CouncilTranscriptInfrastructureError, CouncilTranscriptRepository> =>
  Effect.gen(function* () {
    const repository = yield* CouncilTranscriptRepository;
    const persistedMessages = yield* repository.listMessagesBySession(sessionId);
    return persistedMessages.map(mapPersistedCouncilTranscriptMessageRowToMessage);
  });

export const executeLoadRecentCouncilTranscript = (
  sessionId: string,
  limit = 10
): Effect.Effect<Message[], CouncilTranscriptInfrastructureError, CouncilTranscriptRepository> =>
  Effect.gen(function* () {
    const repository = yield* CouncilTranscriptRepository;
    const persistedMessages = yield* repository.listRecentMessagesBySession(sessionId, limit);
    return [...persistedMessages].reverse().map(mapPersistedCouncilTranscriptMessageRowToMessage);
  });
