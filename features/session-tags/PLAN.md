# Session Tags - Implementation Plan

## Architecture

### Alignment with AGENTS.md

This feature follows the **Functional Core, Imperative Shell** pattern from AGENTS.md:

**Functional Core (Pure Logic):**
- Tag validation logic: length check, duplicate detection (case-insensitive), whitespace trimming
- Tag normalization: lowercase transformation
- Tag sorting and deduplication
- Max tag count enforcement

**Imperative Shell (I/O & Orchestration):**
- Database operations (migrations, queries)
- IPC handlers (tag CRUD, session-tag linking)
- UI state management (Zustand store)
- UI components (input, display, autocomplete)

**Separation of Concerns:**
- **Data Layer**: Database schema, migrations, queries
- **Service Layer**: IPC handlers, database operations
- **State Layer**: Zustand store actions for tags
- **UI Layer**: TagInput component, TagDisplay component, session form integration

---

## Implementation Strategy

### Phase 1: Database Foundation

**Migration V6** (`electron/lib/db.ts`):
```
1. Create `tags` table:
   - id: INTEGER PRIMARY KEY AUTOINCREMENT
   - name: TEXT UNIQUE NOT NULL (case-insensitive unique via application logic)
   - created_at: DATETIME DEFAULT CURRENT_TIMESTAMP

2. Create `session_tags` junction table:
   - session_id: TEXT NOT NULL FK(sessions.id) ON DELETE CASCADE
   - tag_id: INTEGER NOT NULL FK(tags.id) ON DELETE CASCADE
   - created_at: DATETIME DEFAULT CURRENT_TIMESTAMP
   - PRIMARY KEY (session_id, tag_id)

3. Add ON DELETE CASCADE to ensure session deletion removes tag associations
```

**Database Queries** (`electron/lib/queries.ts`):
```typescript
// Tag CRUD
- createTag(name: string): Tag
- getTagByName(name: string): Tag | null
- getAllTags(): Tag[]
- deleteTag(id: number): void

// Session-Tag operations
- addTagToSession(sessionId: string, tagId: number): void
- removeTagFromSession(sessionId: string, tagId: number): void
- getTagsBySession(sessionId: string): string[]
- cleanupOrphanedTags(): void // Deletes tags with no session associations

// Cascading operations
- deleteSession(sessionId: string): void // Existing, ensure cascade works
```

**IPC Handlers** (`electron/handlers/db.ts`):
```typescript
// Tag operations
- db:createTag -> { success, data: Tag, error }
- db:getAllTags -> { success, data: Tag[], error }
- db:deleteTag -> { success, error }

// Session-Tag operations
- db:addTagToSession -> { success, error }
- db:removeTagFromSession -> { success, error }
- db:getTagsBySession -> { success, data: string[], error }
```

**Preload/Types** (`electron/preload.ts`, `lib/electron.d.ts`):
```typescript
// Extend ElectronDB interface
interface Tag {
  id: number;
  name: string;
  createdAt: string;
}

// Add to window.electronDB
tags: {
  create: (name: string) => Promise<IPCResult<Tag>>;
  getAll: () => Promise<IPCResult<Tag[]>>;
  delete: (id: number) => Promise<IPCResult<void>>;
},
sessionTags: {
  add: (sessionId: string, tagId: number) => Promise<IPCResult<void>>;
  remove: (sessionId: string, tagId: number) => Promise<IPCResult<void>>;
  getBySession: (sessionId: string) => Promise<IPCResult<string[]>>;
}
```

### Phase 2: Core Logic & State

**Type Extensions** (`lib/types.ts`):
```typescript
interface Session {
  // ... existing fields
  tags: string[]; // Array of tag names for the session
}

interface Tag {
  id: number;
  name: string;
  createdAt: string;
}
```

**Validation Logic** (`lib/validation.ts` - NEW FILE):
```typescript
// Pure functions - Functional Core
export const validateTagInput = (
  input: string,
  existingTags: string[]
): { valid: boolean; error?: string; normalizedTag?: string } => {
  const trimmed = input.trim();
  
  // FR-1.9: Reject if only whitespace
  if (!trimmed) {
    return { valid: false, error: 'Tag cannot be empty' };
  }
  
  // FR-1.1: Max 20 characters
  if (trimmed.length > 20) {
    return { valid: false, error: 'Tag must be 20 characters or less' };
  }
  
  // FR-1.4: Normalize to lowercase
  const normalized = trimmed.toLowerCase();
  
  // FR-1.3: No duplicates (case-insensitive)
  if (existingTags.some(tag => tag.toLowerCase() === normalized)) {
    return { valid: false, error: 'Tag already exists' };
  }
  
  return { valid: true, normalizedTag: normalized };
};

export const canAddTag = (currentTags: string[]): boolean => {
  // FR-1.2: Max 3 tags
  return currentTags.length < 3;
};

export const sanitizeTag = (tag: string): string => {
  // FR-1.18: Trim whitespace
  // FR-1.4: Normalize to lowercase
  // FR-1.17: Allow alphanumeric, special chars, spaces, emojis (no special sanitization needed for SQLite text)
  return tag.trim().toLowerCase();
};
```

