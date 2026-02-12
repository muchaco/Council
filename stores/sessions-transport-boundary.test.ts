import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { useSessionsStore } from './sessions';
import type { Session } from '../lib/types';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

const mockElectronDB = {
  tags: {
    create: vi.fn(),
    getAll: vi.fn(),
    getByName: vi.fn(),
    delete: vi.fn(),
    cleanupOrphaned: vi.fn(),
  },
  sessionTags: {
    add: vi.fn(),
    remove: vi.fn(),
    getBySession: vi.fn(),
  },
  createSession: vi.fn(),
  getSessions: vi.fn(),
  getSession: vi.fn(),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
  archiveSession: vi.fn(),
  unarchiveSession: vi.fn(),
  getMessages: vi.fn(),
  getSessionPersonas: vi.fn(),
  createMessage: vi.fn(),
  getNextTurnNumber: vi.fn(),
  addPersonaToSession: vi.fn(),
  hushPersona: vi.fn(),
  unhushPersona: vi.fn(),
};

const validSession: Session = {
  id: 'session-1',
  title: 'Session',
  problemDescription: 'Problem',
  outputGoal: 'Goal',
  status: 'active',
  tokenCount: 0,
  costEstimate: 0,
  conductorEnabled: false,
  conductorMode: 'automatic',
  blackboard: null,
  autoReplyCount: 0,
  tokenBudget: 1000,
  summary: null,
  archivedAt: null,
  tags: [],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

describe('session_store_transport_boundary_spec', () => {
  beforeEach(() => {
    useSessionsStore.setState({
      sessions: [],
      currentSession: null,
      messages: [],
      sessionPersonas: [],
      isLoading: false,
      thinkingPersonaId: null,
      conductorFlowState: 'idle',
      blackboard: null,
      allTags: [],
    });

    vi.clearAllMocks();

    Object.assign(window, {
      electronDB: mockElectronDB,
      electronSessionCommand: {
        createFull: (command: unknown) => mockElectronDB.createSession((command as { input: unknown }).input),
        update: (sessionId: string, input: unknown) => mockElectronDB.updateSession(sessionId, input),
        delete: (sessionId: string) => mockElectronDB.deleteSession(sessionId),
        archive: (sessionId: string) => mockElectronDB.archiveSession(sessionId),
        unarchive: (sessionId: string) => mockElectronDB.unarchiveSession(sessionId),
      },
      electronSessionQuery: {
        list: () => mockElectronDB.getSessions(),
        get: (sessionId: string) => mockElectronDB.getSession(sessionId),
        getParticipants: (sessionId: string) => mockElectronDB.getSessionPersonas(sessionId),
        loadSnapshot: async (sessionId: string) => {
          const [sessionResult, messagesResult, participantsResult, tagsResult] = await Promise.all([
            mockElectronDB.getSession(sessionId),
            mockElectronDB.getMessages(sessionId),
            mockElectronDB.getSessionPersonas(sessionId),
            mockElectronDB.sessionTags.getBySession(sessionId),
          ]);
          if (!sessionResult.success || !messagesResult.success || !participantsResult.success || !tagsResult.success) {
            return { success: false, error: 'Snapshot failed' };
          }
          return {
            success: true,
            data: {
              session: sessionResult.data,
              messages: messagesResult.data,
              participants: participantsResult.data,
              tags: tagsResult.data,
            },
          };
        },
      },
      electronConductor: {
        enable: vi.fn(),
        disable: vi.fn(),
        processTurn: vi.fn(),
        resetCircuitBreaker: vi.fn(),
        getBlackboard: vi.fn(),
        updateBlackboard: vi.fn(),
      },
      electronExport: {
        exportSessionToMarkdown: vi.fn(),
      },
    });
  });

  it('preserves_existing_sessions_when_fetch_sessions_payload_is_invalid', async () => {
    useSessionsStore.setState({ sessions: [validSession] });
    mockElectronDB.getSessions.mockResolvedValue({ success: true, data: [{ id: 1 }] });

    await useSessionsStore.getState().fetchSessions();

    expect(useSessionsStore.getState().sessions).toEqual([validSession]);
    expect(toast.error).toHaveBeenCalledWith('Failed to fetch sessions');
  });

  it('rejects_invalid_session_payload_when_loading_a_session', async () => {
    mockElectronDB.getSession.mockResolvedValue({ success: true, data: { id: 'session-1' } });
    mockElectronDB.getMessages.mockResolvedValue({ success: true, data: [] });
    mockElectronDB.getSessionPersonas.mockResolvedValue({ success: true, data: [] });
    mockElectronDB.sessionTags.getBySession.mockResolvedValue({ success: true, data: [] });

    await useSessionsStore.getState().loadSession('session-1');

    expect(useSessionsStore.getState().currentSession).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Invalid session payload');
  });

  it('rejects_invalid_messages_payload_when_loading_a_session', async () => {
    mockElectronDB.getSession.mockResolvedValue({ success: true, data: validSession });
    mockElectronDB.getMessages.mockResolvedValue({ success: true, data: [{ id: 123 }] });
    mockElectronDB.getSessionPersonas.mockResolvedValue({ success: true, data: [] });
    mockElectronDB.sessionTags.getBySession.mockResolvedValue({ success: true, data: [] });

    await useSessionsStore.getState().loadSession('session-1');

    expect(useSessionsStore.getState().currentSession).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Invalid messages payload');
  });

  it('ignores_invalid_updated_session_payload_without_mutating_state', async () => {
    useSessionsStore.setState({ sessions: [validSession], currentSession: validSession });
    mockElectronDB.updateSession.mockResolvedValue({ success: true, data: { id: 'session-1' } });

    await useSessionsStore.getState().updateSession('session-1', { title: 'Updated title' });

    expect(useSessionsStore.getState().sessions[0]).toEqual(validSession);
    expect(useSessionsStore.getState().currentSession).toEqual(validSession);
  });

  it('warns_when_hush_refresh_payload_is_invalid_after_success', async () => {
    useSessionsStore.setState({ currentSession: validSession });
    mockElectronDB.hushPersona.mockResolvedValue({ success: true });
    mockElectronDB.getSessionPersonas.mockResolvedValue({ success: true, data: [{ id: 'persona-1' }] });

    const result = await useSessionsStore.getState().hushPersona('persona-1', 2);

    expect(result).toBe(true);
    expect(toast.warning).toHaveBeenCalledWith('Persona hushed, but failed to refresh participant state');
  });

  it('warns_when_archive_refresh_payload_is_invalid_after_success', async () => {
    useSessionsStore.setState({ sessions: [validSession], currentSession: validSession });
    mockElectronDB.archiveSession.mockResolvedValue({ success: true });
    mockElectronDB.getSession.mockResolvedValue({ success: true, data: { id: 'session-1' } });

    const result = await useSessionsStore.getState().archiveSession('session-1');

    expect(result).toBe(true);
    expect(toast.warning).toHaveBeenCalledWith('Session archived, but failed to refresh session state');
  });

  it('warns_when_unarchive_refresh_payload_is_invalid_after_success', async () => {
    const archivedSession: Session = { ...validSession, status: 'archived', archivedAt: '2024-01-02' };
    useSessionsStore.setState({ sessions: [archivedSession], currentSession: archivedSession });
    mockElectronDB.unarchiveSession.mockResolvedValue({ success: true });
    mockElectronDB.getSession.mockResolvedValue({ success: true, data: { id: 'session-1' } });

    const result = await useSessionsStore.getState().unarchiveSession('session-1');

    expect(result).toBe(true);
    expect(toast.warning).toHaveBeenCalledWith('Session unarchived, but failed to refresh session state');
  });
});
