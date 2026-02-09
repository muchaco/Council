# Plan: Message Bubble Color Accents

**Feature:** message-bubble-color-accents  
**Date:** 2026-02-07  
**Based on:** PRD.md and RESEARCH.md

---

## Architecture

This feature follows the **Functional Core, Imperative Shell** pattern from AGENTS.md:

### Functional Core (`lib/colors.ts`)
- Pure color manipulation functions with no side effects
- Deterministic output for same input (testable without mocks)
- All business logic for accent calculation contained here

### Imperative Shell
- **MessageBubble component**: Receives accent color prop, applies styling (thin presentation layer)
- **app/session/page.tsx**: Looks up persona color from sessionPersonas state, passes to MessageBubble

### Component Separation
- Extract inline JSX from `app/session/page.tsx:L405-L415` to new `components/chat/MessageBubble.tsx`
- Component accepts optional `accentColor` prop for persona messages
- Keeps user/orchestrator messages neutral (no accentColor prop)

---

## Implementation Strategy

### 1. Color Utility Functions (lib/colors.ts)

**Create new file** `lib/colors.ts` with pure functions:

```typescript
// Core color utilities (Functional Core)
- hexToHSL(hex: string): { h: number, s: number, l: number }
- hslToHex(h: number, s: number, l: number): string
- getLuminance(hex: string): number
- blendWithGray(hex: string, ratio: number): string  // For edge cases
- calculateAccentColor(baseColor: string): { border: string, background: string }
```

**Algorithm for `calculateAccentColor`** (based on user feedback):
1. Check luminance of base color
2. If luminance > 0.9 (very light): Blend base color 50% toward #6B7280
3. If luminance < 0.1 (very dark): Blend base color 50% toward #6B7280  
4. Otherwise: Use base color as-is
5. Return:
   - `border`: Solid color (hex)
   - `background`: Same color with 8% opacity for background tint

### 2. MessageBubble Component (components/chat/MessageBubble.tsx)

**Extract** from `app/session/page.tsx:L405-L415` into new component:

```typescript
interface MessageBubbleProps {
  content: string;
  senderName: string;
  timestamp: string;
  isUser: boolean;
  isOrchestrator: boolean;
  accentColor?: string;  // Persona color - undefined for user/orchestrator
}
```

**Styling logic**:
- If `accentColor` provided: Apply left border (3-4px) with accent color, background with 8% opacity tint
- If no `accentColor`: Use existing `bg-card border` styling (neutral)
- User messages: Keep `bg-primary text-primary-foreground` (no change)
- Intervention/orchestrator: Keep `bg-secondary border` (no change)

### 3. Session Page Integration (app/session/page.tsx)

**Modify** message rendering section (around L405-L415):

```typescript
// Look up persona color from sessionPersonas
const persona = msg.personaId 
  ? sessionPersonas.find(p => p.id === msg.personaId)
  : null;

// Render with MessageBubble component
<MessageBubble
  content={msg.content}
  senderName={...}
  timestamp={...}
  isUser={isUser}
  isOrchestrator={isOrchestrator}
  accentColor={persona?.color}  // Undefined for user/orchestrator
/>
```

**No database changes needed** - persona color already available via `sessionPersonas` array (loaded via `getSessionPersonas` query which joins personas table).

### 4. TypeScript Types

**Update** `lib/types.ts` if needed:
- No changes required to existing types
- Export color utility types from `lib/colors.ts`:
  ```typescript
  export interface AccentColors {
    border: string;
    background: string;
  }
  ```

---

## Execution Phases

### Phase 1: Color Utilities + Tests
**Goal:** Create functional core with comprehensive test coverage

**Tasks:**
1. Create `lib/colors.ts` with all color utility functions
2. Implement `hexToHSL` and `hslToHex` conversions
3. Implement `getLuminance` calculation
4. Implement `blendWithGray` for edge case handling
5. Implement `calculateAccentColor` with alpha transparency approach

**Tests (Unit):**
- `hexToHSL` and `hslToHex` round-trip accuracy
- `getLuminance` for known colors (white=1, black=0, red=0.21, etc.)
- `blendWithGray` produces expected mixed colors
- `calculateAccentColor` returns valid hex strings
- Edge cases: #FFFFFF, #000000, #808080, and all 9 predefined persona colors
- Verify border is solid color, background includes alpha

**Deliverables:**
- `lib/colors.ts` with all functions
- `lib/colors.test.ts` with comprehensive unit tests
- All tests passing

### Phase 2: MessageBubble Component
**Goal:** Extract and enhance message bubble with accent support

**Tasks:**
1. Create `components/chat/MessageBubble.tsx`
2. Extract inline JSX from `app/session/page.tsx:L405-L415`
3. Add `accentColor` prop to component interface
4. Implement styling logic:
   - Left border: 3px solid accent color
   - Background: accent color with 8% opacity (using CSS rgba)
5. Ensure neutral styling when `accentColor` is undefined
6. Preserve all existing functionality (timestamps, sender names, etc.)

**Tests (Integration):**
- Component renders without errors
- Component applies accent styling when accentColor provided
- Component uses neutral styling when accentColor undefined
- User messages maintain bg-primary styling
- Intervention messages maintain bg-secondary styling
- Visual regression: Compare rendered output with/without accent

