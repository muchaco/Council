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
import {
  parseSessionPayload,
  parseSessionPayloadList,
} from '../lib/boundary/session-payload-parser';
import {
  parseSessionTransportMessages,
  parseSessionTransportParticipants,
  parseSessionTransportTagNames,
  parseSessionTransportTags,
  type SessionTransportPersona,
} from '../lib/boundary/session-transport-parser';
import { decideConductorTurnShellPlan } from '../lib/shell/renderer/conductor-turn-shell-plan';
import {
  archiveSessionCommand,
  clearPersonaHushCommand,
  createSessionCommand,
  deleteSessionCommand,
  disableConductorCommand,
  enableConductorCommand,
  exportSessionToMarkdownCommand,
  getSessionMessagePersistenceBoundary,
  getSessionTagPersistenceBoundary,
  processConductorTurnCommand,
  resetConductorCircuitBreakerCommand,
  setPersonaHushCommand,
  unarchiveSessionCommand,
  updateSessionCommand,
} from '../lib/shell/renderer/session-command-client';
import {
  loadAllTagsQuery,
  loadSessionByIdQuery,
  loadSessionParticipantsQuery,
  loadSessionSnapshotQuery,
  loadSessionsQuery,
} from '../lib/shell/renderer/session-query-client';
import { makeSessionTagPersistenceFromElectronDB } from '../lib/infrastructure/db';
import {
  makeSessionMessagePersistenceFromElectronDB,
} from '../lib/infrastructure/db';
import { makeSessionPersonaResponseGatewayFromElectronLLM } from '../lib/infrastructure/llm';

const parseSessionList = (value: unknown): Session[] | null =>
  parseSessionPayloadList(value, { allowMissingTags: true, fallbackTags: [] });

