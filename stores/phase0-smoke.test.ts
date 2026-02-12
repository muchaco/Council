import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

import { useSessionsStore } from './sessions';
import { useSettingsStore } from './settings';
import type { Session } from '../lib/types';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

const sessionFixture: Session = {
  id: 'session-1',
  title: 'Quarterly planning',
  problemDescription: 'Choose a roadmap strategy',
  outputGoal: 'Decision memo',
  status: 'active',
  tokenCount: 0,
  costEstimate: 0,
  conductorEnabled: true,
  conductorMode: 'automatic',
  blackboard: null,
  autoReplyCount: 0,
  tokenBudget: 100000,
  summary: null,
  archivedAt: null,
  tags: [],
  createdAt: '2026-02-12T10:00:00.000Z',
  updatedAt: '2026-02-12T10:00:00.000Z',
};

describe('phase0_smoke_spec', () => {
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

    useSettingsStore.setState({
      isApiKeyConfigured: false,
      isConnected: false,
      isLoading: false,
      isModelCatalogLoading: false,
      modelCatalogError: null,
      defaultModel: '',
      availableModels: [],
      modelsLastFetched: null,
    });

    vi.clearAllMocks();
  });

  it('keeps_session_create_delete_conductor_export_and_model_listing_working', async () => {
    const electronDB = {
      tags: {
        create: vi.fn(),
        getAll: vi.fn(),
        getByName: vi.fn(),
        delete: vi.fn(),
        cleanupOrphaned: vi.fn().mockResolvedValue({ success: true }),
      },
      sessionTags: {
        add: vi.fn(),
        remove: vi.fn(),
        getBySession: vi.fn().mockResolvedValue({ success: true, data: [] }),
      },
      createSession: vi.fn().mockResolvedValue({ success: true, data: sessionFixture }),
      getSessions: vi.fn().mockResolvedValue({ success: true, data: [sessionFixture] }),
      getSession: vi.fn().mockResolvedValue({ success: true, data: sessionFixture }),
      updateSession: vi.fn().mockResolvedValue({ success: true, data: sessionFixture }),
      deleteSession: vi.fn().mockResolvedValue({ success: true }),
      archiveSession: vi.fn(),
      unarchiveSession: vi.fn(),
      createMessage: vi.fn(),
      getMessages: vi.fn().mockResolvedValue({ success: true, data: [] }),
      getNextTurnNumber: vi.fn(),
      addPersonaToSession: vi.fn().mockResolvedValue({ success: true }),
      getSessionPersonas: vi.fn().mockResolvedValue({ success: true, data: [] }),
      hushPersona: vi.fn(),
      unhushPersona: vi.fn(),
    };

    const electronConductor = {
      enable: vi.fn(),
      disable: vi.fn(),
      processTurn: vi.fn().mockResolvedValue({
        success: true,
        action: 'WAIT_FOR_USER',
        reasoning: 'Need human input',
        blackboardUpdate: { nextStep: 'Confirm constraints' },
      }),
      resetCircuitBreaker: vi.fn(),
      getBlackboard: vi.fn(),
      updateBlackboard: vi.fn(),
    };

    const electronExport = {
      exportSessionToMarkdown: vi.fn().mockResolvedValue({ success: true, messageCount: 0 }),
    };

    const electronSettings = {
      getApiKeyStatus: vi.fn().mockResolvedValue({ success: true, data: { configured: true } }),
      setApiKey: vi.fn(),
      testConnection: vi.fn(),
      getDefaultModel: vi.fn(),
      setDefaultModel: vi.fn(),
      getModelCatalog: vi.fn().mockResolvedValue({
        success: true,
        data: {
          configured: true,
          models: [
            {
              name: 'gemini-2.5-flash',
              displayName: 'Gemini 2.5 Flash',
              description: 'Fast model',
              supportedMethods: ['generateContent'],
            },
          ],
          fetchedAtEpochMs: Date.now(),
        },
      }),
      listModels: vi.fn(),
    };

    Object.assign(window, {
      electronDB,
      electronSessionCommand: {
        createFull: (command: unknown) => electronDB.createSession((command as { input: unknown }).input),
        update: (sessionId: string, input: unknown) => electronDB.updateSession(sessionId, input),
        delete: (sessionId: string) => electronDB.deleteSession(sessionId),
        archive: (sessionId: string) => electronDB.archiveSession(sessionId),
        unarchive: (sessionId: string) => electronDB.unarchiveSession(sessionId),
      },
      electronSessionQuery: {
        list: () => electronDB.getSessions(),
        get: (sessionId: string) => electronDB.getSession(sessionId),
        getParticipants: (sessionId: string) => electronDB.getSessionPersonas(sessionId),
        loadSnapshot: async (sessionId: string) => {
          const [sessionResult, messagesResult, participantsResult, tagsResult] = await Promise.all([
            electronDB.getSession(sessionId),
            electronDB.getMessages(sessionId),
            electronDB.getSessionPersonas(sessionId),
            electronDB.sessionTags.getBySession(sessionId),
          ]);
          return {
            success:
              sessionResult.success && messagesResult.success && participantsResult.success && tagsResult.success,
            data: {
              session: sessionResult.data,
              messages: messagesResult.data,
              participants: participantsResult.data,
              tags: tagsResult.data,
            },
          };
        },
      },
      electronConductor,
      electronExport,
      electronSettings,
      electronLLM: {
        chat: vi.fn(),
      },
    });

    await useSessionsStore.getState().fetchSessions();
    const createdSessionId = await useSessionsStore.getState().createSession(
      {
        title: 'Quarterly planning',
        problemDescription: 'Choose a roadmap strategy',
        outputGoal: 'Decision memo',
      },
      ['persona-1'],
      { enabled: true, mode: 'automatic' }
    );

    useSessionsStore.setState({
      currentSession: sessionFixture,
      sessionPersonas: [
        {
          id: 'persona-1',
          name: 'Analyst',
          role: 'Analyst',
          systemPrompt: 'Analyze deeply',
          geminiModel: 'gemini-2.5-flash',
          temperature: 0.2,
          color: '#3B82F6',
          hiddenAgenda: undefined,
          verbosity: undefined,
          createdAt: '2026-02-12T10:00:00.000Z',
          updatedAt: '2026-02-12T10:00:00.000Z',
          isConductor: false,
          hushTurnsRemaining: 0,
          hushedAt: null,
        },
      ],
    });

    await useSessionsStore.getState().processConductorTurn();
    await useSessionsStore.getState().exportSessionToMarkdown('session-1');
    await useSessionsStore.getState().deleteSession('session-1');
    await useSettingsStore.getState().fetchAvailableModels();

    expect(createdSessionId).toBe('session-1');
    expect(electronConductor.processTurn).toHaveBeenCalledWith('session-1');
    expect(electronExport.exportSessionToMarkdown).toHaveBeenCalledWith('session-1');
    expect(electronSettings.getModelCatalog).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Session created successfully');
  });
});
