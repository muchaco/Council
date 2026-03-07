# Plan 025: Top Tabs Restoration and OS Theme Sync

## Objective
Restore Home navigation to polished top tabs and wire the renderer to follow the OS light/dark theme automatically.

## Scope
- Replace the persistent Home sidebar with a full-width top-tab bar.
- Preserve current Home tab keyboard navigation and state retention.
- Keep the current Agents card-grid presentation.
- Apply automatic OS theme synchronization in the renderer.
- Update status/UX documentation to match the intended behavior.

## Non-goals
- No IPC or main-process contract changes.
- No changes to business rules for Agents, Councils, or Settings.
- No redesign of detail views beyond shell/theme adjustments needed for consistency.

## Architecture impact assessment
- Changes are confined to renderer shell/theme behavior in `src/renderer/App.tsx` and `src/renderer/styles.css`.
- Documentation updates are limited to `docs/ux-requirements.md` and `docs/status.md`.
- Boundary compliance remains unchanged: renderer stays UI-only and continues using preload APIs.

## Step-by-step implementation plan
1. Update UX/status docs to reflect the intended top-tab navigation, card-based Agents layout, and OS-theme-following behavior.
2. Replace the current `renderSidebar()` Home shell with a top-tab header component that preserves existing tab state and keyboard semantics.
3. Adjust shell/layout styles so the Home screen uses horizontal tabs without reintroducing the old weak visual treatment.
4. Add a renderer-side OS theme effect using `matchMedia("(prefers-color-scheme: dark)")` and apply the `dark` class to the root element.
5. Verify keyboard navigation, visual layout at desktop/mobile widths, and theme switching behavior.
6. Update `docs/status.md` and regenerate traceability metadata after the implementation is complete.

## Risks and mitigations
- Risk: top tabs look visually weaker than the current sidebar.
  - Mitigation: use full-width tab styling with clear active-state treatment and keep the current typography/spacing tokens.
- Risk: theme sync causes flicker or incorrect initial theme.
  - Mitigation: initialize theme state in an effect immediately on mount and set `color-scheme`-compatible root state.
- Risk: keyboard tab behavior regresses.
  - Mitigation: reuse existing `handleHomeTabKeyDown()` and tab refs.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| U1.1, U1.2, U1.3, U1.4 | `preserves top-tab keyboard navigation on Home` | Verify Home uses top tabs, preserves state, and keeps keyboard switching semantics |
| U4.1, U4.2, U4.3, U4.4 | `renders card-based agents home layout` | Keep current card-grid behavior as intended UX |
| U0.4 | `applies OS color scheme to renderer shell` | Verify renderer follows OS theme preference |

## Validation commands to run
- `bun run lint`
- `bun run typecheck`
- `bun run build`

## Rollback strategy
- Revert the renderer shell/theme changes in `src/renderer/App.tsx` and `src/renderer/styles.css`.
- Revert the associated doc updates if the visual direction changes again.
