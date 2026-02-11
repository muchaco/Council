import type { SessionPersona } from '../../types.js';
import {
  executeAddSessionParticipant,
  executeClearSessionParticipantHush,
  executeDecrementAllSessionParticipantHushTurns,
  executeDecrementSessionParticipantHush,
  executeLoadHushedSessionParticipantIds,
  executeLoadSessionParticipants,
  executeRemoveSessionParticipant,
  executeSetSessionParticipantHush,
} from '../../../../lib/application/use-cases';
import { runSessionParticipationRead } from './context.js';

export async function addPersonaToSession(
  sessionId: string,
  personaId: string,
  isConductor: boolean = false
): Promise<void> {
  await runSessionParticipationRead(executeAddSessionParticipant(sessionId, personaId, isConductor));
}

export async function getSessionPersonas(sessionId: string): Promise<SessionPersona[]> {
  return runSessionParticipationRead(executeLoadSessionParticipants(sessionId));
}

export async function setPersonaHush(sessionId: string, personaId: string, turns: number): Promise<void> {
  await runSessionParticipationRead(executeSetSessionParticipantHush(sessionId, personaId, turns));
}

export async function decrementPersonaHush(sessionId: string, personaId: string): Promise<number> {
  return runSessionParticipationRead(executeDecrementSessionParticipantHush(sessionId, personaId));
}

export async function clearPersonaHush(sessionId: string, personaId: string): Promise<void> {
  await runSessionParticipationRead(executeClearSessionParticipantHush(sessionId, personaId));
}

export async function decrementAllHushTurns(sessionId: string): Promise<void> {
  await runSessionParticipationRead(executeDecrementAllSessionParticipantHushTurns(sessionId));
}

export async function getHushedPersonas(sessionId: string): Promise<string[]> {
  const hushedPersonaIds = await runSessionParticipationRead(
    executeLoadHushedSessionParticipantIds(sessionId)
  );

  return [...hushedPersonaIds];
}

export async function removePersonaFromSession(sessionId: string, personaId: string): Promise<void> {
  await runSessionParticipationRead(executeRemoveSessionParticipant(sessionId, personaId));
}