**Zustand Store Extension** (`stores/sessions.ts`):
```typescript
// Add to SessionStore state
allTags: Tag[]; // For autocomplete

// Add to SessionStore actions
fetchAllTags: () => Promise<void>;
addTagToSession: (sessionId: string, tagName: string) => Promise<void>;
removeTagFromSession: (sessionId: string, tagName: string) => Promise<void>;

// Modify createSession to accept tags array
// Modify updateSession to handle tag updates
```

**Implementation Notes for Store:**
- `fetchAllTags`: Load all tags from DB for autocomplete (called on app init and after tag creation)
- `addTagToSession`: Create tag if doesn't exist, link to session, update local state
- `removeTagFromSession`: Unlink tag from session, update local state, trigger orphaned tag cleanup

### Phase 3: UI Components

**TagInput Component** (`components/ui/TagInput.tsx` - NEW FILE):
```typescript
interface TagInputProps {
  tags: string[];
  allTags: Tag[]; // For autocomplete
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  disabled?: boolean;
  maxTags?: number;
}

// Component structure:
// - Horizontal flex container for tag pills
// - Each pill: Badge with X icon for removal (FR-1.12)
// - Plus icon button (disabled when tags.length >= 3) (FR-1.5)
// - Popover triggered by plus button (FR-1.6)
//   - Input field with autocomplete dropdown showing matching existing tags
//   - Enter key submits (FR-1.8)
//   - Validation error display inline (FR-1.9)
//   - Closes on successful add (FR-1.11)
```

**TagDisplay Component** (`components/ui/TagDisplay.tsx` - NEW FILE):
```typescript
interface TagDisplayProps {
  tags: string[];
  variant?: 'editable' | 'readonly';
  onRemoveTag?: (tag: string) => void;
}

// Component structure:
// - Horizontal row of badges (FR-1.16)
// - 'editable' variant: Shows X icon on each badge
// - 'readonly' variant: Plain badges
// - Uses shadcn Badge component (FR-1.15)
```

### Phase 4: Page Integration

**Session Creation Page** (`app/session/new/page.tsx`):
```typescript
// Add to form state
tags: string[];

// Add TagInput component to form
// Pass tags state and allTags from store
// On form submission, include tags array in createSession call
```

**Sessions List Page** (`app/sessions/page.tsx`):
```typescript
// Modify session card to display tags
// Use TagDisplay with variant='readonly'
// Position tags immediately adjacent to title (FR-1.16a)
// Update session card layout to accommodate tags row
```

**Session View Page** (`app/session/page.tsx`):
```typescript
// Display current session tags using TagDisplay
// Position immediately adjacent to title (FR-1.16a)
// For archived sessions: use readonly variant
// For active sessions: use editable variant with remove capability
// Allow adding tags via TagInput component
```

### Phase 5: Cascading Cleanup

**Session Deletion Flow** (`electron/lib/queries.ts`):
```typescript
// In deleteSession query:
// 1. Delete session (cascade deletes session_tags entries via FK constraint)
// 2. Call cleanupOrphanedTags() to remove tags with no associations

export const cleanupOrphanedTags = (): void => {
  // DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM session_tags)
};
```

---

## Execution Phases

### Phase 1: Database & IPC Foundation ✅ COMPLETE
**Goal**: Establish data persistence layer

**Changes:**
1. ✅ Create database migration V6 (tags table, session_tags junction table)
2. ✅ Add tag query functions in `electron/lib/queries.ts`
3. ✅ Add IPC handlers in `electron/handlers/db.ts`
4. ✅ Extend preload and type definitions
5. ✅ Extend Session type with tags field

**Tests:**
- ✅ Unit tests for tag validation functions (FR-1.1, FR-1.3, FR-1.4, FR-1.9)
  - Test max length validation (20 chars)
  - Test duplicate detection (case-insensitive)
  - Test whitespace trimming
  - Test empty input rejection
  - Test valid input acceptance
- Integration tests for database operations (deferred to Phase 2)
  - Tag creation and retrieval
  - Session-tag linking
  - Cascade delete behavior
  - Orphaned tag cleanup

**Validation:**
- ✅ Migration runs successfully
- ✅ IPC methods exposed and callable
- ✅ Database constraints enforced
- ✅ 29 unit tests passing
- ✅ Linter passes with no errors

### Phase 2: State Management & Core Logic ✅ COMPLETE
**Goal**: Connect data layer to frontend state

