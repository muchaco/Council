export interface EnsureSessionTagCatalogEntryEffect {
  readonly _tag: 'EnsureSessionTagCatalogEntry';
  readonly normalizedTagName: string;
}

export interface PersistSessionTagAssignmentEffect {
  readonly _tag: 'PersistSessionTagAssignment';
  readonly sessionId: string;
  readonly normalizedTagName: string;
}

export interface PersistSessionTagRemovalEffect {
  readonly _tag: 'PersistSessionTagRemoval';
  readonly sessionId: string;
  readonly normalizedTagName: string;
}

export interface CleanupOrphanedSessionTagsEffect {
  readonly _tag: 'CleanupOrphanedSessionTags';
}

export interface RefreshSessionTagCatalogEffect {
  readonly _tag: 'RefreshSessionTagCatalog';
}

export type AssignSessionTagEffect =
  | EnsureSessionTagCatalogEntryEffect
  | PersistSessionTagAssignmentEffect;

export type RemoveSessionTagEffect =
  | PersistSessionTagRemovalEffect
  | CleanupOrphanedSessionTagsEffect
  | RefreshSessionTagCatalogEffect;

export interface AssignSessionTagPlan {
  readonly normalizedTagName: string;
  readonly nextAssignedTagNames: readonly string[];
  readonly effects: readonly AssignSessionTagEffect[];
}

export interface RemoveSessionTagPlan {
  readonly normalizedTagName: string;
  readonly nextAssignedTagNames: readonly string[];
  readonly effects: readonly RemoveSessionTagEffect[];
}
