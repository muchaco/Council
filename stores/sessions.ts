import { create } from 'zustand';
import { toast } from 'sonner';
import { Effect, Either } from 'effect';
import type { Session, SessionInput, Message, Persona, BlackboardState, Tag } from '../lib/types';
import {
  executeAssignSessionTag,
  executeRemoveSessionTag,
  executeValidateSessionTagRequestList,
  SessionTagPersistence,
} from '../lib/application/use-cases/session-tags';
import {
  executeSendSessionUserMessage,
  executeTriggerSessionPersonaResponse,
  SessionMessagePersistence,
  SessionPersonaResponseGateway,
} from '../lib/application/use-cases/session-messaging';
import { makeSessionTagPersistenceFromElectronDB } from '../lib/infrastructure/db';
import {
  makeSessionMessagePersistenceFromElectronDB,
} from '../lib/infrastructure/db';
import { makeSessionPersonaResponseGatewayFromElectronLLM } from '../lib/infrastructure/llm';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isBlackboardState = (value: unknown): value is BlackboardState => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.consensus === 'string' &&
    typeof value.conflicts === 'string' &&
    typeof value.nextStep === 'string' &&
    typeof value.facts === 'string'
  );
};

const isTag = (value: unknown): value is Tag =>
  isRecord(value) && typeof value.id === 'number' && typeof value.name === 'string' && typeof value.createdAt === 'string';

const isMessage = (value: unknown): value is Message =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.sessionId === 'string' &&
  (typeof value.personaId === 'string' || value.personaId === null) &&
  typeof value.content === 'string' &&
  typeof value.turnNumber === 'number' &&
  typeof value.tokenCount === 'number' &&
  typeof value.createdAt === 'string';

const isSessionBase = (value: unknown): value is Omit<Session, 'tags'> & { tags?: unknown } =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.title === 'string' &&
  typeof value.problemDescription === 'string' &&
  typeof value.outputGoal === 'string' &&
  (value.status === 'active' || value.status === 'completed' || value.status === 'archived') &&
  typeof value.tokenCount === 'number' &&
  typeof value.costEstimate === 'number' &&
  typeof value.conductorEnabled === 'boolean' &&
  (typeof value.conductorPersonaId === 'string' || value.conductorPersonaId === null) &&
  (value.blackboard === null || isBlackboardState(value.blackboard)) &&
  typeof value.autoReplyCount === 'number' &&
  typeof value.tokenBudget === 'number' &&
  (typeof value.summary === 'string' || value.summary === null) &&
  (typeof value.archivedAt === 'string' || value.archivedAt === null) &&
  typeof value.createdAt === 'string' &&
  typeof value.updatedAt === 'string';

