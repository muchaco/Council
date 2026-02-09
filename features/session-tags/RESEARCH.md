# Session Tags - Research Document

## Current Git Hash
`21027ca481e893afea59659e30caa74141548e46`

---

## Logic Map

### 1. Session Data Model
**File:** `lib/types.ts:L29-L46`
**Status:** Clean

Current Session interface defines:
- id, title, problemDescription, outputGoal
- status, tokenCount, costEstimate
- orchestratorEnabled, orchestratorPersonaId
- blackboard, autoReplyCount, tokenBudget, summary
- archivedAt, createdAt, updatedAt

**Finding:** No `tags` field exists in the Session type. This is a foundational change required.

---

### 2. Database Schema
**File:** `electron/lib/db.ts:L10, L140-L343`
**Status:** Clean

Current schema version: 5
Migration history:
- V1: Initial tables (personas, sessions, session_personas, messages)
- V2: Added orchestrator columns
- V3: Added metadata column to messages
- V4: Added verbosity column to personas
- V5: Added archived_at column to sessions

Sessions table columns (L216-L226):
```sql
id, title, problem_description, output_goal, status, token_count, 
cost_estimate, orchestrator_enabled, orchestrator_persona_id, 
blackboard, auto_reply_count, token_budget, summary, archived_at, 
created_at, updated_at
```

**Finding:** No `tags` table or `session_tags` junction table exists. New migration (V6) required.

---

### 3. Session Store (Zustand)
**File:** `stores/sessions.ts:L1-L506`
**Status:** Clean

Current state structure (L40-49):
- sessions: Session[]
- currentSession: Session | null
- messages, sessionPersonas, isLoading, etc.

Current actions:
- fetchSessions, createSession, loadSession, updateSession, deleteSession
- sendUserMessage, triggerPersonaResponse
- enableOrchestrator, disableOrchestrator, processOrchestratorTurn
- archiveSession, unarchiveSession

**Finding:** No tag-related state or actions exist. Store needs extension for tag operations.

---

### 4. Session Creation UI
**File:** `app/session/new/page.tsx:L1-L317`
**Status:** Clean

Form state (L20-27):
```typescript
const [formData, setFormData] = useState({
  title: '',
  problemDescription: '',
  outputGoal: '',
});
```

Form submission (L56-74) calls `createSession()` with session data and persona IDs.

**Finding:** No tag input UI exists. Form needs tag management component.

---

### 5. Sessions List UI
**File:** `app/sessions/page.tsx:L1-L224`
**Status:** Clean

Session card displays (L113-L198):
- Title (linked)
- Description
- Status Badge
- Creation date and duration
- Cost estimate

**Finding:** No tag display in session cards. Badge component available from `components/ui/badge`.

---

### 6. Session Detail/View UI
**File:** `app/session/page.tsx:L1-L600`
**Status:** Clean

Displays:
- Session title in header (L311)
- Problem description (L312-314)
- Session info panel with status, goal, participants (L514-L555)
- No tag display location

**Finding:** Tags should be positioned adjacent to session title per FR-1.16a.

---

### 7. IPC API Layer
**Files:** 
- `electron/preload.ts:L1-L78` (Clean)
- `lib/electron.d.ts:L1-L66` (Clean)

Current `electronDB` API exposed (preload.ts:L4-L31):
- Persona: create, getAll, get, update, delete
- Session: create, getAll, get, update, delete, archive, unarchive
- Message: create, getBySession
- SessionPersona: add, getBySession

**Finding:** No tag-related IPC methods. Need to extend preload and type definitions.

---

### 8. Database Query Layer
**File:** `electron/lib/queries.ts:L1-L556`
**Status:** Clean

Existing operations:
- Persona CRUD (L53-L173)
- Session CRUD (L176-L362)
- Message operations (L365-L433)
- SessionPersona operations (L436-L473)
- Orchestrator operations (L487-L531)
- Archive operations (L534-L555)

**Finding:** No tag-related queries. Need new query functions for:
- Create/get/update/delete tags
- Link/unlink tags to sessions
- Get all tags
- Get tags by session

---

### 9. Database Handlers (IPC)
**File:** `electron/handlers/db.ts:L1-L211`
**Status:** Clean

Handler patterns established:
- Consistent error handling with try/catch
- Logging for each operation
- Return format: `{ success: boolean, data?: unknown, error?: string }`

**Finding:** Tag handlers need to follow this pattern. New handlers required for tag operations.

---

### 10. UI Components Available
**Path:** `components/ui/`

Relevant components found:
- `badge.tsx` - For tag display
- `input.tsx` - For tag input
- `popover.tsx` - For tag popover (FR-1.6)
- Icons: `Plus`, `X` from `lucide-react`

**Finding:** All necessary UI primitives exist. No new component library needed.

---

## Confidence Table

| Requirement | Score | Evidence | Notes |
|-------------|-------|----------|-------|
| FR-1.1 (20 char max) | 0% | No validation logic exists | New validation needed |
| FR-1.2 (0-3 tags) | 0% | No tag storage exists | Data model + UI constraint needed |
| FR-1.3 (no duplicates) | 0% | No tag logic exists | Case-insensitive check needed |
| FR-1.4 (lowercase storage) | 0% | No tag normalization | Transform on save |
| FR-1.5 (disabled at 3) | 0% | No add button exists | UI state management needed |
| FR-1.6 (popover) | 0% | No tag UI exists | Popover component available |
| FR-1.7-1.12 (tag mgmt) | 0% | No operations exist | Full CRUD needed |
| FR-1.13-1.16 (display) | 0% | No tag display | Badge component available |
| FR-1.17-1.18 (content rules) | 0% | No validation | Trim + length check |
| FR-1.19 (tags table) | 0% | No table exists | Migration V6 needed |
| FR-1.20 (junction table) | 0% | No junction table | Migration V6 needed |
| FR-1.21 (cascade delete) | 0% | No FK constraints | Set ON DELETE CASCADE |
| FR-1.22 (all tags API) | 0% | No API exists | New IPC methods needed |

---

## Architecture Implications

### Database Layer
- New migration V6 required (follow pattern in `electron/lib/db.ts:L188-L193`)
- Two new tables needed: `tags` and `session_tags`
- Query functions to add in `electron/lib/queries.ts`
- IPC handlers to add in `electron/handlers/db.ts`

### Frontend Layer
- Extend Session type in `lib/types.ts` to include `tags: string[]`
- Extend Zustand store with tag actions
- Add tag input to `app/session/new/page.tsx`
- Add tag display to `app/sessions/page.tsx` and `app/session/page.tsx`

### IPC Layer
- Extend preload.ts with tag methods
- Extend electron.d.ts type definitions

---

## Contradictions / Clarifications

None found. The PRD requirements are clear and the codebase currently has no tag implementation.

---

## Implementation Complexity

**High:** This feature requires changes across the entire stack:
1. Database schema (migration)
2. Database queries
3. IPC handlers
4. Preload/type definitions
5. Zustand store
6. Three UI pages
7. Validation logic

Estimated touchpoints: 10+ files
