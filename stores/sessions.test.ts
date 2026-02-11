import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import { useSessionsStore } from './sessions';
import type { Session, Tag } from '../lib/types';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock electronDB APIs
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

describe('session_store_tag_spec', () => {
  beforeEach(() => {
    // Reset store state before each test
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

    // Reset all mocks
    vi.clearAllMocks();

    // Setup global window.electronDB mock
    Object.assign(window, {
      electronDB: mockElectronDB,
      electronConductor: mockElectronConductor,
      electronExport: mockElectronExport,
    });
  });

  describe('fetch_all_tags_operation', () => {
    it('loads_all_tags_into_store_state_when_ipc_succeeds', async () => {
      const mockTags: Tag[] = [
        { id: 1, name: 'feature', createdAt: '2024-01-01' },
        { id: 2, name: 'bug-fix', createdAt: '2024-01-02' },
      ];
      mockElectronDB.tags.getAll.mockResolvedValue({ success: true, data: mockTags });

      await useSessionsStore.getState().fetchAllTags();

      const state = useSessionsStore.getState();
      expect(state.allTags).toHaveLength(2);
      expect(state.allTags[0].name).toBe('feature');
      expect(state.allTags[1].name).toBe('bug-fix');
    });

    it('preserves_empty_state_when_ipc_fails', async () => {
      mockElectronDB.tags.getAll.mockResolvedValue({ success: false, error: 'Database error' });

      await useSessionsStore.getState().fetchAllTags();

      const state = useSessionsStore.getState();
      expect(state.allTags).toHaveLength(0);
    });

    it('preserves_existing_state_when_ipc_returns_no_data', async () => {
      mockElectronDB.tags.getAll.mockResolvedValue({ success: true, data: null });

      await useSessionsStore.getState().fetchAllTags();

      const state = useSessionsStore.getState();
      expect(state.allTags).toHaveLength(0);
    });
  });

  describe('add_tag_to_session_operation', () => {
    describe('given_session_with_fewer_than_three_tags', () => {
      beforeEach(() => {
        const session: Session = {
          id: 'session-1',
          title: 'Test Session',
          problemDescription: 'Test problem',
          outputGoal: 'Test goal',
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
          tags: ['existing-tag'],
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        };
        useSessionsStore.setState({
          sessions: [session],
          allTags: [{ id: 1, name: 'existing-tag', createdAt: '2024-01-01' }],
        });
      });

      it('creates_new_tag_and_adds_to_session_when_tag_does_not_exist', async () => {
        const newTag: Tag = { id: 2, name: 'new-tag', createdAt: '2024-01-02' };
        mockElectronDB.tags.getByName.mockResolvedValue({ success: true, data: null });
        mockElectronDB.tags.create.mockResolvedValue({ success: true, data: newTag });
        mockElectronDB.sessionTags.add.mockResolvedValue({ success: true });

        const result = await useSessionsStore.getState().addTagToSession('session-1', 'new-tag');

        expect(result).toBe(true);
        expect(mockElectronDB.tags.create).toHaveBeenCalledWith('new-tag');
        expect(mockElectronDB.sessionTags.add).toHaveBeenCalledWith('session-1', 2);

        const state = useSessionsStore.getState();
        const session = state.sessions.find(s => s.id === 'session-1');
        expect(session?.tags).toContain('new-tag');
        expect(state.allTags).toContainEqual(newTag);
      });

      it('reuses_existing_tag_and_adds_to_session_when_tag_already_exists', async () => {
        const existingTag: Tag = { id: 2, name: 'reused-tag', createdAt: '2024-01-01' };
        mockElectronDB.tags.getByName.mockResolvedValue({ success: true, data: existingTag });
        mockElectronDB.sessionTags.add.mockResolvedValue({ success: true });

        const result = await useSessionsStore.getState().addTagToSession('session-1', 'reused-tag');

        expect(result).toBe(true);
        expect(mockElectronDB.tags.create).not.toHaveBeenCalled();
        expect(mockElectronDB.sessionTags.add).toHaveBeenCalledWith('session-1', 2);

        const state = useSessionsStore.getState();
        const session = state.sessions.find(s => s.id === 'session-1');
        expect(session?.tags).toContain('reused-tag');
      });

      it('uses_cached_tag_from_store_without_database_lookup', async () => {
        const cachedTag: Tag = { id: 2, name: 'cached-tag', createdAt: '2024-01-01' };
        useSessionsStore.setState({ allTags: [cachedTag] });
        mockElectronDB.sessionTags.add.mockResolvedValue({ success: true });

        const result = await useSessionsStore.getState().addTagToSession('session-1', 'cached-tag');

        expect(result).toBe(true);
        expect(mockElectronDB.tags.getByName).not.toHaveBeenCalled();
        expect(mockElectronDB.sessionTags.add).toHaveBeenCalledWith('session-1', 2);
      });

      it('rejects_invalid_tag_input', async () => {
        const result = await useSessionsStore.getState().addTagToSession('session-1', '');

        expect(result).toBe(false);
        expect(mockElectronDB.tags.create).not.toHaveBeenCalled();
        expect(mockElectronDB.sessionTags.add).not.toHaveBeenCalled();
      });

      it('rejects_duplicate_tag_case_insensitive', async () => {
        const result = await useSessionsStore.getState().addTagToSession('session-1', 'EXISTING-TAG');

        expect(result).toBe(false);
        expect(mockElectronDB.tags.create).not.toHaveBeenCalled();
        expect(mockElectronDB.sessionTags.add).not.toHaveBeenCalled();
      });

      it('normalizes_tag_to_lowercase_before_storage', async () => {
        const newTag: Tag = { id: 2, name: 'mixed-case', createdAt: '2024-01-02' };
        mockElectronDB.tags.getByName.mockResolvedValue({ success: true, data: null });
        mockElectronDB.tags.create.mockResolvedValue({ success: true, data: newTag });
        mockElectronDB.sessionTags.add.mockResolvedValue({ success: true });

        const result = await useSessionsStore.getState().addTagToSession('session-1', 'Mixed-Case');

        expect(result).toBe(true);
        expect(mockElectronDB.tags.create).toHaveBeenCalledWith('mixed-case');

        const state = useSessionsStore.getState();
        const session = state.sessions.find(s => s.id === 'session-1');
        expect(session?.tags).toContain('mixed-case');
        expect(session?.tags).not.toContain('Mixed-Case');
      });

      it('rejects_tag_exceeding_twenty_character_limit', async () => {
        const longTag = 'a'.repeat(21);
        const result = await useSessionsStore.getState().addTagToSession('session-1', longTag);

        expect(result).toBe(false);
        expect(mockElectronDB.tags.create).not.toHaveBeenCalled();
      });

      it('handles_ipc_failure_during_tag_creation', async () => {
        mockElectronDB.tags.getByName.mockResolvedValue({ success: true, data: null });
        mockElectronDB.tags.create.mockResolvedValue({ success: false, error: 'Database error' });

        const result = await useSessionsStore.getState().addTagToSession('session-1', 'new-tag');

        expect(result).toBe(false);
        expect(mockElectronDB.sessionTags.add).not.toHaveBeenCalled();
      });

      it('handles_ipc_failure_during_session_tag_linking', async () => {
        const newTag: Tag = { id: 2, name: 'new-tag', createdAt: '2024-01-02' };
        mockElectronDB.tags.getByName.mockResolvedValue({ success: true, data: null });
        mockElectronDB.tags.create.mockResolvedValue({ success: true, data: newTag });
        mockElectronDB.sessionTags.add.mockResolvedValue({ success: false, error: 'Link failed' });

        const result = await useSessionsStore.getState().addTagToSession('session-1', 'new-tag');

        expect(result).toBe(false);
        const state = useSessionsStore.getState();
        const session = state.sessions.find(s => s.id === 'session-1');
        expect(session?.tags).not.toContain('new-tag');
      });
    });

    describe('given_session_with_three_tags', () => {
      beforeEach(() => {
        const session: Session = {
          id: 'session-1',
          title: 'Test Session',
          problemDescription: 'Test problem',
          outputGoal: 'Test goal',
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
          tags: ['tag-a', 'tag-b', 'tag-c'],
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        };
        useSessionsStore.setState({ sessions: [session] });
      });

      it('rejects_adding_fourth_tag', async () => {
        const result = await useSessionsStore.getState().addTagToSession('session-1', 'tag-d');

        expect(result).toBe(false);
        expect(mockElectronDB.tags.create).not.toHaveBeenCalled();
        expect(mockElectronDB.sessionTags.add).not.toHaveBeenCalled();
      });

      it('preserves_existing_three_tags_when_rejection_occurs', async () => {
        await useSessionsStore.getState().addTagToSession('session-1', 'tag-d');

        const state = useSessionsStore.getState();
        const session = state.sessions.find(s => s.id === 'session-1');
        expect(session?.tags).toHaveLength(3);
        expect(session?.tags).toEqual(['tag-a', 'tag-b', 'tag-c']);
      });
    });

    describe('given_session_not_found', () => {
      it('returns_false_when_session_does_not_exist', async () => {
        const result = await useSessionsStore.getState().addTagToSession('nonexistent-session', 'tag');

        expect(result).toBe(false);
        expect(mockElectronDB.tags.create).not.toHaveBeenCalled();
      });

      it('does_not_fallback_to_unrelated_current_session', async () => {
        const unrelatedCurrentSession: Session = {
          id: 'session-current',
          title: 'Current Session',
          problemDescription: 'Current problem',
          outputGoal: 'Current goal',
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
          tags: ['existing-tag'],
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        };

        useSessionsStore.setState({
          sessions: [],
          currentSession: unrelatedCurrentSession,
          allTags: [{ id: 1, name: 'existing-tag', createdAt: '2024-01-01' }],
        });

        const result = await useSessionsStore.getState().addTagToSession('session-missing', 'new-tag');

        expect(result).toBe(false);
        expect(mockElectronDB.tags.create).not.toHaveBeenCalled();
        expect(mockElectronDB.sessionTags.add).not.toHaveBeenCalled();
      });
    });

    describe('given_current_session_loaded', () => {
      beforeEach(() => {
        const session: Session = {
          id: 'session-1',
          title: 'Current Session',
          problemDescription: 'Test problem',
          outputGoal: 'Test goal',
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
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        };
        useSessionsStore.setState({ currentSession: session });
      });

      it('updates_current_session_tags_when_adding_tag', async () => {
        const newTag: Tag = { id: 1, name: 'new-tag', createdAt: '2024-01-02' };
        mockElectronDB.tags.getByName.mockResolvedValue({ success: true, data: null });
        mockElectronDB.tags.create.mockResolvedValue({ success: true, data: newTag });
        mockElectronDB.sessionTags.add.mockResolvedValue({ success: true });

        await useSessionsStore.getState().addTagToSession('session-1', 'new-tag');

        const state = useSessionsStore.getState();
        expect(state.currentSession?.tags).toContain('new-tag');
      });
    });
  });

  describe('remove_tag_from_session_operation', () => {
    describe('given_session_with_tags', () => {
      beforeEach(() => {
        const session: Session = {
          id: 'session-1',
          title: 'Test Session',
          problemDescription: 'Test problem',
          outputGoal: 'Test goal',
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
          tags: ['tag-a', 'tag-b', 'tag-c'],
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        };
        useSessionsStore.setState({
          sessions: [session],
          allTags: [
            { id: 1, name: 'tag-a', createdAt: '2024-01-01' },
            { id: 2, name: 'tag-b', createdAt: '2024-01-01' },
            { id: 3, name: 'tag-c', createdAt: '2024-01-01' },
          ],
        });
      });

      it('removes_tag_from_session_when_ipc_succeeds', async () => {
        mockElectronDB.sessionTags.remove.mockResolvedValue({ success: true });

        const result = await useSessionsStore.getState().removeTagFromSession('session-1', 'tag-b');

        expect(result).toBe(true);
        expect(mockElectronDB.sessionTags.remove).toHaveBeenCalledWith('session-1', 2);

        const state = useSessionsStore.getState();
        const session = state.sessions.find(s => s.id === 'session-1');
        expect(session?.tags).not.toContain('tag-b');
        expect(session?.tags).toContain('tag-a');
        expect(session?.tags).toContain('tag-c');
      });

      it('handles_case_insensitive_tag_name_matching', async () => {
        mockElectronDB.sessionTags.remove.mockResolvedValue({ success: true });

        const result = await useSessionsStore.getState().removeTagFromSession('session-1', 'TAG-B');

        expect(result).toBe(true);
        expect(mockElectronDB.sessionTags.remove).toHaveBeenCalledWith('session-1', 2);
      });

      it('handles_whitespace_in_tag_name', async () => {
        mockElectronDB.sessionTags.remove.mockResolvedValue({ success: true });

        const result = await useSessionsStore.getState().removeTagFromSession('session-1', '  tag-b  ');

        expect(result).toBe(true);
      });

      it('returns_false_when_tag_not_found_in_allTags_cache', async () => {
        useSessionsStore.setState({ allTags: [] });

        const result = await useSessionsStore.getState().removeTagFromSession('session-1', 'tag-b');

        expect(result).toBe(false);
        expect(mockElectronDB.sessionTags.remove).not.toHaveBeenCalled();
      });

      it('handles_ipc_failure_gracefully', async () => {
        mockElectronDB.sessionTags.remove.mockResolvedValue({ success: false, error: 'Database error' });

        const result = await useSessionsStore.getState().removeTagFromSession('session-1', 'tag-b');

        expect(result).toBe(false);
        const state = useSessionsStore.getState();
        const session = state.sessions.find(s => s.id === 'session-1');
        // Original tags should be preserved
        expect(session?.tags).toContain('tag-b');
      });

      it('updates_current_session_when_removing_from_loaded_session', async () => {
        const session = useSessionsStore.getState().sessions[0];
        useSessionsStore.setState({ currentSession: session });
        mockElectronDB.sessionTags.remove.mockResolvedValue({ success: true });

        await useSessionsStore.getState().removeTagFromSession('session-1', 'tag-a');

        const state = useSessionsStore.getState();
        expect(state.currentSession?.tags).not.toContain('tag-a');
      });

      it('calls_cleanupOrphaned_and_refreshes_allTags_after_removing_tag', async () => {
        mockElectronDB.sessionTags.remove.mockResolvedValue({ success: true });
        mockElectronDB.tags.cleanupOrphaned.mockResolvedValue({ success: true });
        
        const refreshedTags = [{ id: 2, name: 'tag-b', createdAt: '2024-01-01' }];
        mockElectronDB.tags.getAll.mockResolvedValue({ success: true, data: refreshedTags });

        await useSessionsStore.getState().removeTagFromSession('session-1', 'tag-a');

        expect(mockElectronDB.tags.cleanupOrphaned).toHaveBeenCalled();
        expect(mockElectronDB.tags.getAll).toHaveBeenCalled();
        
        const state = useSessionsStore.getState();
        expect(state.allTags).toEqual(refreshedTags);
      });

      it('continues_without_error_when_cleanup_fails', async () => {
        mockElectronDB.sessionTags.remove.mockResolvedValue({ success: true });
        mockElectronDB.tags.cleanupOrphaned.mockRejectedValue(new Error('Cleanup failed'));

        const result = await useSessionsStore.getState().removeTagFromSession('session-1', 'tag-a');

        expect(result).toBe(true);
        expect(mockElectronDB.tags.cleanupOrphaned).toHaveBeenCalled();
      });
    });

    describe('given_session_not_found', () => {
      it('returns_false_when_session_does_not_exist', async () => {
        const result = await useSessionsStore.getState().removeTagFromSession('nonexistent-session', 'tag');

        expect(result).toBe(false);
        expect(mockElectronDB.sessionTags.remove).not.toHaveBeenCalled();
      });

      it('does_not_fallback_to_unrelated_current_session', async () => {
        const unrelatedCurrentSession: Session = {
          id: 'session-current',
          title: 'Current Session',
          problemDescription: 'Current problem',
          outputGoal: 'Current goal',
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
          tags: ['tag-a'],
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        };

        useSessionsStore.setState({
          sessions: [],
          currentSession: unrelatedCurrentSession,
          allTags: [{ id: 1, name: 'tag-a', createdAt: '2024-01-01' }],
        });

        const result = await useSessionsStore.getState().removeTagFromSession('session-missing', 'tag-a');

        expect(result).toBe(false);
        expect(mockElectronDB.sessionTags.remove).not.toHaveBeenCalled();
      });
    });
  });

  describe('create_session_with_tags_operation', () => {
    const mockSessionInput = {
      title: 'New Session',
      problemDescription: 'Test problem',
      outputGoal: 'Test goal',
    };

    beforeEach(() => {
      mockElectronDB.createSession.mockResolvedValue({
        success: true,
        data: {
          id: 'new-session',
          title: 'New Session',
          problemDescription: 'Test problem',
          outputGoal: 'Test goal',
          status: 'active',
          tokenCount: 0,
          costEstimate: 0,
          conductorEnabled: false,
          conductorPersonaId: null,
          blackboard: null,
          autoReplyCount: 0,
          tokenBudget: 100000,
          summary: null,
          archivedAt: null,
          tags: [],
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      });
      mockElectronDB.addPersonaToSession.mockResolvedValue({ success: true });
    });

    it('creates_session_with_valid_tags', async () => {
      const tagA: Tag = { id: 1, name: 'feature', createdAt: '2024-01-01' };
      const tagB: Tag = { id: 2, name: 'bug-fix', createdAt: '2024-01-01' };

      mockElectronDB.tags.getByName.mockImplementation((name: string) => {
        if (name === 'feature') return Promise.resolve({ success: true, data: tagA });
        if (name === 'bug-fix') return Promise.resolve({ success: true, data: tagB });
        return Promise.resolve({ success: true, data: null });
      });
      mockElectronDB.sessionTags.add.mockResolvedValue({ success: true });

      const result = await useSessionsStore.getState().createSession(
        mockSessionInput,
        ['persona-1'],
        undefined,
        ['feature', 'bug-fix']
      );

      expect(result).toBe('new-session');
      expect(mockElectronDB.sessionTags.add).toHaveBeenCalledTimes(2);
    });

    it('rejects_session_creation_when_tags_exceed_three', async () => {
      const result = await useSessionsStore.getState().createSession(
        mockSessionInput,
        ['persona-1'],
        undefined,
        ['tag-1', 'tag-2', 'tag-3', 'tag-4']
      );

      expect(result).toBeNull();
      expect(mockElectronDB.createSession).not.toHaveBeenCalled();
    });

    it('validates_each_tag_before_creating_session', async () => {
      const result = await useSessionsStore.getState().createSession(
        mockSessionInput,
        ['persona-1'],
        undefined,
        ['valid-tag', '']  // Empty tag is invalid
      );

      expect(result).toBeNull();
      expect(mockElectronDB.createSession).not.toHaveBeenCalled();
    });

    it('creates_new_tags_that_do_not_exist', async () => {
      const newTag: Tag = { id: 1, name: 'brand-new-tag', createdAt: '2024-01-01' };
      mockElectronDB.tags.getByName.mockResolvedValue({ success: true, data: null });
      mockElectronDB.tags.create.mockResolvedValue({ success: true, data: newTag });
      mockElectronDB.sessionTags.add.mockResolvedValue({ success: true });

      await useSessionsStore.getState().createSession(
        mockSessionInput,
        ['persona-1'],
        undefined,
        ['brand-new-tag']
      );

      expect(mockElectronDB.tags.create).toHaveBeenCalledWith('brand-new-tag');
      expect(mockElectronDB.sessionTags.add).toHaveBeenCalledWith('new-session', 1);
    });

    it('reuses_existing_tags_when_available', async () => {
      const existingTag: Tag = { id: 5, name: 'existing-tag', createdAt: '2024-01-01' };
      useSessionsStore.setState({ allTags: [existingTag] });
      mockElectronDB.sessionTags.add.mockResolvedValue({ success: true });

      await useSessionsStore.getState().createSession(
        mockSessionInput,
        ['persona-1'],
        undefined,
        ['existing-tag']
      );

      expect(mockElectronDB.tags.getByName).not.toHaveBeenCalled();
      expect(mockElectronDB.tags.create).not.toHaveBeenCalled();
      expect(mockElectronDB.sessionTags.add).toHaveBeenCalledWith('new-session', 5);
    });

    it('normalizes_tag_names_to_lowercase', async () => {
      const newTag: Tag = { id: 1, name: 'lowercase-tag', createdAt: '2024-01-01' };
      mockElectronDB.tags.getByName.mockResolvedValue({ success: true, data: null });
      mockElectronDB.tags.create.mockResolvedValue({ success: true, data: newTag });
      mockElectronDB.sessionTags.add.mockResolvedValue({ success: true });

      await useSessionsStore.getState().createSession(
        mockSessionInput,
        ['persona-1'],
        undefined,
        ['UPPERCASE-TAG']
      );

      expect(mockElectronDB.tags.create).toHaveBeenCalledWith('uppercase-tag');
    });

    it('handles_duplicate_tags_in_input_array', async () => {
      const tag: Tag = { id: 1, name: 'duplicate', createdAt: '2024-01-01' };
      mockElectronDB.tags.getByName.mockResolvedValue({ success: true, data: tag });
      mockElectronDB.sessionTags.add.mockResolvedValue({ success: true });

      // Second 'Duplicate' should be rejected as duplicate of first
      const result = await useSessionsStore.getState().createSession(
        mockSessionInput,
        ['persona-1'],
        undefined,
        ['duplicate', 'Duplicate']
      );

      expect(result).toBeNull();
    });

    it('creates_session_without_tags_when_tag_array_is_empty', async () => {
      const result = await useSessionsStore.getState().createSession(
        mockSessionInput,
        ['persona-1'],
        undefined,
        []
      );

      expect(result).toBe('new-session');
      expect(mockElectronDB.tags.create).not.toHaveBeenCalled();
      expect(mockElectronDB.sessionTags.add).not.toHaveBeenCalled();
    });

    it('creates_session_without_tags_when_tag_parameter_is_undefined', async () => {
      const result = await useSessionsStore.getState().createSession(
        mockSessionInput,
        ['persona-1'],
        undefined,
        undefined
      );

      expect(result).toBe('new-session');
      expect(mockElectronDB.tags.create).not.toHaveBeenCalled();
    });

    it('updates_all_tags_cache_with_newly_created_tags', async () => {
      const newTag: Tag = { id: 1, name: 'fresh-tag', createdAt: '2024-01-01' };
      mockElectronDB.tags.getByName.mockResolvedValue({ success: true, data: null });
      mockElectronDB.tags.create.mockResolvedValue({ success: true, data: newTag });
      mockElectronDB.sessionTags.add.mockResolvedValue({ success: true });

      await useSessionsStore.getState().createSession(
        mockSessionInput,
        ['persona-1'],
        undefined,
        ['fresh-tag']
      );

      const state = useSessionsStore.getState();
      expect(state.allTags).toContainEqual(newTag);
    });

    it('returns_created_session_id_even_when_one_tag_assignment_fails', async () => {
      const tagA: Tag = { id: 1, name: 'tag-a', createdAt: '2024-01-01' };
      const tagB: Tag = { id: 2, name: 'tag-b', createdAt: '2024-01-01' };

      mockElectronDB.tags.getByName.mockImplementation((name: string) => {
        if (name === 'tag-a') return Promise.resolve({ success: true, data: tagA });
        if (name === 'tag-b') return Promise.resolve({ success: true, data: tagB });
        return Promise.resolve({ success: true, data: null });
      });
      mockElectronDB.sessionTags.add
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: 'link failed' });

      const result = await useSessionsStore.getState().createSession(
        mockSessionInput,
        ['persona-1'],
        undefined,
        ['tag-a', 'tag-b']
      );

      expect(result).toBe('new-session');
      const created = useSessionsStore.getState().sessions.find((session) => session.id === 'new-session');
      expect(created?.tags).toEqual(['tag-a']);
    });
  });

  describe('tag_persistence_across_operations', () => {
    it('maintains_tag_order_when_adding_multiple_tags', async () => {
      const session: Session = {
        id: 'session-1',
        title: 'Test',
        problemDescription: 'Test',
        outputGoal: 'Test',
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
        tags: ['first'],
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };
      useSessionsStore.setState({ sessions: [session] });

      const secondTag: Tag = { id: 2, name: 'second', createdAt: '2024-01-01' };
      mockElectronDB.tags.getByName.mockResolvedValue({ success: true, data: null });
      mockElectronDB.tags.create.mockResolvedValue({ success: true, data: secondTag });
      mockElectronDB.sessionTags.add.mockResolvedValue({ success: true });

      await useSessionsStore.getState().addTagToSession('session-1', 'second');

      const state = useSessionsStore.getState();
      const updatedSession = state.sessions[0];
      expect(updatedSession.tags).toEqual(['first', 'second']);
    });

    it('preserves_other_session_tags_when_removing_from_one', async () => {
      const sessions: Session[] = [
        {
          id: 'session-1',
          title: 'Session 1',
          problemDescription: 'Test',
          outputGoal: 'Test',
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
          tags: ['shared-tag'],
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
        {
          id: 'session-2',
          title: 'Session 2',
          problemDescription: 'Test',
          outputGoal: 'Test',
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
          tags: ['shared-tag', 'unique-tag'],
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ];
      useSessionsStore.setState({
        sessions,
        allTags: [
          { id: 1, name: 'shared-tag', createdAt: '2024-01-01' },
          { id: 2, name: 'unique-tag', createdAt: '2024-01-01' },
        ],
      });

      mockElectronDB.sessionTags.remove.mockResolvedValue({ success: true });

      await useSessionsStore.getState().removeTagFromSession('session-1', 'shared-tag');

      const state = useSessionsStore.getState();
      expect(state.sessions[0].tags).toEqual([]);
      expect(state.sessions[1].tags).toEqual(['shared-tag', 'unique-tag']);
    });
  });

  describe('phase_6_store_shell_migration_spec', () => {
    it('uses_backend_turn_number_when_sending_user_message', async () => {
      useSessionsStore.setState({
        currentSession: {
          id: 'session-1',
          title: 'Session',
          problemDescription: 'Problem',
          outputGoal: 'Goal',
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
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      });

      mockElectronDB.getNextTurnNumber.mockResolvedValue({ success: true, data: 7 });
      mockElectronDB.createMessage.mockResolvedValue({
        success: true,
        data: {
          id: 'message-1',
          sessionId: 'session-1',
          personaId: null,
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
        content: 'hello',
        turnNumber: 7,
        tokenCount: 0,
      });
    });

    it('refreshes_session_personas_after_hush_command', async () => {
      useSessionsStore.setState({
        currentSession: {
          id: 'session-1',
          title: 'Session',
          problemDescription: 'Problem',
          outputGoal: 'Goal',
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
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      });

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

    it('refreshes_session_state_after_archive_command', async () => {
      const activeSession: Session = {
        id: 'session-1',
        title: 'Session',
        problemDescription: 'Problem',
        outputGoal: 'Goal',
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
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      const archivedSession: Session = {
        ...activeSession,
        status: 'archived',
        archivedAt: '2024-01-05T00:00:00.000Z',
      };

      useSessionsStore.setState({
        sessions: [activeSession],
        currentSession: activeSession,
      });

      mockElectronDB.archiveSession.mockResolvedValue({ success: true });
      mockElectronDB.getSession.mockResolvedValue({ success: true, data: archivedSession });

      const result = await useSessionsStore.getState().archiveSession('session-1');

      expect(result).toBe(true);
      expect(useSessionsStore.getState().sessions[0]).toEqual(archivedSession);
      expect(useSessionsStore.getState().currentSession).toEqual(archivedSession);
    });

    it('uses_backend_turn_number_when_triggering_persona_response', async () => {
      const currentSession: Session = {
        id: 'session-1',
        title: 'Session',
        problemDescription: 'Problem',
        outputGoal: 'Goal',
        status: 'active',
        tokenCount: 10,
        costEstimate: 0,
        conductorEnabled: false,
        conductorPersonaId: null,
        blackboard: null,
        autoReplyCount: 0,
        tokenBudget: 1000,
        summary: null,
        archivedAt: null,
        tags: [],
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

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
          content: 'Response',
          turnNumber: 12,
          tokenCount: 20,
          metadata: null,
          createdAt: '2024-01-01',
        },
      });
      mockElectronDB.updateSession.mockResolvedValue({ success: true, data: { ...currentSession, tokenCount: 30 } });
      Object.assign(window, {
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

      await useSessionsStore.getState().triggerPersonaResponse('persona-1');

      expect(mockElectronDB.getNextTurnNumber).toHaveBeenCalledWith('session-1');
      expect(mockElectronDB.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({ turnNumber: 12, personaId: 'persona-1' })
      );
    });

    it('warns_when_hush_refresh_fails_after_successful_command', async () => {
      useSessionsStore.setState({
        currentSession: {
          id: 'session-1',
          title: 'Session',
          problemDescription: 'Problem',
          outputGoal: 'Goal',
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
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      });

      mockElectronDB.hushPersona.mockResolvedValue({ success: true });
      mockElectronDB.getSessionPersonas.mockResolvedValue({ success: false, error: 'refresh failed' });

      const result = await useSessionsStore.getState().hushPersona('persona-1', 2);

      expect(result).toBe(true);
      expect(toast.warning).toHaveBeenCalledWith('Persona hushed, but failed to refresh participant state');
    });

    it('warns_when_archive_refresh_fails_after_successful_command', async () => {
      const activeSession: Session = {
        id: 'session-1',
        title: 'Session',
        problemDescription: 'Problem',
        outputGoal: 'Goal',
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
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      useSessionsStore.setState({ sessions: [activeSession], currentSession: activeSession });
      mockElectronDB.archiveSession.mockResolvedValue({ success: true });
      mockElectronDB.getSession.mockResolvedValue({ success: false, error: 'refresh failed' });

      const result = await useSessionsStore.getState().archiveSession('session-1');

      expect(result).toBe(true);
      expect(toast.warning).toHaveBeenCalledWith('Session archived, but failed to refresh session state');
    });

    it('warns_when_unarchive_refresh_fails_after_successful_command', async () => {
      const archivedSession: Session = {
        id: 'session-1',
        title: 'Session',
        problemDescription: 'Problem',
        outputGoal: 'Goal',
        status: 'archived',
        tokenCount: 0,
        costEstimate: 0,
        conductorEnabled: false,
        conductorPersonaId: null,
        blackboard: null,
        autoReplyCount: 0,
        tokenBudget: 1000,
        summary: null,
        archivedAt: '2024-01-02',
        tags: [],
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      useSessionsStore.setState({ sessions: [archivedSession], currentSession: archivedSession });
      mockElectronDB.unarchiveSession.mockResolvedValue({ success: true });
      mockElectronDB.getSession.mockResolvedValue({ success: false, error: 'refresh failed' });

      const result = await useSessionsStore.getState().unarchiveSession('session-1');

      expect(result).toBe(true);
      expect(toast.warning).toHaveBeenCalledWith('Session unarchived, but failed to refresh session state');
    });
  });

  describe('phase_6_transport_boundary_parsing_spec', () => {
    const validSession: Session = {
      id: 'session-1',
      title: 'Session',
      problemDescription: 'Problem',
      outputGoal: 'Goal',
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
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    it('preserves_existing_sessions_when_fetch_sessions_payload_is_invalid', async () => {
      useSessionsStore.setState({ sessions: [validSession] });
      mockElectronDB.getSessions.mockResolvedValue({ success: true, data: [{ id: 1 }] });

      await useSessionsStore.getState().fetchSessions();

      expect(useSessionsStore.getState().sessions).toEqual([validSession]);
      expect(toast.error).toHaveBeenCalledWith('Failed to fetch sessions');
    });

    it('rejects_invalid_session_payload_when_loading_session', async () => {
      mockElectronDB.getSession.mockResolvedValue({ success: true, data: { id: 'session-1' } });
      mockElectronDB.getMessages.mockResolvedValue({ success: true, data: [] });
      mockElectronDB.getSessionPersonas.mockResolvedValue({ success: true, data: [] });
      mockElectronDB.sessionTags.getBySession.mockResolvedValue({ success: true, data: [] });

      await useSessionsStore.getState().loadSession('session-1');

      expect(useSessionsStore.getState().currentSession).toBeNull();
      expect(toast.error).toHaveBeenCalledWith('Invalid session payload');
    });

    it('rejects_invalid_messages_payload_when_loading_session', async () => {
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

    it('warns_when_hush_refresh_payload_is_invalid_after_successful_command', async () => {
      useSessionsStore.setState({ currentSession: validSession });
      mockElectronDB.hushPersona.mockResolvedValue({ success: true });
      mockElectronDB.getSessionPersonas.mockResolvedValue({
        success: true,
        data: [{ id: 'persona-1' }],
      });

      const result = await useSessionsStore.getState().hushPersona('persona-1', 2);

      expect(result).toBe(true);
      expect(toast.warning).toHaveBeenCalledWith('Persona hushed, but failed to refresh participant state');
    });

    it('warns_when_archive_refresh_payload_is_invalid_after_successful_command', async () => {
      useSessionsStore.setState({ sessions: [validSession], currentSession: validSession });
      mockElectronDB.archiveSession.mockResolvedValue({ success: true });
      mockElectronDB.getSession.mockResolvedValue({ success: true, data: { id: 'session-1' } });

      const result = await useSessionsStore.getState().archiveSession('session-1');

      expect(result).toBe(true);
      expect(toast.warning).toHaveBeenCalledWith('Session archived, but failed to refresh session state');
    });

    it('warns_when_unarchive_refresh_payload_is_invalid_after_successful_command', async () => {
      const archivedSession: Session = { ...validSession, status: 'archived', archivedAt: '2024-01-02' };
      useSessionsStore.setState({ sessions: [archivedSession], currentSession: archivedSession });
      mockElectronDB.unarchiveSession.mockResolvedValue({ success: true });
      mockElectronDB.getSession.mockResolvedValue({ success: true, data: { id: 'session-1' } });

      const result = await useSessionsStore.getState().unarchiveSession('session-1');

      expect(result).toBe(true);
      expect(toast.warning).toHaveBeenCalledWith('Session unarchived, but failed to refresh session state');
    });
  });

  describe('phase_7_shell_coverage_spec', () => {
    const makeSession = (overrides: Partial<Session> = {}): Session => ({
      id: 'session-1',
      title: 'Session',
      problemDescription: 'Problem',
      outputGoal: 'Goal',
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
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      ...overrides,
    });

    it('enables_conductor_and_persists_session_state', async () => {
      const session = makeSession();
      useSessionsStore.setState({ currentSession: session, sessions: [session] });

      mockElectronConductor.enable.mockResolvedValue({ success: true });
      mockElectronDB.updateSession.mockResolvedValue({
        success: true,
        data: makeSession({ conductorEnabled: true, conductorPersonaId: 'persona-1' }),
      });

      await useSessionsStore.getState().enableConductor('persona-1');

      expect(mockElectronConductor.enable).toHaveBeenCalledWith('session-1', 'persona-1');
      expect(mockElectronDB.updateSession).toHaveBeenCalledWith('session-1', {
        conductorEnabled: true,
        conductorPersonaId: 'persona-1',
      });
      expect(toast.success).toHaveBeenCalledWith('Conductor enabled');
    });

    it('disables_conductor_and_clears_runtime_flags', async () => {
      const session = makeSession({ conductorEnabled: true, conductorPersonaId: 'persona-1' });
      useSessionsStore.setState({
        currentSession: session,
        sessions: [session],
        conductorRunning: true,
        conductorPaused: true,
      });

      mockElectronConductor.disable.mockResolvedValue({ success: true });
      mockElectronDB.updateSession.mockResolvedValue({
        success: true,
        data: makeSession({ conductorEnabled: false, conductorPersonaId: null }),
      });

      await useSessionsStore.getState().disableConductor();

      expect(mockElectronConductor.disable).toHaveBeenCalledWith('session-1');
      expect(useSessionsStore.getState().conductorRunning).toBe(false);
      expect(useSessionsStore.getState().conductorPaused).toBe(false);
      expect(toast.success).toHaveBeenCalledWith('Conductor disabled');
    });

    it('maps_circuit_breaker_process_turn_response_to_pause_behavior', async () => {
      const session = makeSession({ conductorEnabled: true, conductorPersonaId: 'persona-1' });
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

    it('maps_wait_for_user_process_turn_response_to_stop_running', async () => {
      const session = makeSession({ conductorEnabled: true, conductorPersonaId: 'persona-1' });
      useSessionsStore.setState({ currentSession: session, sessions: [session], conductorRunning: false });

      mockElectronConductor.processTurn.mockResolvedValue({
        success: true,
        action: 'WAIT_FOR_USER',
        blackboardUpdate: { nextStep: 'Await user answer' },
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
    });

    it('resets_circuit_breaker_then_continues_conductor_loop', async () => {
      const session = makeSession({ conductorEnabled: true, conductorPersonaId: 'persona-1' });
      useSessionsStore.setState({ currentSession: session, sessions: [session], conductorPaused: true });

      mockElectronConductor.resetCircuitBreaker.mockResolvedValue({ success: true });
      mockElectronDB.updateSession.mockResolvedValue({
        success: true,
        data: makeSession({ conductorEnabled: true, conductorPersonaId: 'persona-1', autoReplyCount: 0 }),
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

    it('returns_true_when_export_is_cancelled_by_user', async () => {
      mockElectronExport.exportSessionToMarkdown.mockResolvedValue({ success: true, cancelled: true });

      const result = await useSessionsStore.getState().exportSessionToMarkdown('session-1');

      expect(result).toBe(true);
      expect(toast.info).toHaveBeenCalledWith('Export cancelled');
    });

    it('warns_when_unhush_refresh_fails_after_successful_command', async () => {
      const session = makeSession();
      useSessionsStore.setState({ currentSession: session });
      mockElectronDB.unhushPersona.mockResolvedValue({ success: true });
      mockElectronDB.getSessionPersonas.mockResolvedValue({ success: false, error: 'refresh failed' });

      const result = await useSessionsStore.getState().unhushPersona('persona-1');

      expect(result).toBe(true);
      expect(toast.warning).toHaveBeenCalledWith('Persona unhushed, but failed to refresh participant state');
    });

    it('deletes_session_even_if_orphaned_tag_cleanup_fails', async () => {
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
