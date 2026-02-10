import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';

import {
  CouncilTranscriptRepository,
  type CouncilTranscriptRepositoryService,
} from './council-transcript-dependencies';
import {
  executeCreateCouncilTranscriptMessage,
  executeLoadCouncilTranscript,
  executeLoadNextCouncilTurnNumber,
  executeLoadRecentCouncilTranscript,
} from './execute-load-council-transcript';

const repository: CouncilTranscriptRepositoryService = {
  createMessage: () => Effect.void,
  listMessagesBySession: () =>
    Effect.succeed([
      {
        id: 'm1',
        sessionId: 's1',
        personaId: null,
        content: 'User asks a question',
        turnNumber: 1,
        tokenCount: 8,
        metadata: null,
        createdAt: '2026-02-10T10:00:00.000Z',
      },
      {
        id: 'm2',
        sessionId: 's1',
        personaId: 'p1',
        content: 'Persona responds',
        turnNumber: 2,
        tokenCount: 12,
        metadata: JSON.stringify({ isIntervention: true }),
        createdAt: '2026-02-10T10:01:00.000Z',
      },
    ]),
  listRecentMessagesBySession: () =>
    Effect.succeed([
      {
        id: 'm3',
        sessionId: 's1',
        personaId: 'p1',
        content: 'Newest',
        turnNumber: 3,
        tokenCount: 5,
        metadata: null,
        createdAt: '2026-02-10T10:02:00.000Z',
      },
      {
        id: 'm2',
        sessionId: 's1',
        personaId: 'p1',
        content: 'Older',
        turnNumber: 2,
        tokenCount: 12,
        metadata: null,
        createdAt: '2026-02-10T10:01:00.000Z',
      },
    ]),
  readMaxTurnNumber: () => Effect.succeed(3),
};

describe('execute_load_council_transcript_use_case_spec', () => {
  it('loads_transcript_messages_with_metadata_mapping', async () => {
    const messages = await Effect.runPromise(
      executeLoadCouncilTranscript('s1').pipe(
        Effect.provideService(CouncilTranscriptRepository, repository)
      )
    );

    expect(messages).toHaveLength(2);
    expect(messages[1]?.metadata).toEqual({ isIntervention: true });
  });

  it('loads_recent_messages_in_ascending_order_for_consumers', async () => {
    const messages = await Effect.runPromise(
      executeLoadRecentCouncilTranscript('s1', 2).pipe(
        Effect.provideService(CouncilTranscriptRepository, repository)
      )
    );

    expect(messages.map((message) => message.id)).toEqual(['m2', 'm3']);
  });

  it('creates_message_and_calculates_next_turn_number', async () => {
    const createdMessageIds: string[] = [];
    const writeCapableRepository: CouncilTranscriptRepositoryService = {
      ...repository,
      createMessage: (command) => {
        createdMessageIds.push(command.id);
        return Effect.void;
      },
      readMaxTurnNumber: () => Effect.succeed(7),
    };

    const created = await Effect.runPromise(
      executeCreateCouncilTranscriptMessage({
        sessionId: 's1',
        personaId: 'p1',
        content: 'Generated response',
        turnNumber: 8,
        tokenCount: 16,
      }).pipe(Effect.provideService(CouncilTranscriptRepository, writeCapableRepository))
    );

    const nextTurnNumber = await Effect.runPromise(
      executeLoadNextCouncilTurnNumber('s1').pipe(
        Effect.provideService(CouncilTranscriptRepository, writeCapableRepository)
      )
    );

    expect(created.id).toHaveLength(36);
    expect(createdMessageIds).toHaveLength(1);
    expect(nextTurnNumber).toBe(8);
  });
});
