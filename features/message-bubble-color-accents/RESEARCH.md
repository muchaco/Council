# Research: Message Bubble Color Accents

**Current Git Hash:** `21027ca481e893afea59659e30caa74141548e46`

---

## Logic Map

### 1. Persona Color Storage & Management

**File:** `lib/types.ts`  
**Lines:** L1-L13, L65-L74, L98-L108  
**Status:** Clean

- Persona interface includes `color: string` field (hex color value)
- PersonaInput includes `color: string` field for creation/updates
- Predefined color palette: `PERSONA_COLORS` array with 9 color options (Blue #3B82F6, Emerald #10B981, Red #EF4444, Purple #8B5CF6, Orange #F97316, Pink #EC4899, Cyan #06B6D4, Amber #F59E0B, Gray #6B7280)

**Evidence:**
```typescript
export interface Persona {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  geminiModel: string;
  temperature: number;
  color: string;  // <-- Hex color stored here
  ...
}
```

**Relevant to PRD:**
- FR-6.2 (Visual Separation with persona colors) - Already implemented, colors stored in database
- FR-1 (Programmatic Accent Color Calculation) - Base colors available

---

**File:** `app/personas/page.tsx`  
**Lines:** L355-L373 (color selector UI)  
**Status:** Clean

- Color selector displayed as 3x3 grid of color swatches in persona form dialog
- Selected color has `border-primary scale-110` styling
- Color is saved when creating/updating persona via `handleInputChange('color', color.value)`
- Persona card displays color as circular indicator (L188-L191)

**Evidence:**
```typescript
<div className="grid grid-cols-5 gap-2">
  {PERSONA_COLORS.map((color) => (
    <button
      key={color.value}
      onClick={() => handleInputChange('color', color.value)}
      style={{ backgroundColor: color.value }}
    />
  ))}
</div>
```

**Relevant to PRD:**
- FR-6.2 (Visual Separation) - Users can assign colors to personas
- Input to FR-1 (Programmatic Accent Color Calculation) - Color saved as hex string

---

**File:** `electron/lib/queries.ts`  
**Lines:** L53-L76 (createPersona), L116-L169 (updatePersona)  
**Status:** Clean

- Color stored in SQLite database as `color` column in `personas` table
- SQL schema includes `color` field (L58, L142-L144)

**Evidence:**
```typescript
await runQuery(
  `INSERT INTO personas (..., color, ...)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [..., data.color, ...]
);
```

**Relevant to PRD:**
- FR-6.2 - Color persistence in database
- FR-7 (Database Integration) - Color already fetched via `getSessionPersonas` query (L449-L468)

---

### 2. Message Bubble Rendering (Current Implementation)

**File:** `app/session/page.tsx`  
**Lines:** L353-L476 (Messages section)  
**Status:** Clean

- Messages rendered inline within the session page component
- No separate `MessageBubble` component exists (contradicts PRD assumption at L127-L128)
- Message bubbles use conditional classes based on sender type:
  - User messages: `bg-primary text-primary-foreground` (L408)
  - Intervention messages: `bg-secondary border` (L409-410)
  - All other messages (personas): `bg-card border` (L411)
- **CRITICAL FINDING:** All persona messages use identical `bg-card border` styling regardless of sender

**Evidence:**
```typescript
<div
  className={`inline-block p-3 rounded-lg text-sm ${
    isUser
      ? 'bg-primary text-primary-foreground'
      : isIntervention
        ? 'bg-secondary border'
        : 'bg-card border'  // <-- All persona messages look the same
  }`}
>
  {msg.content}