const toSession = (value: unknown, fallbackTags: string[] = []): Session | null => {
  if (!isSessionBase(value)) {
    return null;
  }

  const tags = parseStringList(value.tags);

  return {
    id: value.id,
    title: value.title,
    problemDescription: value.problemDescription,
    outputGoal: value.outputGoal,
    status: value.status,
    tokenCount: value.tokenCount,
    costEstimate: value.costEstimate,
    conductorEnabled: value.conductorEnabled,
    conductorPersonaId: value.conductorPersonaId,
    blackboard: value.blackboard,
    autoReplyCount: value.autoReplyCount,
    tokenBudget: value.tokenBudget,
    summary: value.summary,
    archivedAt: value.archivedAt,
    tags: tags ?? fallbackTags,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

const isSessionPersona = (value: unknown): value is SessionPersona =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.role === 'string' &&
  typeof value.systemPrompt === 'string' &&
  typeof value.geminiModel === 'string' &&
  typeof value.temperature === 'number' &&
  typeof value.color === 'string' &&
  (value.hiddenAgenda === undefined || typeof value.hiddenAgenda === 'string') &&
  (value.verbosity === undefined || typeof value.verbosity === 'string') &&
  typeof value.createdAt === 'string' &&
  typeof value.updatedAt === 'string' &&
  typeof value.isConductor === 'boolean' &&
  typeof value.hushTurnsRemaining === 'number' &&
  (typeof value.hushedAt === 'string' || value.hushedAt === null);

const parseTagList = (value: unknown): Tag[] | null =>
  Array.isArray(value) && value.every(isTag) ? value : null;

const parseStringList = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? value : null;

const parseMessageList = (value: unknown): Message[] | null =>
  Array.isArray(value) && value.every(isMessage) ? value : null;

const parseSessionList = (value: unknown): Session[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const sessions: Session[] = [];
  for (const entry of value) {
    const session = toSession(entry, []);
    if (!session) {
      return null;
    }
    sessions.push(session);
  }

  return sessions;
};

const parseSessionPersonaList = (value: unknown): SessionPersona[] | null =>
  Array.isArray(value) && value.every(isSessionPersona) ? value : null;

interface SessionPersona extends Persona {
  isConductor: boolean;
  hushTurnsRemaining: number;
  hushedAt: string | null;
}

interface SessionsState {
  sessions: Session[];
  currentSession: Session | null;
  messages: Message[];
  sessionPersonas: SessionPersona[];
  isLoading: boolean;
  thinkingPersonaId: string | null;
  conductorRunning: boolean;
  conductorPaused: boolean;
  blackboard: BlackboardState | null;
  allTags: Tag[];

  // Actions
  fetchSessions: () => Promise<void>;
  createSession: (data: SessionInput, personaIds: string[], conductorConfig?: { enabled: boolean; conductorPersonaId?: string }, tags?: string[]) => Promise<string | null>;
  loadSession: (id: string) => Promise<void>;
  updateSession: (id: string, data: Partial<SessionInput> & { status?: string; tokenCount?: number; costEstimate?: number; conductorEnabled?: boolean; conductorPersonaId?: string | null; blackboard?: BlackboardState; autoReplyCount?: number; tokenBudget?: number; summary?: string | null; tags?: string[] }) => Promise<void>;
  deleteSession: (id: string) => Promise<boolean>;
  sendUserMessage: (content: string) => Promise<void>;
  triggerPersonaResponse: (personaId: string) => Promise<void>;
  enableConductor: (conductorPersonaId: string) => Promise<void>;
  disableConductor: () => Promise<void>;
  processConductorTurn: () => Promise<void>;
  pauseConductor: () => void;
  resumeConductor: () => void;
  resetCircuitBreaker: () => Promise<void>;
  clearCurrentSession: () => void;
  exportSessionToMarkdown: (sessionId: string) => Promise<boolean>;
  archiveSession: (id: string) => Promise<boolean>;
  unarchiveSession: (id: string) => Promise<boolean>;
  hushPersona: (personaId: string, turns: number) => Promise<boolean>;
  unhushPersona: (personaId: string) => Promise<boolean>;
  fetchAllTags: () => Promise<void>;
  addTagToSession: (sessionId: string, tagName: string) => Promise<boolean>;
  removeTagFromSession: (sessionId: string, tagName: string) => Promise<boolean>;
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  currentSession: null,
  messages: [],
  sessionPersonas: [],
  isLoading: false,
  thinkingPersonaId: null,
  conductorRunning: false,
  conductorPaused: false,
  blackboard: null,
  allTags: [],

  fetchAllTags: async () => {
    try {
      const result = await window.electronDB.tags.getAll();
      const parsedTags = parseTagList(result.data);
      if (result.success && parsedTags) {
        set({ allTags: parsedTags });
      }
    } catch (error) {
      console.error('Error fetching all tags:', error);
    }
  },

  addTagToSession: async (sessionId: string, tagName: string) => {
    try {
      const { sessions, currentSession, allTags } = get();
      const sessionFromCollection = sessions.find(s => s.id === sessionId);
      const session =
        sessionFromCollection ??
        (currentSession?.id === sessionId ? currentSession : null);

      if (!session) {
        toast.error('Session not found');
        return false;
      }

      const outcome = await Effect.runPromise(
        executeAssignSessionTag({
          sessionId,
          requestedTagName: tagName,
          assignedTagNames: session.tags,
          availableTags: allTags,
        }).pipe(
          Effect.provideService(
            SessionTagPersistence,
            makeSessionTagPersistenceFromElectronDB(window.electronDB)
          ),
          Effect.either
        )
      );

      if (Either.isLeft(outcome)) {
        toast.error(outcome.left.message);
        return false;
      }

      const createdTag = outcome.right.createdTag;
      if (createdTag !== null) {
        set(state => ({ allTags: [...state.allTags, createdTag] }));
      }

      // Update local state
      const updatedTags = [...outcome.right.nextAssignedTagNames];
      set(state => ({
        sessions: state.sessions.map(s =>
          s.id === sessionId ? { ...s, tags: updatedTags } : s
        ),
        currentSession: state.currentSession?.id === sessionId
          ? { ...state.currentSession, tags: updatedTags }
          : state.currentSession,
      }));

      return true;
    } catch (error) {
      toast.error('Error adding tag to session');
      return false;
    }
  },

  removeTagFromSession: async (sessionId: string, tagName: string) => {
    try {
      const { sessions, currentSession, allTags } = get();
      const sessionFromCollection = sessions.find(s => s.id === sessionId);
      const session =
        sessionFromCollection ??
        (currentSession?.id === sessionId ? currentSession : null);

      if (!session) {
        toast.error('Session not found');
        return false;
      }

      const outcome = await Effect.runPromise(
        executeRemoveSessionTag({
          sessionId,
          requestedTagName: tagName,
          assignedTagNames: session.tags,
          availableTags: allTags,
        }).pipe(
          Effect.provideService(
            SessionTagPersistence,
            makeSessionTagPersistenceFromElectronDB(window.electronDB)
          ),
          Effect.either
        )
      );

      if (Either.isLeft(outcome)) {
        toast.error(outcome.left.message);
        return false;
      }

      // Update local state
      const updatedTags = [...outcome.right.nextAssignedTagNames];
      set(state => ({
        sessions: state.sessions.map(s =>
          s.id === sessionId ? { ...s, tags: updatedTags } : s
        ),
        currentSession: state.currentSession?.id === sessionId
          ? { ...state.currentSession, tags: updatedTags }
          : state.currentSession,
      }));

      if (outcome.right.refreshedTagCatalog) {
        set({ allTags: [...outcome.right.refreshedTagCatalog] });
      }

      return true;
    } catch (error) {
      toast.error('Error removing tag from session');
      return false;
    }
  },

  fetchSessions: async () => {
    try {
      set({ isLoading: true });
      const result = await window.electronDB.getSessions();
      const parsedSessions = parseSessionList(result.data);
      if (result.success && parsedSessions) {
        set({ sessions: parsedSessions });
      } else {
        toast.error(result.error || 'Failed to fetch sessions');
      }
    } catch (error) {
      toast.error('Error fetching sessions');
    } finally {
      set({ isLoading: false });
    }
  },

  createSession: async (data: SessionInput, personaIds: string[], conductorConfig?: { enabled: boolean; conductorPersonaId?: string }, tags?: string[]) => {
    try {
      set({ isLoading: true });

      const validationOutcome = await Effect.runPromise(
        executeValidateSessionTagRequestList(tags ?? []).pipe(Effect.either)
      );

      if (Either.isLeft(validationOutcome)) {
        toast.error(validationOutcome.left.message);
        return null;
      }

      const validatedTags = [...validationOutcome.right];

      // Create session with conductor config
      const sessionResult = await window.electronDB.createSession({ ...data, conductorConfig });
      if (!sessionResult.success || !sessionResult.data) {
        toast.error(sessionResult.error || 'Failed to create session');
        return null;
      }

      const session = toSession(sessionResult.data, []);
      if (!session) {
        toast.error('Invalid session payload');
        return null;
      }

      // Add personas to session
      for (const personaId of personaIds) {
        const isConductor = !!(conductorConfig?.enabled && conductorConfig.conductorPersonaId === personaId);
        await window.electronDB.addPersonaToSession(session.id, personaId, isConductor);
      }

      set(state => ({
        sessions: [session, ...state.sessions],
      }));

      for (const requestedTagName of validatedTags) {
        await get().addTagToSession(session.id, requestedTagName);
      }

      const sessionAfterTagAssignments = get().sessions.find((existing) => existing.id === session.id);
      const sessionTags = sessionAfterTagAssignments?.tags ?? [];
      const createdSession = {
        ...session,
        tags: sessionTags,
      };

      set(state => ({
        sessions: state.sessions.map(existing =>
          existing.id === createdSession.id ? createdSession : existing
        ),
      }));

      toast.success('Session created successfully');
      return createdSession.id;
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
      
      // Get session tags
      const tagsResult = await window.electronDB.sessionTags.getBySession(id);
      const sessionTags = parseStringList(tagsResult.data) ?? [];

      const parsedSession = toSession(sessionResult.data, sessionTags);
      if (!parsedSession) {
        toast.error('Invalid session payload');
        return;
      }

      const parsedMessages = parseMessageList(messagesResult.data);
      if (parsedMessages === null) {
        toast.error('Invalid messages payload');
        return;
      }

      const parsedSessionPersonas = parseSessionPersonaList(personasResult.data);
      if (parsedSessionPersonas === null) {
        toast.error('Invalid session personas payload');
        return;
      }
      
      // Combine session data with tags
      const sessionWithTags = {
        ...parsedSession,
      };
      
      set({
        currentSession: sessionWithTags,
        messages: parsedMessages,
        sessionPersonas: parsedSessionPersonas,
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
      const updated = toSession(result.data, []);
      if (result.success && updated) {
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
        // Clean up orphaned tags (tags with no session associations)
        try {
          await window.electronDB.tags.cleanupOrphaned();
        } catch (cleanupError) {
          console.error('Error cleaning up orphaned tags:', cleanupError);
          // Non-fatal error, don't fail the delete operation
        }
        
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
    const { currentSession } = get();
    if (!currentSession) return;
    
    try {
      const outcome = await Effect.runPromise(
        executeSendSessionUserMessage({
          sessionId: currentSession.id,
          content,
        }).pipe(
          Effect.provideService(
            SessionMessagePersistence,
            makeSessionMessagePersistenceFromElectronDB(window.electronDB)
          ),
          Effect.either
        )
      );

      if (Either.isRight(outcome)) {
        set(state => ({
          messages: [...state.messages, outcome.right],
        }));
      } else {
        toast.error(outcome.left.message);
      }
    } catch (error) {
      toast.error('Error sending message');
    }
  },

  triggerPersonaResponse: async (personaId: string) => {
    const { currentSession, sessionPersonas } = get();
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
        session: currentSession,
        persona,
        blackboard,
        otherPersonas,
      };

      const outcome = await Effect.runPromise(
        executeTriggerSessionPersonaResponse(request).pipe(
          Effect.provideService(
            SessionPersonaResponseGateway,
            makeSessionPersonaResponseGatewayFromElectronLLM(window.electronLLM)
          ),
          Effect.provideService(
            SessionMessagePersistence,
            makeSessionMessagePersistenceFromElectronDB(window.electronDB)
          ),
          Effect.either
        )
      );

      if (Either.isLeft(outcome)) {
        toast.error(outcome.left.message);
        return;
      }

      set(state => ({
        messages: [...state.messages, outcome.right.createdMessage],
        sessions: state.sessions.map(s =>
          s.id === currentSession.id ? outcome.right.updatedSession : s
        ),
        currentSession:
          state.currentSession?.id === currentSession.id
            ? outcome.right.updatedSession
            : state.currentSession,
      }));
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
      conductorRunning: false,
      conductorPaused: false,
      blackboard: null,
    });
  },

  // Conductor actions
  enableConductor: async (conductorPersonaId: string) => {
    const { currentSession } = get();
    if (!currentSession) return;
    
    try {
      const result = await window.electronConductor.enable(currentSession.id, conductorPersonaId);
      if (result.success) {
        await get().updateSession(currentSession.id, {
          conductorEnabled: true,
          conductorPersonaId,
        });
        toast.success('Conductor enabled');
      } else {
        toast.error(result.error || 'Failed to enable conductor');
      }
    } catch (error) {
      toast.error('Error enabling conductor');
    }
  },

  disableConductor: async () => {
    const { currentSession } = get();
    if (!currentSession) return;
    
    try {
      const result = await window.electronConductor.disable(currentSession.id);
      if (result.success) {
        await get().updateSession(currentSession.id, {
          conductorEnabled: false,
          conductorPersonaId: null,
        });
        set({ conductorRunning: false, conductorPaused: false });
        toast.success('Conductor disabled');
      } else {
        toast.error(result.error || 'Failed to disable conductor');
      }
    } catch (error) {
      toast.error('Error disabling conductor');
    }
  },

  processConductorTurn: async () => {
    const { currentSession, conductorPaused } = get();
    if (!currentSession || !currentSession.conductorEnabled || conductorPaused) return;
    
    try {
      set({ conductorRunning: true });
      
      const result = await window.electronConductor.processTurn(currentSession.id);
      
      if (!result.success) {
        if (result.code === 'CIRCUIT_BREAKER') {
          set({ conductorPaused: true });
          toast.warning(result.error || 'Circuit breaker triggered');
        } else if (result.code === 'SELECTOR_AGENT_ERROR') {
          set({ conductorRunning: false });
          toast.error(result.error || 'Selector agent error');
        } else if (result.code === 'API_KEY_NOT_CONFIGURED') {
          set({ conductorRunning: false, conductorPaused: true });
          toast.error(result.error || 'API key not configured');
        } else if (result.code === 'API_KEY_DECRYPT_FAILED') {
          set({ conductorRunning: false, conductorPaused: true });
          toast.error(result.error || 'Failed to decrypt API key');
        } else if (result.code === 'SETTINGS_READ_ERROR') {
          set({ conductorRunning: false, conductorPaused: true });
          toast.error(result.error || 'Failed to load conductor settings');
        } else {
          toast.error(result.error || 'Conductor error');
          set({ conductorRunning: false });
        }
        return;
      }
      
      // Show warning if any
      if (result.warning) {
        toast.warning(result.warning);
      }
      
      // Update blackboard if changed
      if (result.blackboardUpdate && Object.keys(result.blackboardUpdate).length > 0) {
        const updateSource = isRecord(result.blackboardUpdate) ? result.blackboardUpdate : {};
        const update: Partial<BlackboardState> = {
          ...(typeof updateSource.consensus === 'string' ? { consensus: updateSource.consensus } : {}),
          ...(typeof updateSource.conflicts === 'string' ? { conflicts: updateSource.conflicts } : {}),
          ...(typeof updateSource.nextStep === 'string' ? { nextStep: updateSource.nextStep } : {}),
          ...(typeof updateSource.facts === 'string' ? { facts: updateSource.facts } : {}),
        };
        set(state => ({
          blackboard: state.blackboard 
            ? { ...state.blackboard, ...update } 
            : { consensus: '', conflicts: '', nextStep: '', facts: '', ...update },
        }));
      }
      
      // Handle different actions
      if (result.action === 'WAIT_FOR_USER') {
        set({ conductorRunning: false });
        toast.info('Conductor waiting for user input');
        return;
      }
      
      if (result.action === 'TRIGGER_PERSONA' && result.personaId) {
        // Trigger the persona response
        await get().triggerPersonaResponse(result.personaId);
        
        // Continue orchestration loop if not paused
        const { conductorPaused: stillPaused } = get();
        if (!stillPaused) {
          // Small delay to prevent rapid-fire requests
          setTimeout(() => {
            get().processConductorTurn();
          }, 1000);
        } else {
          set({ conductorRunning: false });
        }
      }
    } catch (error) {
      toast.error('Conductor error');
      set({ conductorRunning: false });
    }
  },

  pauseConductor: () => {
    set({ conductorPaused: true });
    toast.info('Conductor paused');
  },

  resumeConductor: () => {
    set({ conductorPaused: false });
    toast.info('Conductor resumed');
    // Resume processing
    get().processConductorTurn();
  },

  resetCircuitBreaker: async () => {
    const { currentSession } = get();
    if (!currentSession) return;
    
    try {
      const result = await window.electronConductor.resetCircuitBreaker(currentSession.id);
      if (result.success) {
        await get().updateSession(currentSession.id, { autoReplyCount: 0 });
        set({ conductorPaused: false });
        toast.success('Circuit breaker reset');
        // Resume orchestration
        get().processConductorTurn();
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

  hushPersona: async (personaId: string, turns: number) => {
    const { currentSession } = get();
    if (!currentSession) return false;
    
    try {
      const result = await window.electronDB.hushPersona(currentSession.id, personaId, turns);
      if (result.success) {
        const refreshedPersonas = await window.electronDB.getSessionPersonas(currentSession.id);
        const parsedSessionPersonas = parseSessionPersonaList(refreshedPersonas.data);
        if (refreshedPersonas.success && parsedSessionPersonas) {
          set({ sessionPersonas: parsedSessionPersonas });
          toast.success(`Persona hushed for ${turns} turns`);
          return true;
        }

        console.warn('Persona hush succeeded but refresh failed', refreshedPersonas.error);
        toast.warning('Persona hushed, but failed to refresh participant state');
        return true;
      } else {
        toast.error(result.error || 'Failed to hush persona');
        return false;
      }
    } catch (error) {
      toast.error('Error hushing persona');
      return false;
    }
  },

  unhushPersona: async (personaId: string) => {
    const { currentSession } = get();
    if (!currentSession) return false;
    
    try {
      const result = await window.electronDB.unhushPersona(currentSession.id, personaId);
      if (result.success) {
        const refreshedPersonas = await window.electronDB.getSessionPersonas(currentSession.id);
        const parsedSessionPersonas = parseSessionPersonaList(refreshedPersonas.data);
        if (refreshedPersonas.success && parsedSessionPersonas) {
          set({ sessionPersonas: parsedSessionPersonas });
          toast.success('Persona unhushed');
          return true;
        }

        console.warn('Persona unhush succeeded but refresh failed', refreshedPersonas.error);
        toast.warning('Persona unhushed, but failed to refresh participant state');
        return true;
      } else {
        toast.error(result.error || 'Failed to unhush persona');
        return false;
      }
    } catch (error) {
      toast.error('Error unhushing persona');
      return false;
    }
  },

  archiveSession: async (id: string) => {
    try {
      set({ isLoading: true });
      const result = await window.electronDB.archiveSession(id);
      
      if (result.success) {
        const refreshedSessionResult = await window.electronDB.getSession(id);
        const refreshedSession = toSession(refreshedSessionResult.data, []);
        if (refreshedSessionResult.success && refreshedSession) {
          set(state => ({
            sessions: state.sessions.map(s => (s.id === id ? refreshedSession : s)),
            currentSession: state.currentSession?.id === id ? refreshedSession : state.currentSession,
          }));
          toast.success('Session archived successfully');
          return true;
        }

        console.warn('Archive succeeded but session refresh failed', refreshedSessionResult.error);
        toast.warning('Session archived, but failed to refresh session state');
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
        const refreshedSessionResult = await window.electronDB.getSession(id);
        const refreshedSession = toSession(refreshedSessionResult.data, []);
        if (refreshedSessionResult.success && refreshedSession) {
          set(state => ({
            sessions: state.sessions.map(s => (s.id === id ? refreshedSession : s)),
            currentSession: state.currentSession?.id === id ? refreshedSession : state.currentSession,
          }));
          toast.success('Session unarchived successfully');
          return true;
        }

        console.warn('Unarchive succeeded but session refresh failed', refreshedSessionResult.error);
        toast.warning('Session unarchived, but failed to refresh session state');
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
