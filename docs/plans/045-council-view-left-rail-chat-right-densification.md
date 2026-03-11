# Plan 045: Council View Left Rail, Chat Right, and Densification

## Objective
Refactor Council View so the chat/transcript remains persistently visible in the right panel, move the Overview and Config tabs into a compact left utility rail, and tighten the overall screen density without changing runtime or IPC behavior.

## Scope
- Recompose the Council View renderer so the transcript/composer stays visible while the left panel switches between `Overview` and `Config`.
- Preserve the existing runtime actions, config editing mechanics, member management rules, and transcript behavior.
- Make the Council View visually denser by reducing padding, gaps, and oversized headings in the Council View surface.
- Update diagnostics, status tracking, and UX requirements to reflect the new layout contract.

## Non-goals
- No change to main-process runtime orchestration, council state rules, or IPC contracts.
- No change to transcript message semantics, manual-mode speaker logic, or archived/invalid-config enforcement.
- No global renderer spacing overhaul outside the Council View surface.

## Architecture impact assessment
- This is a renderer-focused refactor centered in `src/renderer/components/council-view/*` and Council View-specific styling in `src/renderer/styles.css`.
- Dependency boundaries remain intact because all data continues to flow through preload-backed `window.api` methods; no service or provider logic moves into the renderer.
- Existing Council View hooks and derived-state modules remain the source of truth for runtime/config/member behavior, minimizing behavior drift while changing composition.

## Step-by-step implementation plan
1. Create a left-rail Council View composition in `CouncilViewReadyScreen` that keeps the chat pane always mounted on the right.
2. Replace the top-level `Discussion`/`Config` switch with left-rail `Overview`/`Config` tabs.
3. Split the current discussion composition into reusable chat and overview sections so `BriefingCard` and `MembersCard` can live in the left rail while `TranscriptCard` and `ConductorComposerCard` stay on the right.
4. Tighten Council View spacing, card padding, and heading scales to achieve a denser layout while preserving mobile usability.
5. Update Council View diagnostics/tests that rely on the previous panel/tab structure.
6. Update `docs/ux-requirements.md` and `docs/status.md`, regenerate traceability artifacts, and run the required validation commands.

## Risks and mitigations
- Risk: moving tabs from the top-level view to the left rail breaks diagnostics and accessibility selectors.
  - Mitigation: keep stable tab roles/IDs where practical and update Electron scenarios immediately after the layout refactor.
- Risk: compacting the layout harms readability on narrow windows.
  - Mitigation: scope density changes to desktop-first Council View classes and preserve single-column behavior under existing responsive breakpoints.
- Risk: config editing interactions regress when config is no longer a full-screen replacement panel.
  - Mitigation: keep `ConfigTab` editing state and handlers intact, then adapt only container layout and spacing around it.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| R3.2, R3.3, U0.1, U8.1, U8.3, U8.9, U8.10 | `council-view transcript remains visible while switching left rail tabs` | Verify the Council View keeps the transcript/chat visible as the left rail swaps between Overview and Config |
| U9.1, U9.3, U9.7, U9.8, U13.1 | `council-view left rail overview renders briefing and members actions` | Verify the left Overview tab contains briefing, member actions, add-member flow, and manual-mode speaker controls |
| U10.1, U10.4, U10.8 | `council-view left rail config preserves inline edit behavior` | Verify Config still supports pencil-only entry, inline save/cancel rules, and discard-confirm behavior inside the left rail |
| U0.1, U0.2 | `council-view-right-panel scenario covers left rail layout` | Verify the compact left-rail/right-chat layout remains usable in diagnostics without hiding the transcript |

## Validation commands to run
- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test:unit`
- `bun run trace:generate`
- `bun run check:traceability`
- `bun run diag:electron`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/council-view-right-panel.json`

## Rollback strategy
- Revert the Council View renderer, style, diagnostic, and documentation deltas from this plan if the left-rail composition proves less usable than the previous layout.
