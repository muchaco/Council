import { Effect } from 'effect';

import type { Message, MessageInput } from '../../../types';
import {
  CouncilTranscriptRepository,
  type CouncilTranscriptInfrastructureError,
} from './council-transcript-dependencies';
import { mapPersistedCouncilTranscriptMessageRowToMessage } from './council-transcript-mapper';

const createId = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const randomValue = (Math.random() * 16) | 0;
    const value = token === 'x' ? randomValue : (randomValue & 0x3) | 0x8;
    return value.toString(16);
  });

const nowIso = (): string => new Date().toISOString();

export const executeCreateCouncilTranscriptMessage = (
  input: MessageInput
): Effect.Effect<Message, CouncilTranscriptInfrastructureError, CouncilTranscriptRepository> =>
  Effect.gen(function* () {
    const repository = yield* CouncilTranscriptRepository;
    const messageId = createId();
    const createdAt = nowIso();
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