**Changes:**
1. ✅ Create `lib/validation.ts` with tag validation pure functions
2. ✅ Extend Zustand store with tag actions
3. ✅ Modify `createSession` and `updateSession` to handle tags
4. ✅ Add `fetchAllTags` for autocomplete

**Tests:**
- ✅ Unit tests for validation functions (comprehensive edge cases)
  - Valid tags: "feature", "bug-fix", "🚀 launch", "AI Research"
  - Invalid tags: "", "   ", "this-is-a-very-long-tag-name", "Duplicate"
  - Normalization: "Feature" → "feature", "  Tag  " → "tag"
- ✅ Store action tests (mock IPC layer)
  - Add tag to session
  - Remove tag from session
  - Enforce max 3 tags limit
  - Handle tag creation vs reuse

**Validation:**
- ✅ Store actions update state correctly
- ✅ Validation rejects invalid inputs
- ✅ Max tag limit enforced
- ✅ All 34 store tests passing

### Phase 3: UI Components
**Goal**: Build reusable tag UI components

**Changes:**
1. Create `components/ui/TagInput.tsx`
2. Create `components/ui/TagDisplay.tsx`
3. Integrate Popover, Badge, Input from shadcn/ui
4. Implement autocomplete dropdown in TagInput

**Tests:**
- Component tests for TagInput
  - Renders existing tags as pills
  - Plus button disabled at 3 tags (FR-1.5)
  - Popover opens on click
  - Enter key submits (FR-1.8)
  - Validation error display (FR-1.9)
  - Autocomplete shows matching tags
- Component tests for TagDisplay
  - Renders tags as badges (FR-1.15)
  - Shows remove X in editable mode (FR-1.13)
  - No X in readonly mode (FR-1.14)
  - Horizontal layout (FR-1.16)

**Validation:**
- Components render in Storybook/isolation
- User interactions work correctly
- Visual design matches spec

### Phase 4: Page Integration
**Goal**: Integrate tags into existing UI flows

**Changes:**
1. Update `app/session/new/page.tsx` with TagInput
2. Update `app/sessions/page.tsx` with TagDisplay
3. Update `app/session/page.tsx` with tag management
4. Handle archived session tag display (read-only)

**Tests:**
- E2E/integration tests
  - Create session with tags
  - View tags in session list
  - Add/remove tags in session view
  - Archived sessions show read-only tags
  - Tag persistence across page navigation
- Accessibility tests
  - Keyboard navigation for tag input
  - Screen reader announcements

**Validation:**
- Full user workflow works end-to-end
- Tags persist after app restart
- UI matches requirements in all contexts

### Phase 5: Edge Cases & Cleanup
**Goal**: Handle edge cases and data integrity

**Changes:**
1. Implement orphaned tag cleanup on session delete
2. Add error boundaries for tag operations
3. Optimize autocomplete performance

**Tests:**
- Edge case tests
  - Rapid tag add/remove (race conditions)
  - Very long tag names (boundary testing)
  - Special characters in tags (FR-1.17)
  - Emojis in tags (FR-1.17)
  - Concurrent tag operations
- Cleanup tests
  - Orphaned tags deleted on session delete
  - Referenced tags preserved

**Validation:**
- No orphaned tags remain after session deletion
- Performance meets NFR-1 (<100ms operations)
- XSS protection verified (NFR-4)

---

## Requirement Coverage Matrix

