import { Effect } from 'effect';

import type {
  CouncilChatInfrastructureError,
  CouncilChatRepositoryService,
} from '../../application/use-cases/council-chat/council-chat-dependencies';

interface CouncilChatPersonaRecord {
  readonly id: string;
  readonly name: string;
  readonly role: string;
}

interface CouncilChatMessageRecord {
  readonly personaId: string | null;
  readonly content: string;
}

interface ElectronCouncilChatQueries {
  readonly getSessionPersonas: (sessionId: string) => Promise<readonly CouncilChatPersonaRecord[]>;
  readonly getLastMessages: (sessionId: string, limit: number) => Promise<readonly CouncilChatMessageRecord[]>;
}

const repositoryError = (message: string): CouncilChatInfrastructureError => ({
  _tag: 'CouncilChatInfrastructureError',
  source: 'repository',
  code: 'QueryFailed',
  message,
});

const toCauseMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallbackMessage;
};

export const makeCouncilChatRepositoryFromElectronQueries = (
  queries: ElectronCouncilChatQueries
): CouncilChatRepositoryService => ({
  getSessionPersonas: (sessionId) =>
    Effect.tryPromise({
      try: () => queries.getSessionPersonas(sessionId),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to load session personas')),
    }).pipe(
      Effect.map((personas) =>
        personas.map((persona) => ({
          id: persona.id,
          name: persona.name,
          role: persona.role,
        }))
      )
    ),

  getRecentMessages: (sessionId, limit) =>
    Effect.tryPromise({
      try: () => queries.getLastMessages(sessionId, limit),
      catch: (error) => repositoryError(toCauseMessage(error, 'Failed to load recent messages')),
    }).pipe(
      Effect.map((messages) =>
        messages.map((message) => ({
          personaId: message.personaId,
          content: message.content,
        }))
      )
    ),
});
