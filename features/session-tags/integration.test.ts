import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { useSessionsStore } from '@/stores/sessions';
import type { Session, Tag } from '@/lib/types';

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

const baseSession: Session = {
  id: 'session-1',
  title: 'Test Session',
  problemDescription: 'A problem to solve',
  outputGoal: 'A solution',
  status: 'active',
  tokenCount: 0,
  costEstimate: 0,
  conductorEnabled: false,
  conductorPersonaId: null,
  blackboard: null,
  autoReplyCount: 0,
  tokenBudget: 1000,
  summary: null,
  archivedAt: null,
  tags: [],
  createdAt: '2026-02-08T00:00:00Z',
  updatedAt: '2026-02-08T00:00:00Z',
};

describe('session_tags_integration_spec', () => {
  beforeEach(() => {
    vi.clearAllMocks();

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

    Object.assign(window, { electronDB: mockElectronDB });
  });

  describe('creating_a_session_with_tags', () => {
    it('persists_normalized_tags_to_the_created_session', async () => {
      const createdTag: Tag = { id: 11, name: 'feature', createdAt: '2026-02-08T00:00:00Z' };

      mockElectronDB.createSession.mockResolvedValue({ success: true, data: baseSession });
      mockElectronDB.addPersonaToSession.mockResolvedValue({ success: true });
      mockElectronDB.tags.getByName.mockResolvedValue({ success: true, data: null });
      mockElectronDB.tags.create.mockResolvedValue({ success: true, data: createdTag });
      mockElectronDB.sessionTags.add.mockResolvedValue({ success: true });

      const createdSessionId = await useSessionsStore
        .getState()
        .createSession(
          {
            title: baseSession.title,
            problemDescription: baseSession.problemDescription,
            outputGoal: baseSession.outputGoal,
          },
          ['persona-1'],
          undefined,
          ['FEATURE']
        );

      expect(createdSessionId).toBe(baseSession.id);
      expect(mockElectronDB.tags.create).toHaveBeenCalledWith('feature');
      expect(useSessionsStore.getState().sessions[0]?.tags).toEqual(['feature']);
      expect(toast.success).toHaveBeenCalledWith('Session created successfully');
    });

    it('rejects_an_invalid_tag_list_before_session_creation', async () => {
      const createdSessionId = await useSessionsStore
        .getState()
        .createSession(
          {
            title: baseSession.title,
            problemDescription: baseSession.problemDescription,
            outputGoal: baseSession.outputGoal,
          },
          ['persona-1'],
          undefined,
          ['a'.repeat(21)]
        );

      expect(createdSessionId).toBeNull();
      expect(mockElectronDB.createSession).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
    });
  });

  describe('loading_a_session', () => {
    it('hydrates_current_session_with_tags_from_session_tag_transport_payload', async () => {
      const sessionWithoutInlineTags = {
        ...baseSession,
      } as Omit<Session, 'tags'>;
      delete (sessionWithoutInlineTags as { tags?: string[] }).tags;

      mockElectronDB.getSession.mockResolvedValue({ success: true, data: sessionWithoutInlineTags });
      mockElectronDB.getMessages.mockResolvedValue({ success: true, data: [] });
      mockElectronDB.getSessionPersonas.mockResolvedValue({ success: true, data: [] });
      mockElectronDB.sessionTags.getBySession.mockResolvedValue({ success: true, data: ['feature', 'bug'] });

      await useSessionsStore.getState().loadSession(baseSession.id);

      expect(useSessionsStore.getState().currentSession?.tags).toEqual(['feature', 'bug']);
    });
  });

  describe('managing_session_tags', () => {
    it('adds_a_new_tag_and_updates_all_relevant_store_views', async () => {
      const existingSession: Session = { ...baseSession, tags: ['bug'] };
      const createdTag: Tag = { id: 42, name: 'urgent', createdAt: '2026-02-08T00:00:00Z' };

      useSessionsStore.setState({
        sessions: [existingSession],
        currentSession: existingSession,
        allTags: [{ id: 1, name: 'bug', createdAt: '2026-02-08T00:00:00Z' }],
      });

      mockElectronDB.tags.getByName.mockResolvedValue({ success: true, data: null });
      mockElectronDB.tags.create.mockResolvedValue({ success: true, data: createdTag });
      mockElectronDB.sessionTags.add.mockResolvedValue({ success: true });

      const added = await useSessionsStore.getState().addTagToSession(existingSession.id, 'urgent');

      expect(added).toBe(true);
      expect(useSessionsStore.getState().sessions[0]?.tags).toEqual(['bug', 'urgent']);
      expect(useSessionsStore.getState().currentSession?.tags).toEqual(['bug', 'urgent']);
      expect(useSessionsStore.getState().allTags).toContainEqual(createdTag);
    });

    it('removes_a_tag_without_mutating_the_local_tag_catalog_when_no_refresh_is_returned', async () => {
      const existingSession: Session = { ...baseSession, tags: ['bug', 'urgent'] };
      const startingTagCatalog: Tag[] = [
        { id: 1, name: 'bug', createdAt: '2026-02-08T00:00:00Z' },
        { id: 42, name: 'urgent', createdAt: '2026-02-08T00:00:00Z' },
      ];

      useSessionsStore.setState({
        sessions: [existingSession],
        currentSession: existingSession,
        allTags: startingTagCatalog,
      });

      mockElectronDB.sessionTags.remove.mockResolvedValue({ success: true });

      const removed = await useSessionsStore.getState().removeTagFromSession(existingSession.id, 'urgent');

      expect(removed).toBe(true);
      expect(useSessionsStore.getState().sessions[0]?.tags).toEqual(['bug']);
      expect(useSessionsStore.getState().currentSession?.tags).toEqual(['bug']);
      expect(useSessionsStore.getState().allTags).toEqual(startingTagCatalog);
    });
  });

  describe('deleting_a_session', () => {
    it('keeps_the_session_delete_successful_when_orphan_cleanup_fails', async () => {
      useSessionsStore.setState({
        sessions: [baseSession],
        currentSession: baseSession,
      });

      mockElectronDB.deleteSession.mockResolvedValue({ success: true });
      mockElectronDB.tags.cleanupOrphaned.mockRejectedValue(new Error('cleanup failed'));

      const deleted = await useSessionsStore.getState().deleteSession(baseSession.id);

      expect(deleted).toBe(true);
      expect(useSessionsStore.getState().sessions).toEqual([]);
      expect(useSessionsStore.getState().currentSession).toBeNull();
      expect(toast.success).toHaveBeenCalledWith('Session deleted successfully');
    });
  });
});
