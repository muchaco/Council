import { describe, expect, it } from 'vitest';
import { Either } from 'effect';

import type { ConductorSessionSnapshot } from '../../domain/conductor';
import { decideConductorParticipantPreconditions, decideConductorSessionPreconditions } from './decide-conductor-preconditions';

describe('decide_conductor_preconditions_spec', () => {
  it.each([
    {
      name: 'fails_when_session_is_missing',
      session: null,
      expected: {
        _tag: 'ConductorSessionNotFoundError',
        message: 'Session not found',
      },
    },
    {
      name: 'fails_when_conductor_is_disabled',
      session: {
        sessionId: 'session-1',
        orchestratorEnabled: false,
        orchestratorPersonaId: null,
        autoReplyCount: 0,
        tokenCount: 0,
        problemDescription: 'Problem',
        outputGoal: 'Goal',
        blackboard: null,
      },
      expected: {
        _tag: 'ConductorNotEnabledError',
        message: 'Orchestrator not enabled for this session',
      },
    },
  ])('$name', ({ session, expected }) => {
    const decision = decideConductorSessionPreconditions(
      session as ConductorSessionSnapshot | null
    );
    expect(Either.isLeft(decision)).toBe(true);
    if (Either.isLeft(decision)) {
      expect(decision.left).toEqual(expected);
    }
  });

  it('returns_orchestrator_persona_when_participant_preconditions_pass', () => {
    const decision = decideConductorParticipantPreconditions(
      [
        {
          id: 'conductor',
          name: 'Conductor',
          role: 'System',
          geminiModel: 'gemini-1.5-flash',
          hushTurnsRemaining: 0,
        },
      ],
      'conductor'
    );

    expect(Either.isRight(decision)).toBe(true);
    if (Either.isRight(decision)) {
      expect(decision.right.orchestratorPersona.id).toBe('conductor');
    }
  });

  it.each([
    {
      name: 'fails_when_session_has_no_personas',
      personas: [],
      orchestratorPersonaId: 'conductor',
      expected: {
        _tag: 'ConductorNoPersonasError',
        message: 'No personas in session',
      },
    },
    {
      name: 'fails_when_orchestrator_persona_is_missing',
      personas: [
        {
          id: 'speaker-a',
          name: 'Architect',
          role: 'Architecture',
          geminiModel: 'gemini-1.5-pro',
          hushTurnsRemaining: 0,
        },
      ],
      orchestratorPersonaId: 'conductor',
      expected: {
        _tag: 'ConductorPersonaMissingError',
        message: 'Orchestrator persona not found',
      },
    },
  ])('$name', ({ personas, orchestratorPersonaId, expected }) => {
    const decision = decideConductorParticipantPreconditions(personas, orchestratorPersonaId);
    expect(Either.isLeft(decision)).toBe(true);
    if (Either.isLeft(decision)) {
      expect(decision.left).toEqual(expected);
    }
  });
});