type SessionPersona = SessionTransportPersona;

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
  createSession: (data: SessionInput, personaIds: string[], conductorConfig?: { enabled: boolean; mode?: 'automatic' | 'manual' }, tags?: string[]) => Promise<string | null>;
  loadSession: (id: string) => Promise<void>;
  updateSession: (id: string, data: Partial<SessionInput> & { status?: string; tokenCount?: number; costEstimate?: number; conductorEnabled?: boolean; conductorMode?: 'automatic' | 'manual'; blackboard?: BlackboardState; autoReplyCount?: number; tokenBudget?: number; summary?: string | null; tags?: string[] }) => Promise<void>;
  deleteSession: (id: string) => Promise<boolean>;
  sendUserMessage: (content: string) => Promise<void>;
  triggerPersonaResponse: (personaId: string) => Promise<void>;
  enableConductor: (mode: 'automatic' | 'manual') => Promise<void>;
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
      const result = await loadAllTagsQuery();
      const parsedTags = parseSessionTransportTags(result.data);
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
            makeSessionTagPersistenceFromElectronDB(getSessionTagPersistenceBoundary())
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
            makeSessionTagPersistenceFromElectronDB(getSessionTagPersistenceBoundary())
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
      const result = await loadSessionsQuery();
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

  createSession: async (data: SessionInput, personaIds: string[], conductorConfig?: { enabled: boolean; mode?: 'automatic' | 'manual' }, tags?: string[]) => {
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
      const sessionResult = await createSessionCommand({
        input: data,
        personaIds,
        conductorConfig,
      });
      if (!sessionResult.success || !sessionResult.data) {
        toast.error(sessionResult.error || 'Failed to create session');
        return null;
      }

      const session = parseSessionPayload(sessionResult.data, {
        allowMissingTags: true,
        fallbackTags: [],
      });
      if (!session) {
        toast.error('Invalid session payload');
        return null;
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

      const { sessionResult, messagesResult, participantsResult, tagsResult } =
        await loadSessionSnapshotQuery(id);
      if (!sessionResult.success || !sessionResult.data) {
        toast.error(sessionResult.error || 'Failed to load session');
        return;
      }

      if (!messagesResult.success) {
        toast.error(messagesResult.error || 'Failed to load messages');
        return;
      }

      if (!participantsResult.success) {
        toast.error(participantsResult.error || 'Failed to load session personas');
        return;
      }

      const sessionTags = parseSessionTransportTagNames(tagsResult.data) ?? [];

      const parsedSession = parseSessionPayload(sessionResult.data, {
        allowMissingTags: true,
        fallbackTags: sessionTags,
      });
      if (!parsedSession) {
        toast.error('Invalid session payload');
        return;
      }

      const parsedMessages = parseSessionTransportMessages(messagesResult.data);
      if (parsedMessages === null) {
        toast.error('Invalid messages payload');
        return;
      }

      const parsedSessionPersonas = parseSessionTransportParticipants(participantsResult.data);
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
      const result = await updateSessionCommand(id, data);
      const updated = parseSessionPayload(result.data, {
        allowMissingTags: true,
        fallbackTags: [],
      });
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
      const result = await deleteSessionCommand(id);
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
            makeSessionMessagePersistenceFromElectronDB(getSessionMessagePersistenceBoundary())
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
            makeSessionMessagePersistenceFromElectronDB(getSessionMessagePersistenceBoundary())
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
  enableConductor: async (mode: 'automatic' | 'manual') => {
      const { currentSession } = get();
      if (!currentSession) return;
      
      try {
      const result = await enableConductorCommand(currentSession.id, mode);
        if (result.success) {
          await get().updateSession(currentSession.id, {
            conductorEnabled: true,
          conductorMode: mode,
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
      const result = await disableConductorCommand(currentSession.id);
        if (result.success) {
          await get().updateSession(currentSession.id, {
            conductorEnabled: false,
          conductorMode: currentSession.conductorMode,
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
      
      const result = await processConductorTurnCommand(currentSession.id);
      const shellPlan = decideConductorTurnShellPlan(result);

      if (shellPlan.warning) {
        toast.warning(shellPlan.warning);
      }

      if (Object.keys(shellPlan.blackboardUpdate).length > 0) {
        set(state => ({
          blackboard: state.blackboard
            ? { ...state.blackboard, ...shellPlan.blackboardUpdate }
            : { consensus: '', conflicts: '', nextStep: '', facts: '', ...shellPlan.blackboardUpdate },
        }));
      }

      if (shellPlan._tag === 'Failure') {
        set(shellPlan.statePatch);
        if (shellPlan.toast.level === 'warning') {
          toast.warning(shellPlan.toast.message);
        } else if (shellPlan.toast.level === 'info') {
          toast.info(shellPlan.toast.message);
        } else {
          toast.error(shellPlan.toast.message);
        }
        return;
      }

      if (shellPlan._tag === 'WaitForUser') {
        set(shellPlan.statePatch);
        toast.info(shellPlan.toast.message);
        if (shellPlan.suggestedPersonaId) {
          const suggestedPersona = get().sessionPersonas.find(
            (persona) => persona.id === shellPlan.suggestedPersonaId
          );
          toast.info(
            suggestedPersona
              ? `Suggested next speaker: ${suggestedPersona.name}`
              : `Suggested next speaker ID: ${shellPlan.suggestedPersonaId}`
          );
        }
        return;
      }

      if (shellPlan._tag === 'TriggerPersona') {
        // Trigger the persona response
        await get().triggerPersonaResponse(shellPlan.personaId);
        
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
      const result = await resetConductorCircuitBreakerCommand(currentSession.id);
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
      const result = await exportSessionToMarkdownCommand(sessionId);
      
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
      const result = await setPersonaHushCommand(currentSession.id, personaId, turns);
        if (result.success) {
        const refreshedPersonas = await loadSessionParticipantsQuery(currentSession.id);
        const parsedSessionPersonas = parseSessionTransportParticipants(refreshedPersonas.data);
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
      const result = await clearPersonaHushCommand(currentSession.id, personaId);
        if (result.success) {
        const refreshedPersonas = await loadSessionParticipantsQuery(currentSession.id);
        const parsedSessionPersonas = parseSessionTransportParticipants(refreshedPersonas.data);
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
      const result = await archiveSessionCommand(id);
      
        if (result.success) {
        const refreshedSessionResult = await loadSessionByIdQuery(id);
        const refreshedSession = parseSessionPayload(refreshedSessionResult.data, {
          allowMissingTags: true,
          fallbackTags: [],
        });
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
      const result = await unarchiveSessionCommand(id);
      
        if (result.success) {
        const refreshedSessionResult = await loadSessionByIdQuery(id);
        const refreshedSession = parseSessionPayload(refreshedSessionResult.data, {
          allowMissingTags: true,
          fallbackTags: [],
        });
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
