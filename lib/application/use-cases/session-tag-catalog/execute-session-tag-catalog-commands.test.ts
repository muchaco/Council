import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';

import { Clock } from '../../runtime';
import {
  SessionTagCatalogRepository,
  type CreateSessionTagCatalogEntryCommand,
  type SessionTagCatalogRepositoryService,
} from './session-tag-catalog-dependencies';
import { executeCreateSessionTagCatalogEntry } from './execute-session-tag-catalog-commands';

const baseRepository: SessionTagCatalogRepositoryService = {
  createTag: () => Effect.void,
  getTagByName: () => Effect.succeed(null),
  listActiveTags: () => Effect.succeed([]),
  deleteTag: () => Effect.void,
  addTagToSession: () => Effect.void,
  removeTagFromSession: () => Effect.void,
  listTagNamesBySession: () => Effect.succeed([]),
  cleanupOrphanedTags: () => Effect.succeed(0),
};

describe('execute_session_tag_catalog_commands_use_case_spec', () => {
  it('creates_session_tag_catalog_entry_with_clock_timestamp', async () => {
    const observedCreateCommands: CreateSessionTagCatalogEntryCommand[] = [];

    const writeCapableRepository: SessionTagCatalogRepositoryService = {
      ...baseRepository,
      createTag: (command) => {
        observedCreateCommands.push(command);
        return Effect.void;
      },
      getTagByName: (name) =>
        Effect.succeed({
          id: 7,
          name,
          createdAt: '2026-02-10T11:20:00.000Z',
        }),
    };

    const tag = await Effect.runPromise(
      executeCreateSessionTagCatalogEntry({ name: 'migration-risk' }).pipe(
        Effect.provideService(SessionTagCatalogRepository, writeCapableRepository),
        Effect.provideService(Clock, { now: Effect.succeed(new Date('2026-02-10T11:20:00.000Z')) })
      )
    );

    expect(observedCreateCommands).toEqual([
      {
        name: 'migration-risk',
        createdAt: '2026-02-10T11:20:00.000Z',
      },
    ]);
    expect(tag).toEqual({
      id: 7,
      name: 'migration-risk',
      createdAt: '2026-02-10T11:20:00.000Z',
    });
  });
});
