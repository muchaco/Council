import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';

import {
  SessionParticipationRepository,
  type SessionParticipationRepositoryService,
} from './session-participation-dependencies';
import { executeLoadSessionParticipants } from './execute-load-session-participants';

const repository: SessionParticipationRepositoryService = {
  addSessionParticipant: () => Effect.void,
  listSessionParticipants: () =>
    Effect.succeed([
      {
        id: 'persona-1',
        name: 'Architect',
        role: 'Architecture Lead',
        systemPrompt: 'Be strategic',
        geminiModel: 'gemini-1.5-pro',
        temperature: 0.6,
        color: '#3B82F6',
        hiddenAgenda: undefined,
        verbosity: 'concise',
        createdAt: '2026-02-10T09:00:00.000Z',
        updatedAt: '2026-02-10T09:30:00.000Z',
        isOrchestrator: 1,
        hushTurnsRemaining: null,
        hushedAt: null,
      },
    ]),
  setParticipantHush: () => Effect.void,
  decrementParticipantHush: () => Effect.void,
  readParticipantHushTurns: () => Effect.succeed(0),
  clearParticipantHush: () => Effect.void,
  decrementAllParticipantHushTurns: () => Effect.void,
  listHushedParticipantIds: () => Effect.succeed([]),
  removeSessionParticipant: () => Effect.void,
};

describe('execute_load_session_participants_use_case_spec', () => {
  it('maps_persisted_participants_to_session_persona_shape', async () => {
    const participants = await Effect.runPromise(
      executeLoadSessionParticipants('session-1').pipe(
        Effect.provideService(SessionParticipationRepository, repository)
      )
    );

    expect(participants).toEqual([
      {
        id: 'persona-1',
        name: 'Architect',
        role: 'Architecture Lead',
        systemPrompt: 'Be strategic',
        geminiModel: 'gemini-1.5-pro',
        temperature: 0.6,
        color: '#3B82F6',
        hiddenAgenda: undefined,
        verbosity: 'concise',
        createdAt: '2026-02-10T09:00:00.000Z',
        updatedAt: '2026-02-10T09:30:00.000Z',
        isOrchestrator: true,
        hushTurnsRemaining: 0,
        hushedAt: null,
      },
    ]);
  });
});
