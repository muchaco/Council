import type { BlackboardState, SessionInput } from '../../types';

export interface CreateSessionCommandInput {
  readonly input: SessionInput;
  readonly personaIds: readonly string[];
  readonly conductorConfig?: { readonly enabled: boolean; readonly mode?: 'automatic' | 'manual' };
}

export const createSessionCommand = async (
  command: CreateSessionCommandInput
): Promise<{ success: boolean; data?: unknown; error?: string }> => {
  const result = await window.electronDB.createSession({
    ...command.input,
    conductorConfig: command.conductorConfig,
  });

  if (!result.success || !result.data || typeof result.data !== 'object' || result.data === null) {
    return result;
  }

  const createdSession = result.data as { id?: unknown };
  if (typeof createdSession.id !== 'string') {
    return {
      success: false,
      error: 'Invalid session payload',
    };
  }

  for (const personaId of command.personaIds) {
    const participantResult = await window.electronDB.addPersonaToSession(createdSession.id, personaId, false);
    if (!participantResult.success) {
      return {
        success: false,
        error: participantResult.error ?? 'Failed to add session participant',
      };
    }
  }

  return result;
};

export const updateSessionCommand = async (
  sessionId: string,
  input: unknown
): Promise<{ success: boolean; data?: unknown; error?: string }> =>
  window.electronDB.updateSession(sessionId, input);

export const deleteSessionCommand = async (
  sessionId: string
): Promise<{ success: boolean; error?: string }> => {
  const result = await window.electronDB.deleteSession(sessionId);
  if (!result.success) {
    return result;
  }

  await window.electronDB.tags.cleanupOrphaned();
  return result;
};

export const archiveSessionCommand = async (
  sessionId: string
): Promise<{ success: boolean; error?: string }> => window.electronDB.archiveSession(sessionId);

export const unarchiveSessionCommand = async (
  sessionId: string
): Promise<{ success: boolean; error?: string }> => window.electronDB.unarchiveSession(sessionId);

export const setPersonaHushCommand = async (
  sessionId: string,
  personaId: string,
  turns: number
): Promise<{ success: boolean; error?: string }> => window.electronDB.hushPersona(sessionId, personaId, turns);

export const clearPersonaHushCommand = async (
  sessionId: string,
  personaId: string
): Promise<{ success: boolean; error?: string }> => window.electronDB.unhushPersona(sessionId, personaId);

export const enableConductorCommand = async (
  sessionId: string,
  mode: 'automatic' | 'manual'
): Promise<{ success: boolean; error?: string }> => window.electronConductor.enable(sessionId, mode);

export const disableConductorCommand = async (
  sessionId: string
): Promise<{ success: boolean; error?: string }> => window.electronConductor.disable(sessionId);

export const resetConductorCircuitBreakerCommand = async (
  sessionId: string
): Promise<{ success: boolean; error?: string }> => window.electronConductor.resetCircuitBreaker(sessionId);

export const processConductorTurnCommand = async (sessionId: string) =>
  window.electronConductor.processTurn(sessionId);

export const exportSessionToMarkdownCommand = async (sessionId: string) =>
  window.electronExport.exportSessionToMarkdown(sessionId);

export const updateConductorBlackboardCommand = async (
  sessionId: string,
  blackboard: BlackboardState
): Promise<{ success: boolean; error?: string }> => window.electronConductor.updateBlackboard(sessionId, blackboard);
