import { describe, expect, it, vi } from 'vitest';
import { Effect, Either } from 'effect';

import { executeAssignSessionTag } from './execute-assign-session-tag';
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

describe('execute_assign_session_tag_use_case_spec', () => {
  it('assigns_cached_catalog_entry_without_lookup_or_creation', async () => {
    const persistence = makePersistence();
    const availableTags = [{ id: 10, name: 'tag-a', createdAt: '2026-01-01T00:00:00Z' }];

    const result = await Effect.runPromise(
      executeAssignSessionTag({
        sessionId: 'session-1',
        requestedTagName: 'tag-a',
        assignedTagNames: [],
        availableTags,
      }).pipe(Effect.provideService(SessionTagPersistence, persistence))
    );

    expect(result).toEqual({
      normalizedTagName: 'tag-a',
      nextAssignedTagNames: ['tag-a'],
      createdTag: null,
    });
    expect(persistence.getTagByName).not.toHaveBeenCalled();
    expect(persistence.createTag).not.toHaveBeenCalled();
    expect(persistence.addTagToSession).toHaveBeenCalledWith('session-1', 10);
  });

  it('reuses_db_catalog_entry_when_missing_from_available_tags', async () => {
    const persistence = makePersistence();
    persistence.getTagByName.mockReturnValue(
      Effect.succeed({ id: 42, name: 'tag-b', createdAt: '2026-01-01T00:00:00Z' })
    );

    const result = await Effect.runPromise(
      executeAssignSessionTag({
        sessionId: 'session-1',
        requestedTagName: 'tag-b',
        assignedTagNames: ['tag-a'],
        availableTags: [{ id: 1, name: 'tag-a', createdAt: '2026-01-01T00:00:00Z' }],
      }).pipe(Effect.provideService(SessionTagPersistence, persistence))
    );

    expect(result.createdTag).toEqual({
      id: 42,
      name: 'tag-b',
      createdAt: '2026-01-01T00:00:00Z',
    });
    expect(persistence.getTagByName).toHaveBeenCalledWith('tag-b');
    expect(persistence.createTag).not.toHaveBeenCalled();
    expect(persistence.addTagToSession).toHaveBeenCalledWith('session-1', 42);
  });

  it('creates_catalog_entry_when_missing_everywhere', async () => {
    const persistence = makePersistence();
    persistence.getTagByName.mockReturnValue(Effect.succeed(null));
    persistence.createTag.mockReturnValue(
      Effect.succeed({ id: 77, name: 'tag-c', createdAt: '2026-01-01T00:00:00Z' })
    );

    const result = await Effect.runPromise(
      executeAssignSessionTag({
        sessionId: 'session-1',
        requestedTagName: 'tag-c',
        assignedTagNames: [],
        availableTags: [],
      }).pipe(Effect.provideService(SessionTagPersistence, persistence))
    );

    expect(result.createdTag).toEqual({
      id: 77,
      name: 'tag-c',
      createdAt: '2026-01-01T00:00:00Z',
    });
    expect(persistence.getTagByName).toHaveBeenCalledWith('tag-c');
    expect(persistence.createTag).toHaveBeenCalledWith('tag-c');
    expect(persistence.addTagToSession).toHaveBeenCalledWith('session-1', 77);
  });

  it('returns_domain_error_without_invoking_persistence_when_decision_fails', async () => {
    const persistence = makePersistence();

    const outcome = await Effect.runPromise(
      executeAssignSessionTag({
        sessionId: 'session-1',
        requestedTagName: '   ',
        assignedTagNames: [],
        availableTags: [],
      }).pipe(Effect.provideService(SessionTagPersistence, persistence), Effect.either)
    );

    expect(Either.isLeft(outcome)).toBe(true);
    if (Either.isLeft(outcome)) {
      expect(outcome.left).toEqual({
        _tag: 'SessionTagNameEmptyError',
        message: 'Tag cannot be empty',
      });
    }

    expect(persistence.getTagByName).not.toHaveBeenCalled();
    expect(persistence.createTag).not.toHaveBeenCalled();
    expect(persistence.addTagToSession).not.toHaveBeenCalled();
  });
});
