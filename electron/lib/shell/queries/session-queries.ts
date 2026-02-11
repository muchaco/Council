import type { Session, SessionInput } from '../../types.js';
import {
  executeArchiveSession,
  executeCreateSessionState,
  executeDeleteSessionState,
  executeDisableSessionConductor,
  executeEnableSessionConductor,
  executeIncrementSessionAutoReplyCount,
  executeIsSessionArchived,
  executeLoadSessionById,
  executeLoadSessions,
  executeResetSessionAutoReplyCount,
  executeUnarchiveSession,
  executeUpdateSessionBlackboard,
  executeUpdateSessionState,
  executeUpdateSessionSummary,
} from '../../../../lib/application/use-cases';
import { runQueryLayerRead, runSessionState } from './context.js';

type SessionUpdateInput = Partial<SessionInput> & {
  status?: string;
  tokenCount?: number;
  costEstimate?: number;
  conductorEnabled?: boolean;
  conductorPersonaId?: string | null;
  blackboard?: any;
  autoReplyCount?: number;
  tokenBudget?: number;
  summary?: string | null;
};

export async function createSession(
  data: SessionInput,
  conductorConfig?: { enabled: boolean; conductorPersonaId?: string }
): Promise<Session> {
  return runSessionState(executeCreateSessionState(data, conductorConfig));
}

export async function getSessions(): Promise<Session[]> {
  return runQueryLayerRead(executeLoadSessions());
}

export async function getSession(id: string): Promise<Session | null> {
  return runQueryLayerRead(executeLoadSessionById(id));
}

export async function updateSession(id: string, data: SessionUpdateInput): Promise<Session> {
  await runSessionState(executeUpdateSessionState(id, data));
  const updated = await getSession(id);

  if (!updated) {
    throw new Error('Session not found after update');
  }

  return updated;
}

export async function deleteSession(id: string): Promise<void> {
  await runSessionState(executeDeleteSessionState(id));
}

export async function updateBlackboard(sessionId: string, blackboard: any): Promise<void> {
  await runSessionState(executeUpdateSessionBlackboard(sessionId, blackboard));
}

export async function updateSessionSummary(sessionId: string, summary: string): Promise<void> {
  await runSessionState(executeUpdateSessionSummary(sessionId, summary));
}

export async function incrementAutoReplyCount(sessionId: string): Promise<number> {
  return runSessionState(executeIncrementSessionAutoReplyCount(sessionId));
}

export async function resetAutoReplyCount(sessionId: string): Promise<void> {
  await runSessionState(executeResetSessionAutoReplyCount(sessionId));
}

export async function enableConductor(sessionId: string, conductorPersonaId: string): Promise<void> {
  await runSessionState(executeEnableSessionConductor(sessionId, conductorPersonaId));
}

export async function disableConductor(sessionId: string): Promise<void> {
  await runSessionState(executeDisableSessionConductor(sessionId));
}

export async function archiveSession(sessionId: string): Promise<void> {
  await runSessionState(executeArchiveSession(sessionId));
}

export async function unarchiveSession(sessionId: string): Promise<void> {
  await runSessionState(executeUnarchiveSession(sessionId));
}

export async function isSessionArchived(sessionId: string): Promise<boolean> {
  return runSessionState(executeIsSessionArchived(sessionId));
}
