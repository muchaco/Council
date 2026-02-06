import { create } from 'zustand';
import { toast } from 'sonner';
import type { Session, SessionInput, Message, Persona, BlackboardState } from '../lib/types';

interface SessionPersona extends Persona {
  isOrchestrator: boolean;
}

interface SessionsState {
  sessions: Session[];
  currentSession: Session | null;
  messages: Message[];
  sessionPersonas: SessionPersona[];
  isLoading: boolean;
  thinkingPersonaId: string | null;
  orchestratorRunning: boolean;
  orchestratorPaused: boolean;
  blackboard: BlackboardState | null;
  
  // Actions
  fetchSessions: () => Promise<void>;
  createSession: (data: SessionInput, personaIds: string[], orchestratorConfig?: { enabled: boolean; orchestratorPersonaId?: string }) => Promise<string | null>;
  loadSession: (id: string) => Promise<void>;
  updateSession: (id: string, data: Partial<SessionInput> & { status?: string; tokenCount?: number; costEstimate?: number; orchestratorEnabled?: boolean; orchestratorPersonaId?: string | null; blackboard?: BlackboardState; autoReplyCount?: number; tokenBudget?: number; summary?: string | null }) => Promise<void>;
  deleteSession: (id: string) => Promise<boolean>;
  sendUserMessage: (content: string) => Promise<void>;
  triggerPersonaResponse: (personaId: string) => Promise<void>;
  enableOrchestrator: (orchestratorPersonaId: string) => Promise<void>;
  disableOrchestrator: () => Promise<void>;
  processOrchestratorTurn: () => Promise<void>;
  pauseOrchestrator: () => void;
  resumeOrchestrator: () => void;
  resetCircuitBreaker: () => Promise<void>;
  clearCurrentSession: () => void;
  exportSessionToMarkdown: (sessionId: string) => Promise<boolean>;
  archiveSession: (id: string) => Promise<boolean>;
  unarchiveSession: (id: string) => Promise<boolean>;
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  currentSession: null,
  messages: [],
  sessionPersonas: [],
  isLoading: false,
  thinkingPersonaId: null,
  orchestratorRunning: false,
  orchestratorPaused: false,
  blackboard: null,

  fetchSessions: async () => {
    try {
      set({ isLoading: true });
      const result = await window.electronDB.getSessions();
      if (result.success && result.data) {
        set({ sessions: result.data as Session[] });
      } else {
        toast.error(result.error || 'Failed to fetch sessions');
      }
    } catch (error) {
      toast.error('Error fetching sessions');
    } finally {
      set({ isLoading: false });
    }
  },

