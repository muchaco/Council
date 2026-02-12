import type { BlackboardState, SessionInput } from '../../types';

export interface CreateSessionCommandInput {
  readonly input: SessionInput;
  readonly personaIds: readonly string[];
  readonly conductorConfig?: { readonly enabled: boolean; readonly mode?: 'automatic' | 'manual' };
}

export const createSessionCommand = async (
  command: CreateSessionCommandInput
): Promise<{ success: boolean; data?: unknown; error?: string }> => {
  return window.electronSessionCommand.createFull(command);
};

export const updateSessionCommand = async (
  sessionId: string,
  input: unknown
): Promise<{ success: boolean; data?: unknown; error?: string }> =>
  window.electronSessionCommand.update(sessionId, input);

export const deleteSessionCommand = async (
  sessionId: string
): Promise<{ success: boolean; error?: string }> => window.electronSessionCommand.delete(sessionId);

export const archiveSessionCommand = async (
  sessionId: string
): Promise<{ success: boolean; error?: string }> => window.electronSessionCommand.archive(sessionId);

export const unarchiveSessionCommand = async (
  sessionId: string
): Promise<{ success: boolean; error?: string }> => window.electronSessionCommand.unarchive(sessionId);

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

export const getSessionTagPersistenceBoundary = () => window.electronDB;

export const getSessionMessagePersistenceBoundary = () => ({
  getNextTurnNumber: window.electronDB.getNextTurnNumber,
  createMessage: window.electronDB.createMessage,
  updateSession: (
    sessionId: string,
    data: { tokenCount: number; costEstimate: number }
  ) => window.electronSessionCommand.update(sessionId, data),
});
