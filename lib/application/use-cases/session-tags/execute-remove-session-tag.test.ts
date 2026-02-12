import { describe, expect, it, vi } from 'vitest';
import { Effect, Either } from 'effect';

import { executeRemoveSessionTag } from './execute-remove-session-tag';
import type { SessionTagPersistenceService } from './session-tag-persistence-service';
import { SessionTagPersistence } from './session-tag-persistence-service';

const makePersistence = (): SessionTagPersistenceService & {
  readonly getTagByName: ReturnType<typeof vi.fn>;
  readonly createTag: ReturnType<typeof vi.fn>;
  readonly addTagToSession: ReturnType<typeof vi.fn>;
  readonly removeTagFromSession: ReturnType<typeof vi.fn>;
  readonly cleanupOrphanedTags: ReturnType<typeof vi.fn>;
  readonly getAllTags: ReturnType<typeof vi.fn>;
} => ({
  getTagByName: vi.fn(() => Effect.succeed(null)),
  createTag: vi.fn((tagName: string) =>
    Effect.succeed({ id: 999, name: tagName, createdAt: '2026-01-01T00:00:00Z' })
  ),
  addTagToSession: vi.fn(() => Effect.void),
  removeTagFromSession: vi.fn(() => Effect.void),
  cleanupOrphanedTags: vi.fn(() => Effect.void),
  getAllTags: vi.fn(() => Effect.succeed([])),
});

describe('execute_remove_session_tag_use_case_spec', () => {
  it('removes_tag_with_case_insensitive_catalog_match', async () => {
    const persistence = makePersistence();
    persistence.getAllTags.mockReturnValue(
      Effect.succeed([{ id: 1, name: 'tag-a', createdAt: '2026-01-01T00:00:00Z' }])
    );

    const result = await Effect.runPromise(
      executeRemoveSessionTag({
        sessionId: 'session-1',
        requestedTagName: 'tag-b',
        assignedTagNames: ['Tag-B', 'tag-a'],
        availableTags: [
          { id: 2, name: 'TAG-B', createdAt: '2026-01-01T00:00:00Z' },
          { id: 1, name: 'tag-a', createdAt: '2026-01-01T00:00:00Z' },
        ],
      }).pipe(Effect.provideService(SessionTagPersistence, persistence))
    );

    expect(persistence.removeTagFromSession).toHaveBeenCalledWith('session-1', 2);
    expect(persistence.getTagByName).not.toHaveBeenCalled();
    expect(result.nextAssignedTagNames).toEqual(['tag-a']);
    expect(result.refreshedTagCatalog).toEqual([{ id: 1, name: 'tag-a', createdAt: '2026-01-01T00:00:00Z' }]);
  });

  it('returns_domain_error_when_catalog_entry_cannot_be_found', async () => {
    const persistence = makePersistence();
    persistence.getTagByName.mockReturnValue(Effect.succeed(null));

    const outcome = await Effect.runPromise(
      executeRemoveSessionTag({
        sessionId: 'session-1',
        requestedTagName: 'tag-b',
        assignedTagNames: ['tag-a', 'tag-b'],
        availableTags: [{ id: 1, name: 'tag-a', createdAt: '2026-01-01T00:00:00Z' }],
      }).pipe(Effect.provideService(SessionTagPersistence, persistence), Effect.either)
    );

    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'SessionTagNotInCatalogError',
        message: 'Tag not found',
      });
    }

    expect(persistence.removeTagFromSession).not.toHaveBeenCalled();
  });

  it('returns_null_refreshed_catalog_when_cleanup_fails_to_preserve_existing_behavior', async () => {
    const persistence = makePersistence();
    persistence.cleanupOrphanedTags.mockReturnValue(
      Effect.fail({
        _tag: 'SessionTagInfrastructureError',
        message: 'cleanup failed',
      })
    );

    const result = await Effect.runPromise(
      executeRemoveSessionTag({
        sessionId: 'session-1',
        requestedTagName: 'tag-b',
        assignedTagNames: ['tag-a', 'tag-b'],
        availableTags: [{ id: 2, name: 'tag-b', createdAt: '2026-01-01T00:00:00Z' }],
      }).pipe(Effect.provideService(SessionTagPersistence, persistence))
    );

    expect(result.refreshedTagCatalog).toBeNull();
    expect(persistence.getAllTags).not.toHaveBeenCalled();
  });

  it('returns_domain_error_without_invoking_persistence_when_decision_fails', async () => {
    const persistence = makePersistence();

    const outcome = await Effect.runPromise(
      executeRemoveSessionTag({
        sessionId: 'session-1',
        requestedTagName: 'tag-z',
        assignedTagNames: ['tag-a'],
        availableTags: [
          { id: 1, name: 'tag-a', createdAt: '2026-01-01T00:00:00Z' },
          { id: 2, name: 'tag-z', createdAt: '2026-01-01T00:00:00Z' },
        ],
      }).pipe(Effect.provideService(SessionTagPersistence, persistence), Effect.either)
    );

    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'SessionTagNotAssignedError',
        message: 'Tag is not assigned to this session',
      });
    }

    expect(persistence.removeTagFromSession).not.toHaveBeenCalled();
    expect(persistence.cleanupOrphanedTags).not.toHaveBeenCalled();
  });
});