  createSession: async (data: SessionInput, personaIds: string[], orchestratorConfig?: { enabled: boolean; orchestratorPersonaId?: string }) => {
    try {
      set({ isLoading: true });
      
      // Create session with orchestrator config
      const sessionResult = await window.electronDB.createSession({ ...data, orchestratorConfig });
      if (!sessionResult.success || !sessionResult.data) {
        toast.error(sessionResult.error || 'Failed to create session');
        return null;
      }
      
      const session = sessionResult.data as Session;
      
      // Add personas to session
      for (const personaId of personaIds) {
        const isOrchestrator = !!(orchestratorConfig?.enabled && orchestratorConfig.orchestratorPersonaId === personaId);
        await window.electronDB.addPersonaToSession(session.id, personaId, isOrchestrator);
      }
      
      set(state => ({
        sessions: [session, ...state.sessions],
      }));
      
      toast.success('Session created successfully');
      return session.id;
    } catch (error) {
      toast.error('Error creating session');
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  loadSession: async (id: string) => {
    try {
      set({ isLoading: true });
      
      // Get session details
      const sessionResult = await window.electronDB.getSession(id);
      if (!sessionResult.success || !sessionResult.data) {
        toast.error(sessionResult.error || 'Failed to load session');
        return;
      }
      
      // Get messages
      const messagesResult = await window.electronDB.getMessages(id);
      if (!messagesResult.success) {
        toast.error(messagesResult.error || 'Failed to load messages');
        return;
      }
      
      // Get session personas
      const personasResult = await window.electronDB.getSessionPersonas(id);
      if (!personasResult.success) {
        toast.error(personasResult.error || 'Failed to load session personas');
        return;
      }
      
      set({
        currentSession: sessionResult.data as Session,
        messages: (messagesResult.data as Message[]) || [],
        sessionPersonas: (personasResult.data as SessionPersona[]) || [],
      });
    } catch (error) {
      toast.error('Error loading session');
    } finally {
      set({ isLoading: false });
    }
  },

  updateSession: async (id: string, data) => {
    try {
      const result = await window.electronDB.updateSession(id, data);
      if (result.success && result.data) {
        const updated = result.data as Session;
        set(state => ({
          currentSession: state.currentSession?.id === id ? updated : state.currentSession,
          sessions: state.sessions.map(s => s.id === id ? updated : s),
        }));
      }
    } catch (error) {
      toast.error('Error updating session');
    }
  },

  deleteSession: async (id: string) => {
    try {
      set({ isLoading: true });
      const result = await window.electronDB.deleteSession(id);
      if (result.success) {
        set(state => ({
          sessions: state.sessions.filter(s => s.id !== id),
          currentSession: state.currentSession?.id === id ? null : state.currentSession,
        }));
        toast.success('Session deleted successfully');
        return true;
      } else {
        toast.error(result.error || 'Failed to delete session');
        return false;
      }
    } catch (error) {
      toast.error('Error deleting session');
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  sendUserMessage: async (content: string) => {
    const { currentSession, messages } = get();
    if (!currentSession) return;
    
    try {
      const turnNumber = messages.length + 1;
      const messageData = {
        sessionId: currentSession.id,
        personaId: null,
        content,
        turnNumber,
      };
      
      const result = await window.electronDB.createMessage(messageData);
      if (result.success && result.data) {
        set(state => ({
          messages: [...state.messages, result.data as Message],
        }));
      }
    } catch (error) {
      toast.error('Error sending message');
    }
  },

  triggerPersonaResponse: async (personaId: string) => {
    const { currentSession, messages, sessionPersonas } = get();
    if (!currentSession) return;
    
    const persona = sessionPersonas.find(p => p.id === personaId);
    if (!persona) return;
    
    try {
      set({ thinkingPersonaId: personaId });
      
      // Get blackboard state
      const blackboard = currentSession.blackboard || {
        consensus: '', conflicts: '', nextStep: '', facts: ''
      };
      
      // Get other personas for context
      const otherPersonas = sessionPersonas
        .filter(p => p.id !== personaId)
        .map(p => ({ id: p.id, name: p.name, role: p.role }));
      
      const request = {
        personaId,
        sessionId: currentSession.id,
        model: persona.geminiModel,
        systemPrompt: persona.systemPrompt,
        hiddenAgenda: persona.hiddenAgenda,
        verbosity: persona.verbosity,
        temperature: persona.temperature,
        problemContext: currentSession.problemDescription,
        outputGoal: currentSession.outputGoal,
        blackboard,
        otherPersonas,
      };
      
      const result = await window.electronLLM.chat(request);
      
      if (result.success && result.data) {
        const turnNumber = messages.length + 1;
        const messageData = {
          sessionId: currentSession.id,
          personaId,
          content: result.data.content,
          turnNumber,
          tokenCount: result.data.tokenCount,
        };
        
        const messageResult = await window.electronDB.createMessage(messageData);
        if (messageResult.success && messageResult.data) {
          // Update session token count
          const newTokenCount = currentSession.tokenCount + result.data.tokenCount;
          const newCostEstimate = newTokenCount * 0.000001; // Rough estimate: $1 per million tokens
          
          await get().updateSession(currentSession.id, {
            tokenCount: newTokenCount,
            costEstimate: newCostEstimate,
          });
          
          set(state => ({
            messages: [...state.messages, messageResult.data as Message],
          }));
        }
      } else {
        toast.error(result.error || 'Failed to get response from persona');
      }
    } catch (error) {
      toast.error('Error getting persona response');
    } finally {
      set({ thinkingPersonaId: null });
    }
  },

  clearCurrentSession: () => {
    set({
      currentSession: null,
      messages: [],
      sessionPersonas: [],
      orchestratorRunning: false,
      orchestratorPaused: false,
      blackboard: null,
    });
  },

  // Orchestrator actions
  enableOrchestrator: async (orchestratorPersonaId: string) => {
    const { currentSession } = get();
    if (!currentSession) return;
    
    try {
      const result = await window.electronOrchestrator.enable(currentSession.id, orchestratorPersonaId);
      if (result.success) {
        await get().updateSession(currentSession.id, {
          orchestratorEnabled: true,
          orchestratorPersonaId,
        });
        toast.success('Orchestrator enabled');
      } else {
        toast.error(result.error || 'Failed to enable orchestrator');
      }
    } catch (error) {
      toast.error('Error enabling orchestrator');
    }
  },

  disableOrchestrator: async () => {
    const { currentSession } = get();
    if (!currentSession) return;
    
    try {
      const result = await window.electronOrchestrator.disable(currentSession.id);
      if (result.success) {
        await get().updateSession(currentSession.id, {
          orchestratorEnabled: false,
          orchestratorPersonaId: null,
        });
        set({ orchestratorRunning: false, orchestratorPaused: false });
        toast.success('Orchestrator disabled');
      } else {
        toast.error(result.error || 'Failed to disable orchestrator');
      }
    } catch (error) {
      toast.error('Error disabling orchestrator');
    }
  },

  processOrchestratorTurn: async () => {
    const { currentSession, orchestratorPaused } = get();
    if (!currentSession || !currentSession.orchestratorEnabled || orchestratorPaused) return;
    
    try {
      set({ orchestratorRunning: true });
      
      const result = await window.electronOrchestrator.processTurn(currentSession.id);
      
      if (!result.success) {
        if (result.code === 'CIRCUIT_BREAKER') {
          set({ orchestratorPaused: true });
          toast.warning(result.error || 'Circuit breaker triggered');
        } else if (result.code === 'SELECTOR_AGENT_ERROR') {
          set({ orchestratorRunning: false });
          toast.error(result.error || 'Selector agent error');
        } else {
          toast.error(result.error || 'Orchestrator error');
          set({ orchestratorRunning: false });
        }
        return;
      }
      
      // Show warning if any
      if (result.warning) {
        toast.warning(result.warning);
      }
      
      // Update blackboard if changed
      if (result.blackboardUpdate && Object.keys(result.blackboardUpdate).length > 0) {
        const update = result.blackboardUpdate as Partial<BlackboardState>;
        set(state => ({
          blackboard: state.blackboard 
            ? { ...state.blackboard, ...update } 
            : { consensus: '', conflicts: '', nextStep: '', facts: '', ...update },
        }));
      }
      
      // Handle different actions
      if (result.action === 'WAIT_FOR_USER') {
        set({ orchestratorRunning: false });
        toast.info('Orchestrator waiting for user input');
        return;
      }
      
      if (result.action === 'TRIGGER_PERSONA' && result.personaId) {
        // Trigger the persona response
        await get().triggerPersonaResponse(result.personaId);
        
        // Continue orchestration loop if not paused
        const { orchestratorPaused: stillPaused } = get();
        if (!stillPaused) {
          // Small delay to prevent rapid-fire requests
          setTimeout(() => {
            get().processOrchestratorTurn();
          }, 1000);
        } else {
          set({ orchestratorRunning: false });
        }
      }
    } catch (error) {
      toast.error('Orchestrator error');
      set({ orchestratorRunning: false });
    }
  },

  pauseOrchestrator: () => {
    set({ orchestratorPaused: true });
    toast.info('Orchestrator paused');
  },

  resumeOrchestrator: () => {
    set({ orchestratorPaused: false });
    toast.info('Orchestrator resumed');
    // Resume processing
    get().processOrchestratorTurn();
  },

  resetCircuitBreaker: async () => {
    const { currentSession } = get();
    if (!currentSession) return;
    
    try {
      const result = await window.electronOrchestrator.resetCircuitBreaker(currentSession.id);
      if (result.success) {
        await get().updateSession(currentSession.id, { autoReplyCount: 0 });
        set({ orchestratorPaused: false });
        toast.success('Circuit breaker reset');
        // Resume orchestration
        get().processOrchestratorTurn();
      } else {
        toast.error(result.error || 'Failed to reset circuit breaker');
      }
    } catch (error) {
      toast.error('Error resetting circuit breaker');
    }
  },

  exportSessionToMarkdown: async (sessionId: string) => {
    try {
      set({ isLoading: true });
      const result = await window.electronExport.exportSessionToMarkdown(sessionId);
      
      if (result.success) {
        if (result.cancelled) {
          toast.info('Export cancelled');
        } else {
          toast.success(`Session exported successfully (${result.messageCount} messages)`);
        }
        return true;
      } else {
        toast.error(result.error || 'Failed to export session');
        return false;
      }
    } catch (error) {
      toast.error('Error exporting session');
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  archiveSession: async (id: string) => {
    try {
      set({ isLoading: true });
      const result = await window.electronDB.archiveSession(id);
      
      if (result.success) {
        const now = new Date().toISOString();
        set(state => ({
          sessions: state.sessions.map(s => 
            s.id === id 
              ? { ...s, status: 'archived' as const, archivedAt: now }
              : s
          ),
          currentSession: state.currentSession?.id === id 
            ? { ...state.currentSession, status: 'archived', archivedAt: now }
            : state.currentSession,
        }));
        toast.success('Session archived successfully');
        return true;
      } else {
        toast.error(result.error || 'Failed to archive session');
        return false;
      }
    } catch (error) {
      toast.error('Error archiving session');
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  unarchiveSession: async (id: string) => {
    try {
      set({ isLoading: true });
      const result = await window.electronDB.unarchiveSession(id);
      
      if (result.success) {
        set(state => ({
          sessions: state.sessions.map(s => 
            s.id === id 
              ? { ...s, status: 'active' as const, archivedAt: null }
              : s
          ),
          currentSession: state.currentSession?.id === id 
            ? { ...state.currentSession, status: 'active', archivedAt: null }
            : state.currentSession,
        }));
        toast.success('Session unarchived successfully');
        return true;
      } else {
        toast.error(result.error || 'Failed to unarchive session');
        return false;
      }
    } catch (error) {
      toast.error('Error unarchiving session');
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
}));
