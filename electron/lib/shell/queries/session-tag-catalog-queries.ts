import type { Tag, TagInput } from '../../types.js';
import {
  executeAssignSessionTagCatalogEntryToSession,
  executeCleanupOrphanedSessionTags,
  executeCreateSessionTagCatalogEntry,
  executeDeleteSessionTagCatalogEntry,
  executeLoadActiveSessionTagCatalog,
  executeLoadSessionTagByName,
  executeLoadSessionTagNames,
  executeRemoveSessionTagCatalogEntryFromSession,
} from '../../../../lib/application/use-cases';
import { runSessionTagCatalog } from './context.js';

export async function createTag(data: TagInput): Promise<Tag> {
  return runSessionTagCatalog(executeCreateSessionTagCatalogEntry(data));
}

export async function getTagByName(name: string): Promise<Tag | null> {
  return runSessionTagCatalog(executeLoadSessionTagByName(name));
}

export async function getAllTags(): Promise<Tag[]> {
  return runSessionTagCatalog(executeLoadActiveSessionTagCatalog());
}

export async function deleteTag(id: number): Promise<void> {
  await runSessionTagCatalog(executeDeleteSessionTagCatalogEntry(id));
}

export async function addTagToSession(sessionId: string, tagId: number): Promise<void> {
  await runSessionTagCatalog(executeAssignSessionTagCatalogEntryToSession(sessionId, tagId));
}

export async function removeTagFromSession(sessionId: string, tagId: number): Promise<void> {
  await runSessionTagCatalog(executeRemoveSessionTagCatalogEntryFromSession(sessionId, tagId));
}

export async function getTagsBySession(sessionId: string): Promise<string[]> {
  return runSessionTagCatalog(executeLoadSessionTagNames(sessionId));
}

export async function cleanupOrphanedTags(): Promise<number> {
  return runSessionTagCatalog(executeCleanupOrphanedSessionTags());
}
