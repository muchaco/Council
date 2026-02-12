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

const mockElectronConductor = {
  enable: vi.fn(),
  disable: vi.fn(),
  processTurn: vi.fn(),
  resetCircuitBreaker: vi.fn(),
  getBlackboard: vi.fn(),
  updateBlackboard: vi.fn(),
};

const mockElectronExport = {
  exportSessionToMarkdown: vi.fn(),
};

const makeSession = (overrides: Partial<Session> = {}): Session => ({
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
  ...overrides,
});

describe('session_store_conductor_shell_spec', () => {
  beforeEach(() => {
    useSessionsStore.setState({
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
    });

    vi.clearAllMocks();

    Object.assign(window, {
      electronDB: mockElectronDB,
      electronConductor: mockElectronConductor,
      electronExport: mockElectronExport,
      electronLLM: {
        chat: vi.fn().mockResolvedValue({
          success: true,
          data: {
            content: 'Response',
            tokenCount: 20,
          },
        }),
      },
    });
  });

  describe('message_turn_number_contracts', () => {
    it('uses_the_backend_turn_number_when_sending_a_user_message', async () => {
      const currentSession = makeSession();
      useSessionsStore.setState({ currentSession });

      mockElectronDB.getNextTurnNumber.mockResolvedValue({ success: true, data: 7 });
      mockElectronDB.createMessage.mockResolvedValue({
        success: true,
        data: {
          id: 'message-1',
          sessionId: 'session-1',
          personaId: null,
          source: 'user',
          content: 'hello',
          turnNumber: 7,
          tokenCount: 0,
          metadata: null,
          createdAt: '2024-01-01',
        },
      });

      await useSessionsStore.getState().sendUserMessage('hello');

      expect(mockElectronDB.getNextTurnNumber).toHaveBeenCalledWith('session-1');
      expect(mockElectronDB.createMessage).toHaveBeenCalledWith({
        sessionId: 'session-1',
        personaId: null,
        source: 'user',
        content: 'hello',
        turnNumber: 7,
        tokenCount: 0,
      });
    });

    it('uses_the_backend_turn_number_when_triggering_a_persona_response', async () => {
      const currentSession = makeSession({ tokenCount: 10 });
      useSessionsStore.setState({
        currentSession,
        sessionPersonas: [
          {
            id: 'persona-1',
            name: 'Advisor',
            role: 'Advisor',
            systemPrompt: 'Assist',
            geminiModel: 'gemini-2.0-flash',
            temperature: 0.4,
            color: '#3B82F6',
            hiddenAgenda: undefined,
            verbosity: undefined,
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
            isConductor: false,
            hushTurnsRemaining: 0,
            hushedAt: null,
          },
        ],
      });

      mockElectronDB.getNextTurnNumber.mockResolvedValue({ success: true, data: 12 });
      mockElectronDB.createMessage.mockResolvedValue({
        success: true,
        data: {
          id: 'message-2',
          sessionId: 'session-1',
          personaId: 'persona-1',
          source: 'persona',
          content: 'Response',
          turnNumber: 12,
          tokenCount: 20,
          metadata: null,
          createdAt: '2024-01-01',
        },
      });
      mockElectronDB.updateSession.mockResolvedValue({
        success: true,
        data: { ...currentSession, tokenCount: 30 },
      });

      await useSessionsStore.getState().triggerPersonaResponse('persona-1');

      expect(mockElectronDB.getNextTurnNumber).toHaveBeenCalledWith('session-1');
      expect(mockElectronDB.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({ turnNumber: 12, personaId: 'persona-1' })
      );
    });
  });

  describe('refresh_after_successful_commands', () => {
    it('refreshes_session_personas_after_a_hush_command', async () => {
      useSessionsStore.setState({ currentSession: makeSession() });

      const refreshedPersonas = [
        {
          id: 'persona-1',
          name: 'Analyst',
          role: 'Analyst',
          systemPrompt: 'Analyze',
          geminiModel: 'gemini-2.0-flash',
          temperature: 0.3,
          color: '#3B82F6',
          hiddenAgenda: undefined,
          verbosity: undefined,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
          isConductor: false,
          hushTurnsRemaining: 3,
          hushedAt: '2024-01-03T00:00:00.000Z',
        },
      ];

      mockElectronDB.hushPersona.mockResolvedValue({ success: true });
      mockElectronDB.getSessionPersonas.mockResolvedValue({ success: true, data: refreshedPersonas });

      const result = await useSessionsStore.getState().hushPersona('persona-1', 3);

      expect(result).toBe(true);
      expect(useSessionsStore.getState().sessionPersonas).toEqual(refreshedPersonas);
    });

    it('refreshes_session_state_after_an_archive_command', async () => {
      const activeSession = makeSession();
      const archivedSession = makeSession({ status: 'archived', archivedAt: '2024-01-05T00:00:00.000Z' });

      useSessionsStore.setState({ sessions: [activeSession], currentSession: activeSession });
      mockElectronDB.archiveSession.mockResolvedValue({ success: true });
      mockElectronDB.getSession.mockResolvedValue({ success: true, data: archivedSession });

      const result = await useSessionsStore.getState().archiveSession('session-1');

      expect(result).toBe(true);
      expect(useSessionsStore.getState().sessions[0]).toEqual(archivedSession);
      expect(useSessionsStore.getState().currentSession).toEqual(archivedSession);
    });

    it('warns_when_hush_refresh_fails_after_a_successful_hush_command', async () => {
      useSessionsStore.setState({ currentSession: makeSession() });

      mockElectronDB.hushPersona.mockResolvedValue({ success: true });
      mockElectronDB.getSessionPersonas.mockResolvedValue({ success: false, error: 'refresh failed' });

      const result = await useSessionsStore.getState().hushPersona('persona-1', 2);

      expect(result).toBe(true);
      expect(toast.warning).toHaveBeenCalledWith('Persona hushed, but failed to refresh participant state');
    });

    it('warns_when_archive_refresh_fails_after_a_successful_archive_command', async () => {
      const activeSession = makeSession();

      useSessionsStore.setState({ sessions: [activeSession], currentSession: activeSession });
      mockElectronDB.archiveSession.mockResolvedValue({ success: true });
      mockElectronDB.getSession.mockResolvedValue({ success: false, error: 'refresh failed' });

      const result = await useSessionsStore.getState().archiveSession('session-1');

      expect(result).toBe(true);
      expect(toast.warning).toHaveBeenCalledWith('Session archived, but failed to refresh session state');
    });

    it('warns_when_unarchive_refresh_fails_after_a_successful_unarchive_command', async () => {
      const archivedSession = makeSession({ status: 'archived', archivedAt: '2024-01-02' });

      useSessionsStore.setState({ sessions: [archivedSession], currentSession: archivedSession });
      mockElectronDB.unarchiveSession.mockResolvedValue({ success: true });
      mockElectronDB.getSession.mockResolvedValue({ success: false, error: 'refresh failed' });

      const result = await useSessionsStore.getState().unarchiveSession('session-1');

      expect(result).toBe(true);
      expect(toast.warning).toHaveBeenCalledWith('Session unarchived, but failed to refresh session state');
    });

    it('warns_when_unhush_refresh_fails_after_a_successful_unhush_command', async () => {
      const session = makeSession();
      useSessionsStore.setState({ currentSession: session });

      mockElectronDB.unhushPersona.mockResolvedValue({ success: true });
      mockElectronDB.getSessionPersonas.mockResolvedValue({ success: false, error: 'refresh failed' });

      const result = await useSessionsStore.getState().unhushPersona('persona-1');

      expect(result).toBe(true);
      expect(toast.warning).toHaveBeenCalledWith('Persona unhushed, but failed to refresh participant state');
    });
  });

  describe('conductor_runtime_state_changes', () => {
    it('enables_conductor_and_persists_session_state', async () => {
      const session = makeSession();
      useSessionsStore.setState({ currentSession: session, sessions: [session] });

      mockElectronConductor.enable.mockResolvedValue({ success: true });
      mockElectronDB.updateSession.mockResolvedValue({
        success: true,
        data: makeSession({ conductorEnabled: true, conductorMode: 'manual' }),
      });

      await useSessionsStore.getState().enableConductor('manual');

      expect(mockElectronConductor.enable).toHaveBeenCalledWith('session-1', 'manual');
      expect(mockElectronDB.updateSession).toHaveBeenCalledWith('session-1', {
        conductorEnabled: true,
        conductorMode: 'manual',
      });
      expect(toast.success).toHaveBeenCalledWith('Conductor enabled');
    });

    it('disables_conductor_and_clears_runtime_flags', async () => {
      const session = makeSession({ conductorEnabled: true, conductorMode: 'manual' });
      useSessionsStore.setState({
        currentSession: session,
        sessions: [session],
        conductorRunning: true,
        conductorPaused: true,
      });

      mockElectronConductor.disable.mockResolvedValue({ success: true });
      mockElectronDB.updateSession.mockResolvedValue({
        success: true,
        data: makeSession({ conductorEnabled: false, conductorMode: 'manual' }),
      });

      await useSessionsStore.getState().disableConductor();

      expect(mockElectronConductor.disable).toHaveBeenCalledWith('session-1');
      expect(useSessionsStore.getState().conductorRunning).toBe(false);
      expect(useSessionsStore.getState().conductorPaused).toBe(false);
      expect(toast.success).toHaveBeenCalledWith('Conductor disabled');
    });

    it('pauses_the_loop_when_process_turn_returns_circuit_breaker', async () => {
      const session = makeSession({ conductorEnabled: true, conductorMode: 'manual' });
      useSessionsStore.setState({ currentSession: session, sessions: [session] });

      mockElectronConductor.processTurn.mockResolvedValue({
        success: false,
        code: 'CIRCUIT_BREAKER',
        error: 'Stop auto replies',
      });

      await useSessionsStore.getState().processConductorTurn();

      expect(useSessionsStore.getState().conductorPaused).toBe(true);
      expect(toast.warning).toHaveBeenCalledWith('Stop auto replies');
    });

    it('stops_running_when_process_turn_returns_wait_for_user', async () => {
      const session = makeSession({ conductorEnabled: true, conductorMode: 'manual' });
      useSessionsStore.setState({
        currentSession: session,
        sessions: [session],
        conductorRunning: false,
        sessionPersonas: [
          {
            id: 'persona-1',
            name: 'Architect',
            role: 'Architecture',
            systemPrompt: 'Focus on rollout strategy',
            geminiModel: 'gemini-2.0-flash',
            temperature: 0.3,
            color: '#3B82F6',
            hiddenAgenda: undefined,
            verbosity: undefined,
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
            isConductor: false,
            hushTurnsRemaining: 0,
            hushedAt: null,
          },
        ],
      });

      mockElectronConductor.processTurn.mockResolvedValue({
        success: true,
        action: 'WAIT_FOR_USER',
        blackboardUpdate: { nextStep: 'Await user answer' },
        suggestedPersonaId: 'persona-1',
      });

      await useSessionsStore.getState().processConductorTurn();

      expect(useSessionsStore.getState().conductorRunning).toBe(false);
      expect(useSessionsStore.getState().blackboard).toEqual({
        consensus: '',
        conflicts: '',
        nextStep: 'Await user answer',
        facts: '',
      });
      expect(toast.info).toHaveBeenCalledWith('Conductor waiting for user input');
      expect(toast.info).toHaveBeenCalledWith('Suggested next speaker: Architect');
    });

    it('resets_the_circuit_breaker_then_continues_the_loop', async () => {
      const session = makeSession({ conductorEnabled: true, conductorMode: 'manual' });
      useSessionsStore.setState({ currentSession: session, sessions: [session], conductorPaused: true });

      mockElectronConductor.resetCircuitBreaker.mockResolvedValue({ success: true });
      mockElectronDB.updateSession.mockResolvedValue({
        success: true,
        data: makeSession({ conductorEnabled: true, conductorMode: 'manual', autoReplyCount: 0 }),
      });
      mockElectronConductor.processTurn.mockResolvedValue({
        success: true,
        action: 'WAIT_FOR_USER',
        blackboardUpdate: {},
      });

      await useSessionsStore.getState().resetCircuitBreaker();

      expect(mockElectronConductor.resetCircuitBreaker).toHaveBeenCalledWith('session-1');
      expect(mockElectronConductor.processTurn).toHaveBeenCalledWith('session-1');
      expect(toast.success).toHaveBeenCalledWith('Circuit breaker reset');
    });
  });

  describe('export_and_cleanup_boundaries', () => {
    it('returns_true_when_export_is_cancelled_by_the_user', async () => {
      mockElectronExport.exportSessionToMarkdown.mockResolvedValue({ success: true, cancelled: true });

      const result = await useSessionsStore.getState().exportSessionToMarkdown('session-1');

      expect(result).toBe(true);
      expect(toast.info).toHaveBeenCalledWith('Export cancelled');
    });

    it('deletes_the_session_even_if_orphaned_tag_cleanup_fails', async () => {
      const session = makeSession();
      useSessionsStore.setState({ currentSession: session, sessions: [session] });

      mockElectronDB.deleteSession.mockResolvedValue({ success: true });
      mockElectronDB.tags.cleanupOrphaned.mockRejectedValue(new Error('cleanup failed'));

      const result = await useSessionsStore.getState().deleteSession('session-1');

      expect(result).toBe(true);
      expect(useSessionsStore.getState().sessions).toEqual([]);
      expect(useSessionsStore.getState().currentSession).toBeNull();
      expect(toast.success).toHaveBeenCalledWith('Session deleted successfully');
    });
  });
});
