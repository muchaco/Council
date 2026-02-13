import type { BlackboardState, ConductorProcessTurnResponse, SessionInput } from '../../types';
import { getRendererBridge } from './renderer-bridge';

export interface CreateSessionCommandInput {
  readonly input: SessionInput;
  readonly personaIds: readonly string[];
  readonly conductorConfig?: { readonly enabled: boolean; readonly mode?: 'automatic' | 'manual' };
}

export const createSessionCommand = async (
  command: CreateSessionCommandInput
): Promise<{ success: boolean; data?: unknown; error?: string }> => {
  return getRendererBridge().electronSessionCommand.createFull(command);
};

export const updateSessionCommand = async (
  sessionId: string,
  input: unknown
): Promise<{ success: boolean; data?: unknown; error?: string }> =>
  getRendererBridge().electronSessionCommand.update(sessionId, input);

export const deleteSessionCommand = async (
  sessionId: string
): Promise<{ success: boolean; error?: string }> =>
  getRendererBridge().electronSessionCommand.delete(sessionId);

export const archiveSessionCommand = async (
  sessionId: string
): Promise<{ success: boolean; error?: string }> =>
  getRendererBridge().electronSessionCommand.archive(sessionId);

export const unarchiveSessionCommand = async (
  sessionId: string
): Promise<{ success: boolean; error?: string }> =>
  getRendererBridge().electronSessionCommand.unarchive(sessionId);

export const setPersonaHushCommand = async (
  sessionId: string,
  personaId: string,
  turns: number
): Promise<{ success: boolean; error?: string }> =>
  getRendererBridge().electronDB.hushPersona(sessionId, personaId, turns);

export const clearPersonaHushCommand = async (
  sessionId: string,
  personaId: string
): Promise<{ success: boolean; error?: string }> =>
  getRendererBridge().electronDB.unhushPersona(sessionId, personaId);

export const enableConductorCommand = async (
  sessionId: string,
  mode: 'automatic' | 'manual'
): Promise<{ success: boolean; error?: string }> =>
  getRendererBridge().electronConductor.enable(sessionId, mode);

export const disableConductorCommand = async (
  sessionId: string
): Promise<{ success: boolean; error?: string }> => getRendererBridge().electronConductor.disable(sessionId);

export const resetConductorCircuitBreakerCommand = async (
  sessionId: string
): Promise<{ success: boolean; error?: string }> =>
  getRendererBridge().electronConductor.resetCircuitBreaker(sessionId);

export const processConductorTurnCommand = async (sessionId: string): Promise<ConductorProcessTurnResponse> =>
  getRendererBridge().electronConductor.processTurn(sessionId) as Promise<ConductorProcessTurnResponse>;

export const exportSessionToMarkdownCommand = async (sessionId: string): Promise<{
  success: boolean;
  filePath?: string;
  cancelled?: boolean;
  messageCount?: number;
  error?: string;
}> => getRendererBridge().electronExport.exportSessionToMarkdown(sessionId) as Promise<{
  success: boolean;
  filePath?: string;
  cancelled?: boolean;
  messageCount?: number;
  error?: string;
}>;

export const updateConductorBlackboardCommand = async (
  sessionId: string,
  blackboard: BlackboardState
): Promise<{ success: boolean; error?: string }> =>
  getRendererBridge().electronConductor.updateBlackboard(sessionId, blackboard);

export const getSessionTagPersistenceBoundary = () => getRendererBridge().electronDB;

export const getSessionMessagePersistenceBoundary = () => ({
  getNextTurnNumber: getRendererBridge().electronDB.getNextTurnNumber,
  createMessage: getRendererBridge().electronDB.createMessage,
  updateSession: (
    sessionId: string,
    data: { tokenCount: number; costEstimate: number }
  ) => getRendererBridge().electronSessionCommand.update(sessionId, data),
});
