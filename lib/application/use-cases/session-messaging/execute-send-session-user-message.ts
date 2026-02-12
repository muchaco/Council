import { Effect } from 'effect';

import type { Message } from '../../../types';
import {
  SessionMessagePersistence,
  type SessionMessagingInfrastructureError,
} from './session-messaging-dependencies';

export interface ExecuteSendSessionUserMessageInput {
  readonly sessionId: string;
  readonly content: string;
}

export const executeSendSessionUserMessage = (
  input: ExecuteSendSessionUserMessageInput
): Effect.Effect<Message, SessionMessagingInfrastructureError, SessionMessagePersistence> =>
  Effect.gen(function* () {
    const messagePersistence = yield* SessionMessagePersistence;
    const turnNumber = yield* messagePersistence.getNextTurnNumber(input.sessionId);

    return yield* messagePersistence.createMessage({
      sessionId: input.sessionId,
      personaId: null,
      source: 'user',
      content: input.content,
      turnNumber,
      tokenCount: 0,
    });
  });
