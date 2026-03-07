# Plan 024: Visual Consistency and Modernization

## Objective
Address visual inconsistencies across the application and modernize UI components for a polished, cohesive user experience.

## Scope
- Settings page: inconsistent component usage and redundant information
- Chat window: auto-scroll behavior
- Agent vs Council cards: visual inconsistency
- Tag editors: inconsistent patterns

## Non-Goals
- No changes to business logic or state management
- No IPC contract changes
- No new features

## Architecture Impact
- Changes confined to `src/renderer/App.tsx` and `src/renderer/styles.css`
- May require extracting reusable components

---

## Issues Identified

### 1. Settings Page Issues

**Location:** `src/renderer/App.tsx:5354-5387`

#### 1.1 Raw Text Without Components
- "Model Catalog" section uses `<p className="meta">` for snapshot ID
- "Context Window" section uses `<p className="meta">` for explanation text
- These should use proper typography components (Label, Muted text)

**Current:**
```tsx
<p className="meta">Snapshot ID: {settingsViewState.data.modelCatalog.snapshotId}</p>
<p className="meta">Runtime prompts include briefing + last N transcript messages.</p>
```

**Should be:**
```tsx
<p className="text-sm text-muted-foreground">Snapshot ID: {settingsViewState.data.modelCatalog.snapshotId}</p>
<p className="text-sm text-muted-foreground">Runtime prompts include briefing + last N transcript messages.</p>
```

#### 1.2 Redundant Information
- "Credential in keychain: Saved/Not saved" shown separately at line 5271-5273
- Provider configured status is already shown in Badge at top
- This information is redundant and clutters the UI

#### 1.3 Inconsistent Component Usage
- "Global Default Model" uses native `<select>` instead of shadcn Select component
- "Context Window" uses native `<input>` instead of shadcn Input component
- Settings sections use `<section className="settings-section">` instead of Card

---

### 2. Chat Window Auto-Scroll

**Location:** `src/renderer/App.tsx:3300-3400`

**Issue:** Transcript messages don't auto-scroll to bottom when new messages arrive.

**Fix Applied:**
- Added `chatEndRef` reference at end of transcript container
- Added useEffect to scroll to bottom when councilViewState changes

**Status:** ✅ FIXED

---

### 3. Agent Cards vs Council Cards Inconsistency

**Locations:**
- Agent cards: `src/renderer/App.tsx:5043-5083`
- Council cards: `src/renderer/App.tsx:4815-4898`

#### 3.1 Card Structure
**Agent cards** use custom CSS classes:
- `agent-card`, `agent-card-header`, `agent-card-title`
- `agent-card-prompt`, `agent-card-stats`, `agent-card-tags`
- `agent-tag`, `agent-tag-more`

**Council cards** use shadcn/ui components:
- `Card`, `CardHeader`, `CardTitle`, `CardContent`
- `Badge` for tags

#### 3.2 Visual Inconsistencies
| Element | Agent Card | Council Card |
|---------|-----------|--------------|
| Container | `<article className="agent-card">` | `<Card>` |
| Title | `<h3 className="agent-card-title">` | `<CardTitle>` |
| Tags | `<span className="agent-tag">` | `<Badge>` |
| Badges | Custom `council-badge-error` | `<Badge variant="destructive">` |

#### 3.3 Recommended Fix
Convert agent cards to use shadcn/ui Card components for consistency:
```tsx
<Card key={agent.id}>
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle>{agent.name}</CardTitle>
      {agent.invalidConfig && <Badge variant="destructive">Invalid config</Badge>}
    </div>
  </CardHeader>
  <CardContent className="space-y-4">
    <p className="text-sm text-muted-foreground line-clamp-3">{agent.systemPrompt}</p>
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Model:</span>
      <span>{modelLabel(agent, agentsGlobalDefaultModel)}</span>
    </div>
    {agent.tags.length > 0 && (
      <div className="flex flex-wrap gap-1">
        {agent.tags.slice(0, 3).map(tag => (
          <Badge key={tag} variant="secondary">{tag}</Badge>
        ))}
      </div>
    )}
  </CardContent>
</Card>
```

---

### 4. Tag Editor Inconsistency

**Locations:**
- Agent editor: `src/renderer/App.tsx:4612-4614` (comma-separated textarea)
- Council editor: `src/renderer/App.tsx:4340-4342` (comma-separated textarea)
- Council config view: `src/renderer/App.tsx:3760-3813` (chip editor with Badge + Input)

#### 4.1 Current Patterns
**Editor Forms:** Plain textarea with comma-separated values
- Users type tags like "tag1, tag2, tag3"
- No visual feedback, no chip display

**Config View:** Rich chip editor
- Tags displayed as Badge chips with remove button
- Input field + Add button for new tags
- Max tags validation feedback

#### 4.2 Recommended Fix
Create a reusable `TagEditor` component and use it consistently:
1. Editor forms should also show tags as chips
2. Both patterns should use same Badge styling
3. Same keyboard interactions (Enter to add, Backspace to remove)

---

## Implementation Plan

### Step 1: Fix Settings Page Text Components
- Replace `className="meta"` with `className="text-sm text-muted-foreground"`
- Ensure all meta text uses consistent styling

### Step 2: Remove Redundant Settings Information
- Remove "Credential in keychain" line from provider cards
- Status is already shown in the Badge

### Step 3: Standardize Settings Sections (Optional Enhancement)
- Convert settings sections to use Card components
- Replace native `<select>` with shadcn Select
- Replace native `<input>` with shadcn Input (already done for most)

### Step 4: Unify Agent Cards
- Convert agent cards to use Card/CardHeader/CardContent
- Replace `agent-tag` with Badge component
- Match the styling of council cards

### Step 5: Create Reusable TagEditor Component
- Extract the chip editor pattern from council config view
- Use in agent editor and council editor
- Ensure consistent Badge styling and keyboard interactions

---

## Coverage Matrix

| Issue | Test Case | Validation |
|-------|-----------|------------|
| Settings meta text | Visual inspection | Consistent muted text styling |
| Redundant info removed | Visual inspection | No duplicate credential status |
| Agent cards unified | Visual inspection | Same Card component as councils |
| Tag editors consistent | Keyboard interaction | Chip display in all editors |

## Validation Commands
```bash
bun run typecheck
bun run lint
bun run dev:renderer  # Visual validation
bun run diag:electron -- --scenario scripts/diagnostics/scenarios/settings-smoke.json
```

## Risks and Mitigations
| Risk | Mitigation |
|------|-----------|
| Breaking existing styles | Test each section after changes |
| Missing CSS classes after refactor | Check for unused CSS, remove safely |
| Inconsistent Badge variants | Standardize on secondary/default/destructive |

## Rollback Strategy
- Git commit after each step
- Keep original CSS classes until verified unused
- Can revert individual commits if issues found
