import { create } from 'zustand';
import { toast } from 'sonner';
import type { Session, SessionInput, Message, Persona } from '../lib/types';

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
  
  // Actions
  fetchSessions: () => Promise<void>;
  createSession: (data: SessionInput, personaIds: string[]) => Promise<string | null>;
  loadSession: (id: string) => Promise<void>;
  updateSession: (id: string, data: Partial<SessionInput> & { status?: string; tokenCount?: number; costEstimate?: number }) => Promise<void>;
  deleteSession: (id: string) => Promise<boolean>;
  sendUserMessage: (content: string) => Promise<void>;
  triggerPersonaResponse: (personaId: string) => Promise<void>;
  clearCurrentSession: () => void;
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  currentSession: null,
  messages: [],
  sessionPersonas: [],
  isLoading: false,
  thinkingPersonaId: null,

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

  createSession: async (data: SessionInput, personaIds: string[]) => {
    try {
      set({ isLoading: true });
      
      // Create session
      const sessionResult = await window.electronDB.createSession(data);
      if (!sessionResult.success || !sessionResult.data) {
        toast.error(sessionResult.error || 'Failed to create session');
        return null;
      }
      
      const session = sessionResult.data as Session;
      
      // Add personas to session
      for (const personaId of personaIds) {
        await window.electronDB.addPersonaToSession(session.id, personaId, false);
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
      
      const request = {
        personaId,
        sessionId: currentSession.id,
        model: persona.geminiModel,
        systemPrompt: persona.systemPrompt,
        temperature: persona.temperature,
        problemContext: currentSession.problemDescription,
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
    });
  },
}));