</div>
```

**Avatar Usage (Current):**
- Avatars DO use persona colors (L383-386)
- Avatar background color: `style={{ backgroundColor: isUser ? 'var(--muted-foreground)' : persona?.color }}`

**Relevant to PRD:**
- FR-2 (Accent Application) - Not implemented; all persona bubbles identical
- FR-3 (Accent Style Specification) - Not implemented; no border/tint applied
- FR-6 (Message Bubble Component Update) - Component is inline, not separate file
- NFR-2 (Accessibility) - Text colors use semantic tokens (text-primary-foreground, text-foreground)

---

### 3. Session Personas Data Flow

**File:** `stores/sessions.ts`  
**Lines:** L100-L134 (loadSession)  
**Status:** Clean

- Session personas loaded via `window.electronDB.getSessionPersonas(id)`
- `sessionPersonas` array stored in Zustand state includes full Persona data + `isOrchestrator` flag
- Persona color available in session view via `sessionPersonas.find(p => p.id === msg.personaId)`

**Evidence:**
```typescript
const personasResult = await window.electronDB.getSessionPersonas(id);
set({
  sessionPersonas: (personasResult.data as SessionPersona[]) || [],
});
```

**Relevant to PRD:**
- FR-7 (Database Integration) - Persona color already available in session view
- FR-6 (Message Bubble Component) - Can access `persona.color` when rendering messages

---

**File:** `electron/lib/queries.ts`  
**Lines:** L449-L468 (getSessionPersonas)  
**Status:** Clean

- SQL query joins `personas` and `session_personas` tables
- Returns full Persona object including `color` field

**Evidence:**
```typescript
export async function getSessionPersonas(sessionId: string): Promise<SessionPersona[]> {
  return getAll<SessionPersona>(`
    SELECT
      p.id, p.name, p.role, ..., p.color, ...
    FROM personas p
    JOIN session_personas sp ON p.id = sp.persona_id
    WHERE sp.session_id = ?
  `, [sessionId]);
}
```

**Relevant to PRD:**
- FR-7 - Color data already fetched via existing join

---

### 4. Message Data Structure

**File:** `lib/types.ts`  
**Lines:** L48-L57  
**Status:** Clean

- Message interface includes `personaId: string | null`
- When `personaId` is `null`, it's a user message
- When `personaId` has value, it's a persona message
- **Message does NOT include color directly** - must look up via persona

**Evidence:**
```typescript
export interface Message {
  id: string;
  sessionId: string;
  personaId: string | null;  // <-- null for user, string for persona
  content: string;
  turnNumber: number;
  tokenCount: number;
  metadata: MessageMetadata | null;
  createdAt: string;
}
```

**Relevant to PRD:**
- FR-2 (Accent Application) - Can differentiate persona vs user messages via `personaId`
- FR-7 (Database Integration) - No schema changes needed; color comes from personas table

---

### 5. Color Utility Functions

**Finding:** No color utility file exists

**File:** `lib/colors.ts`  
**Status:** Does not exist

**Relevant to PRD:**
- FR-5 (Color Utility Functions) - Not implemented; must create new file
- Functions needed:
  - `calculateAccentColor(baseColor: string): string`
  - `adjustLuminance(color: string, percent: number): string`
  - `getLuminance(color: string): number`
  - `hexToHSL(color: string): { h: number, s: number, l: number }`
  - `hslToHex(h: number, s: number, l: number): string`

---

### 6. Message Query (No Join with Personas)

**File:** `electron/lib/queries.ts`  
**Lines:** L388-L408 (getMessagesBySession)  
**Status:** Clean

- Current query fetches messages WITHOUT joining personas table
- Returns raw Message data without persona color

**Evidence:**
```typescript
export async function getMessagesBySession(sessionId: string): Promise<Message[]> {
  const rows = await getAll<any>(`
    SELECT 
      id, session_id as sessionId, persona_id as personaId, content, ...
    FROM messages
    WHERE session_id = ?
    ORDER BY turn_number ASC, created_at ASC
  `, [sessionId]);
```

**Relevant to PRD:**
- FR-7 (Database Integration) - Query does NOT currently join personas table
- **Contradiction with PRD:** PRD states "No additional database calls required (join in existing query)" but current query doesn't join
- **Options:** 
  1. Modify `getMessagesBySession` to LEFT JOIN personas (may affect other callers)
  2. Keep separate query and do lookup in session store (current pattern already does this via `sessionPersonas` array)
  3. Create new query specifically for session view that includes color

**Recommendation:** Current architecture already loads `sessionPersonas` separately, which includes color. No database change needed - just use existing `sessionPersonas` lookup when rendering.

---

## Confidence Table

| PRD Requirement | Score | Notes |
|----------------|-------|-------|
| FR-1: Programmatic Accent Color Calculation | 0% | No color utilities exist; must create lib/colors.ts |
| FR-2: Accent Application to Message Bubbles | 0% | All persona messages use identical bg-card styling |
| FR-3: Accent Style Specification | 0% | No left border or background tint implemented |
| FR-4: Edge Case Color Handling | 0% | No luminance calculation or fallback logic exists |
| FR-5: Color Utility Functions | 0% | lib/colors.ts does not exist |
| FR-6: Message Bubble Component Update | 0% | Component is inline (app/session/page.tsx:L405-L415), not separate file |
| FR-7: Database Integration | 95% | Color available via sessionPersonas; message query doesn't join but doesn't need to |
| NFR-1: Performance | N/A | Color calculations don't exist yet |
| NFR-2: Accessibility | 80% | Uses semantic color tokens; needs verification with accent colors |
| NFR-3: Maintainability | 50% | Code is inline, not componentized; color utils not yet created |

---

## Dirty State Warnings

**None.** All files referenced in this research are in a **Clean** state matching the git hash `21027ca481e893afea59659e30caa74141548e46`.

The following files have uncommitted changes but are NOT relevant to this feature:
- AGENTS.md
- requirements.md
- .agents/ (new directory)
- IMPLEMENTATION_REPORT.md (new file)
- context-plan.md (new file)
- council@0.1.0 (new file)
- features/ (new directory - contains this PRD)
- lsof (new file)
- npm (new file)

---

## Key Findings Summary

### What's Working (Foundation)
1. ✅ Personas have a `color` field (hex string) stored in database
2. ✅ Color selector exists in persona editor (9 predefined colors)
3. ✅ Persona colors display on avatars in session view
4. ✅ Session personas loaded with color data via `sessionPersonas` array
5. ✅ Can differentiate user vs persona messages via `personaId`

### What's Missing (To Implement)
1. ❌ No color utility functions (lib/colors.ts)
2. ❌ No accent calculation from base color
3. ❌ No left border accent on message bubbles
4. ❌ No background tint on message bubbles
5. ❌ All persona messages have identical styling (`bg-card border`)
6. ❌ No edge case handling for very light/dark colors
7. ❌ Message bubble rendering is inline, not a separate component

### Architecture Notes
- Message bubbles are rendered inline in `app/session/page.tsx` (lines 405-415)
- No `components/chat/MessageBubble.tsx` component exists (PRD assumes it does)
- Color is available when rendering: `persona?.color` via lookup from `sessionPersonas`
- Current message query doesn't need modification - color lookup happens via existing `sessionPersonas` state