| Requirement ID | Description | Implementation Changes | Tests | Phase |
|----------------|-------------|----------------------|-------|-------|
| FR-1.1 | Max 20 char tag length | `lib/validation.ts`: `validateTagInput` length check | Unit test: reject >20 chars, accept ≤20 chars | 2 |
| FR-1.2 | 0-3 tags per session | `lib/validation.ts`: `canAddTag` function; `TagInput`: disabled state | Unit test: allow 0-2, block at 3; Component test: button disabled at 3 | 2, 3 |
| FR-1.3 | No duplicate tags (case-insensitive) | `lib/validation.ts`: duplicate check with lowercase comparison | Unit test: reject "Feature" when "feature" exists | 2 |
| FR-1.4 | Normalize to lowercase | `lib/validation.ts`: `sanitizeTag` | Unit test: "Feature" → "feature" | 2 |
| FR-1.5 | Disabled add button at 3 tags | `TagInput`: conditional disabled prop | Component test: button disabled when tags.length >= 3 | 3 |
| FR-1.6 | Popover interface for input | `TagInput`: Popover component integration | Component test: popover opens on plus click | 3 |
| FR-1.7 | Single text input in popover | `TagInput`: Input inside Popover | Component test: input renders in popover | 3 |
| FR-1.8 | Enter key submission | `TagInput`: onKeyDown handler for Enter | Component test: Enter triggers onAddTag | 3 |
| FR-1.9 | Validation on Enter | `TagInput`: call `validateTagInput`, show error | Component test: error display on invalid input | 3 |
| FR-1.10 | Append without reordering | `stores/sessions.ts`: `addTagToSession` pushes to array | Store test: tag appended to end | 2 |
| FR-1.11 | Popover closes on success | `TagInput`: setOpen(false) on valid add | Component test: popover closes after add | 3 |
| FR-1.12 | Remove via X icon | `TagDisplay`: X icon onClick handler | Component test: click X calls onRemoveTag | 3 |
| FR-1.12a | No inline editing | Not implemented (by design) | Verify no edit functionality exists | 4 |
| FR-1.13 | Pills with X in editable contexts | `TagDisplay`: variant='editable' | Component test: X visible in editable mode | 3 |
| FR-1.14 | Badges without X in read-only | `TagDisplay`: variant='readonly' | Component test: no X in readonly mode | 3 |
| FR-1.15 | Distinct badge/pill style | Use shadcn Badge component | Visual regression test | 3 |
| FR-1.16 | Single horizontal row | `TagDisplay`: flex-row layout | Component test: horizontal flex layout | 3 |
| FR-1.16a | Tags adjacent to title | `app/sessions/page.tsx`, `app/session/page.tsx`: layout update | E2E test: visual positioning correct | 4 |
| FR-1.17 | Allow alphanumeric, special chars, spaces, emojis | `lib/validation.ts`: no restrictive regex | Unit test: accept emojis and special chars | 2 |
| FR-1.18 | Trim whitespace | `lib/validation.ts`: `trim()` in `sanitizeTag` | Unit test: " tag " → "tag" | 2 |
| FR-1.19 | Tags table with unique constraint | `electron/lib/db.ts`: V6 migration | Migration test: unique constraint enforced | 1 |
| FR-1.20 | Session_tags junction table | `electron/lib/db.ts`: V6 migration | Migration test: FK constraints exist | 1 |
| FR-1.21 | Cascade delete associations | `electron/lib/db.ts`: ON DELETE CASCADE | Integration test: delete session removes associations | 1 |
| FR-1.22 | API to retrieve all tags | `electron/lib/queries.ts`: `getAllTags`; IPC handler | Integration test: returns all tag names | 1 |
| NFR-1 | <100ms operations | Efficient queries, indexed lookups | Performance test: operations complete <100ms | 5 |
| NFR-2 | Support filtering queries | Indexed tag_id in session_tags | Query plan analysis | 1 |
| NFR-3 | Max 3 tags UI | Same as FR-1.2 | Same as FR-1.2 | 2, 3 |
| NFR-4 | XSS prevention | Input treated as text, no HTML rendering | Security test: <script> tags rendered as text | 2 |

---

## Files to Modify

### New Files
1. `lib/validation.ts` - Tag validation pure functions
2. `components/ui/TagInput.tsx` - Tag input with popover
3. `components/ui/TagDisplay.tsx` - Tag display component

### Modified Files
1. `electron/lib/db.ts` - Migration V6
2. `electron/lib/queries.ts` - Tag CRUD operations
3. `electron/handlers/db.ts` - Tag IPC handlers
4. `electron/preload.ts` - Expose tag APIs
5. `lib/electron.d.ts` - Type definitions
6. `lib/types.ts` - Session.tags field
7. `stores/sessions.ts` - Tag state management
8. `app/session/new/page.tsx` - Add tags to creation form
9. `app/sessions/page.tsx` - Display tags in list
10. `app/session/page.tsx` - Manage tags in session view

---

## Testing Summary

| Phase | Unit Tests | Integration Tests | Component Tests | E2E Tests |
|-------|-----------|-------------------|-----------------|-----------|
| 1 | 0 | 4 | 0 | 0 |
| 2 | 8 | 2 | 0 | 0 |
| 3 | 0 | 0 | 8 | 0 |
| 4 | 0 | 0 | 0 | 4 |
| 5 | 2 | 2 | 0 | 0 |
| **Total** | **10** | **8** | **8** | **4** |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Migration conflicts | Test migration on clean and existing databases |
| Performance with many tags | Use indexed queries, test with 1000+ tags |
| Race conditions in tag creation | Implement upsert pattern (create if not exists) |
| UI layout breaks with long tags | CSS truncation, max-width on tag pills |
| Archived session tag confusion | Clear visual distinction (no edit controls) |

---

## Success Criteria

- ✅ All 22 FR requirements implemented and tested
- ✅ All 4 NFR requirements met
- ✅ No orphaned tags after session deletion
- ✅ Autocomplete functional in tag input
- ✅ Archived sessions show read-only tags
- ✅ Performance <100ms for all tag operations
- ✅ No console errors or warnings
- ✅ ESLint and type checks pass

---

**Last Updated**: 2026-02-07  
**Plan Version**: 1.0
