import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';

import { Clock, IdGenerator } from '../../runtime';
import {
  SessionStateRepository,
  type CreateSessionStateCommand,
  type SessionStateRepositoryService,
} from './session-state-dependencies';
import { executeCreateSessionState } from './execute-session-state-commands';

const baseRepository: SessionStateRepositoryService = {
  createSession: () => Effect.void,
  updateSession: () => Effect.void,
  deleteSession: () => Effect.void,
  updateBlackboard: () => Effect.void,
  updateSessionSummary: () => Effect.void,
  incrementAutoReplyCount: () => Effect.void,
  readAutoReplyCount: () => Effect.succeed(0),
  resetAutoReplyCount: () => Effect.void,
  enableOrchestrator: () => Effect.void,
  disableOrchestrator: () => Effect.void,
  archiveSession: () => Effect.void,
  unarchiveSession: () => Effect.void,
  isSessionArchived: () => Effect.succeed(false),
};

describe('execute_session_state_commands_use_case_spec', () => {
  it('creates_session_state_with_deterministic_runtime_services', async () => {
    const observedCreateCommands: CreateSessionStateCommand[] = [];

    const writeCapableRepository: SessionStateRepositoryService = {
      ...baseRepository,
      createSession: (command) => {
        observedCreateCommands.push(command);
        return Effect.void;
      },
    };

    const session = await Effect.runPromise(
      executeCreateSessionState(
        {
          title: 'Migration planning',
          problemDescription: 'Need a safe FCIS rollout',
          outputGoal: 'Produce an execution plan',
        },
        {
          enabled: true,
          orchestratorPersonaId: 'orchestrator-1',
        }
      ).pipe(
        Effect.provideService(SessionStateRepository, writeCapableRepository),
        Effect.provideService(IdGenerator, { generate: Effect.succeed('session-1') }),
        Effect.provideService(Clock, { now: Effect.succeed(new Date('2026-02-10T11:00:00.000Z')) })
      )
    );

    expect(observedCreateCommands).toEqual([
      {
        id: 'session-1',
        now: '2026-02-10T11:00:00.000Z',
        input: {
          title: 'Migration planning',
          problemDescription: 'Need a safe FCIS rollout',
          outputGoal: 'Produce an execution plan',
        },
        orchestratorEnabled: true,
        orchestratorPersonaId: 'orchestrator-1',
      },
    ]);
    expect(session.id).toBe('session-1');
    expect(session.createdAt).toBe('2026-02-10T11:00:00.000Z');
    expect(session.updatedAt).toBe('2026-02-10T11:00:00.000Z');
  });
});
