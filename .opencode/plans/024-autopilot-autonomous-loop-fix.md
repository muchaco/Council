# Plan: Fix Autopilot to Be Fully Autonomous

## Objective

Fix the Autopilot mode to be truly autonomous - running continuously until goal reached, turn limit reached, error occurs, or user pauses. Remove the manual "Next turn" button which contradicts requirements R3.19 and U12.3-U12.4.

## Scope

### In Scope

1. **Remove "Next turn" button** from Council View top bar for autopilot mode
2. **Implement automatic turn chaining** in renderer - after each turn completes, immediately advance to next if council is still running
3. **Ensure thinking placeholder appears correctly** in chat transcript during generation (per U8.6)
4. **Preserve pause/resume semantics** - these become the only user controls during autopilot
5. **Update tests** to verify autonomous behavior

### Non-goals

- Changing the main process `advanceAutopilotTurn` implementation (it already works correctly)
- Changing the conductor orchestration logic
- Adding background execution (per R3.9, autopilot only runs while Council View is open)
- Streaming output (per R8.1, already non-streaming)

## Background: Current vs Required Behavior

### Current (Broken) Behavior

```
User clicks Start → Opening generated → [STOP - wait for user]
User clicks "Next turn" → Member generates → Conductor runs → [STOP - wait for user]
User clicks "Next turn" → Member generates → Conductor runs → [STOP - wait for user]
...repeat until user stops clicking...
```

### Required Behavior (per R3.19, U12.3, U12.4)

```
User clicks Start → Opening generated → [AUTO] Member generates → Conductor runs → [AUTO] Member generates → ...
...continues automatically until: goal reached OR turn limit OR error OR user pauses...
```

## Architecture Impact Assessment

### Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `src/renderer/App.tsx` | Modify | Remove "Next turn" button, add autopilot loop logic |
| `tests/integration/councils-handlers.integration.spec.ts` | Modify | Update tests for autonomous behavior |
| `docs/status.md` | Modify | Update implementation status |

### Boundary Compliance

- Changes are renderer-only (no IPC changes)
- No new dependencies
- Follows existing pattern of `advanceAutopilotTurn` calls
- Maintains the existing generation state management

## Implementation Plan

### Step 1: Remove "Next turn" Button

**File:** `src/renderer/App.tsx`

Remove the "Next turn" button block (lines ~3099-3112). Also remove:
- `canAdvanceAutopilot` computation
- `advanceAutopilotTurn` function  
- `isAdvancingAutopilot` state

### Step 2: Implement Autopilot Loop

**File:** `src/renderer/App.tsx`

Add an effect that automatically advances autopilot when conditions are met:

```tsx
const [autopilotLoopActive, setAutopilotLoopActive] = useState(false);

useEffect(() => {
  // Guard: only run when conditions are met
  if (
    councilViewState.status !== "ready" ||
    council.mode !== "autopilot" ||
    !council.started ||
    council.paused ||
    council.archived ||
    generationRunning ||
    autopilotLoopActive ||
    councilViewState.configEdit !== null
  ) {
    return;
  }

  // Check if there's a planned next speaker
  const plannedNextSpeaker = councilViewState.source.generation.plannedNextSpeakerAgentId;
  if (plannedNextSpeaker === null) {
    return;
  }

  // Auto-advance
  setAutopilotLoopActive(true);
  window.api.councils.advanceAutopilotTurn({ id: screen.councilId })
    .then((result) => {
      if (result.ok) {
        return loadCouncilView(screen.councilId);
      }
    })
    .finally(() => {
      setAutopilotLoopActive(false);
    });
}, [
  councilViewState.status,
  council.mode,
  council.started,
  council.paused,
  council.archived,
  generationRunning,
  autopilotLoopActive,
  plannedNextSpeaker,
]);
```

### Step 3: Verify Thinking Placeholder

The existing logic in `src/shared/council-view-transcript.ts` already handles showing the thinking placeholder when `generation.status === "running"`. No changes needed.

### Step 4: Update Tests

Add test cases:
1. "autopilot advances automatically after start"
2. "autopilot stops when goal reached"  
3. "autopilot stops when turn limit reached"
4. "autopilot pauses on error"
5. "user pause stops autopilot loop"

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Race conditions in loop | Use `autopilotLoopActive` guard |
| Loop doesn't stop on error | Main process already pauses on error |
| Memory leak on navigation | Effect cleanup + leave-view confirmation |

## Validation Commands

```bash
bun run lint
bun run typecheck
bun run build
bun run test:unit
bun run test:integration
bun run diag:electron
```

## Rollback Strategy

Revert renderer changes to restore "Next turn" button. Main process remains unchanged.