**Deliverables:**
- `components/chat/MessageBubble.tsx` component
- Updated imports in `app/session/page.tsx`
- Storybook or manual test page showing all persona colors (optional)

### Phase 3: Session Page Integration
**Goal:** Wire up accent colors to actual messages

**Tasks:**
1. Import MessageBubble component in `app/session/page.tsx`
2. Modify message mapping to look up persona color from sessionPersonas
3. Pass accentColor prop to MessageBubble for persona messages
4. Verify user/orchestrator messages don't receive accentColor
5. Test with actual chat session

**Tests (E2E/Integration):**
- Load session with multiple personas
- Verify each persona's messages display correct accent color
- Verify user messages remain neutral
- Verify orchestrator messages remain neutral
- Test edge case persona colors (if any set to white/black)
- Accessibility check: Contrast ratios meet WCAG AA

**Deliverables:**
- Updated `app/session/page.tsx`
- Working accent colors in chat interface
- No visual regressions in existing functionality

---

## Wiggle Room

The following implementation details are left to the coding phase:

- **Exact opacity percentage**: PRD suggests 5-10%, final value (8%) can be adjusted
- **Border width**: PRD suggests 3-4px, final value can be adjusted
- **Blend ratio for edge cases**: User suggested 50% blend, can be tuned
- **Component prop naming**: `accentColor` vs `personaColor` vs `color`
- **CSS implementation**: Inline styles vs Tailwind arbitrary values vs CSS-in-JS
- **Test framework choice**: Vitest, Jest, or other (project doesn't currently have tests)
- **File organization**: Whether to export from index files or direct imports

---

## Requirement Coverage Matrix

| Req ID | Description | Implementation Reference | Tests | Phase |
|--------|-------------|------------------------|-------|-------|
| FR-1 | Programmatic Accent Color Calculation | `lib/colors.ts:calculateAccentColor()` - uses alpha transparency on base color | Unit test: Valid hex output for various inputs; Consistency test: Same input → same output | 1 |
| FR-2 | Accent Application to Message Bubbles | `components/chat/MessageBubble.tsx` - conditional styling based on accentColor prop | Integration test: Accent applied when prop provided, neutral when undefined | 2 |
| FR-3 | Accent Style Specification | `MessageBubble` component: 3px left border (solid), 8% opacity background tint | Visual test: Border and tint both visible; CSS validation: rgba() values correct | 2 |
| FR-4 | Edge Case Color Handling | `lib/colors.ts:calculateAccentColor()` - blends toward gray for luminance < 0.1 or > 0.9 | Unit test: #FFFFFF → blended gray, #000000 → blended gray, mid-tones unchanged | 1 |
| FR-5 | Color Utility Functions | `lib/colors.ts` - hexToHSL, hslToHex, getLuminance, blendWithGray, calculateAccentColor | Unit tests: All functions with edge cases (white, black, gray, 9 predefined colors) | 1 |
| FR-6 | Message Bubble Component Update | `components/chat/MessageBubble.tsx` - new component with accentColor prop | Component test: Props interface correct; Rendering with/without accent | 2 |
| FR-7 | Database Integration | `app/session/page.tsx` - lookup persona color from sessionPersonas array (no DB change needed) | Integration test: Color correctly looked up from sessionPersonas; Graceful handling if persona not found | 3 |
| NFR-1 | Performance | Color calculation in functional core; No memoization needed (fast enough) | Performance test: calculateAccentColor completes in < 1ms per call | 1 |
| NFR-2 | Accessibility | Text uses semantic tokens (text-foreground, text-primary-foreground); Accent only on persona messages | Accessibility audit: Contrast ratios meet WCAG AA; Color not sole identification means | 3 |
| NFR-3 | Maintainability | Pure functions in lib/colors.ts; Typed exports; Well-documented | Code review: Functions are pure; Types exported; Documentation complete | 1 |

---

## Key Decisions

1. **No database changes**: Persona color already available via `sessionPersonas` state (join already exists in `getSessionPersonas` query)

2. **Alpha transparency approach**: For FR-1, using same base color with alpha for background tint (user preference), solid color for border

3. **Blend toward gray**: For FR-4 edge cases, blend original color 50% toward #6B7280 instead of hard fallback (user preference)

4. **Component extraction**: Extract inline JSX to separate MessageBubble component for reusability and testability (user preference)

5. **Functional core location**: All color utilities in `lib/colors.ts` following AGENTS.md pattern

---

## Verification Checklist

Before marking complete, verify:

- [x] All 7 FR requirements have test coverage
- [x] All 3 NFR requirements validated
- [x] No linting errors (`npm run lint`)
- [x] TypeScript compiles without errors (`npx tsc --noEmit`)
- [x] Unit tests pass (`npm test` or equivalent)
- [x] Visual verification: All 9 predefined persona colors display correctly
- [x] Visual verification: User/orchestrator messages remain neutral
- [x] Edge cases: White, black, and gray persona colors handled gracefully
- [x] No console errors or warnings
- [x] Responsive design intact (mobile/desktop)
- [x] Dark mode compatible (test both themes)
