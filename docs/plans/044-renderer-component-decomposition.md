# Plan 044: Renderer Component Decomposition

## Objective
Decompose the renderer from a monolithic `src/renderer/App.tsx` into screen-level containers and smaller presentational components so state is owned by the narrowest safe scope without changing behavior, IPC contracts, styling output, or UX semantics.

## Scope
- Keep `src/renderer/App.tsx` as a lightweight screen switcher and top-level navigation owner.
- Extract home, settings, agent editor, council editor, and council view into dedicated screen/container components.
- Extract reusable presentational pieces for toolbars, cards, menus, transcript rows, briefing, members, config editing, and model selection where the split improves local reasoning.
- Move transient UI state downward where safe (for example menus, add-member search, conductor composer text, transcript refs, inline config edit buffers, and autopilot modal form state).
- Preserve all existing behavior, layout, routing, styling, keyboard semantics, IPC calls, toast copy, local state semantics, and requirement traceability.
- Add focused tests only where extracted pure helpers or newly isolated behavior materially benefit from direct coverage.
- Update `docs/status.md` and regenerate traceability output after implementation.

## Non-goals
- No product/UX redesign.
- No API, IPC DTO, preload bridge, request payload, query param, analytics, or storage-key changes.
- No new libraries or state-management frameworks.
- No speculative generic abstraction that collapses distinct councils/agents/settings behavior into one oversized reusable system.
- No behavior changes to the autopilot loop, leave-view guard, provider flows, or config-edit gating.

## Architecture impact assessment
- Renderer-only refactor centered on `src/renderer/App.tsx` and new files under `src/renderer/components/`.
- Existing architecture boundaries remain intact: renderer continues using preload IPC only, with no direct service/provider access.
- State ownership becomes more explicit:
  - `App` owns only screen routing and home-tab return behavior.
  - screen containers own screen-specific async/draft state.
  - leaf components own only ephemeral UI state needed for their subtree.
- Shared behavior extracted into pure helpers or narrow reusable components must stay renderer-safe and dependency-light.

## Step-by-step implementation plan
1. Create the plan-aligned target file structure under existing renderer conventions:
   - `src/renderer/components/navigation/`
   - `src/renderer/components/home/`
   - `src/renderer/components/settings/`
   - `src/renderer/components/agents/`
   - `src/renderer/components/councils/`
   - `src/renderer/components/council-view/`
   - `src/renderer/components/shared/`
2. Extract low-risk, presentation-first components from `src/renderer/App.tsx` without moving business logic yet:
   - `HomeTopBar.tsx`
   - `CouncilCard.tsx`
   - `CouncilCardMenu.tsx`
   - `AgentCard.tsx`
   - `AgentCardMenu.tsx`
   - `TranscriptMessageRow.tsx`
   - `ThinkingMessageRow.tsx`
   - `BriefingCard.tsx`
3. Extract shared leaf primitives where repeated behavior is already obvious and low risk:
   - `ModelSelectField.tsx` for editor-style model selection + refresh + invalid/unavailable handling.
   - optional `DetailScreenShell.tsx` only if loading/error/back shells remain duplicated after screen extraction.
4. Split home rendering into `HomeScreen.tsx` and three panel components while keeping behavior intact:
   - `CouncilsPanel.tsx`
   - `AgentsPanel.tsx`
   - `SettingsPanel.tsx`
5. Move home-owned state from `App` into the relevant panel/container components:
   - councils list query/data/loading/delete/export state -> `CouncilsPanel.tsx`
   - agents list query/data/loading/delete/archive state -> `AgentsPanel.tsx`
   - settings/provider draft/accordion/general settings state -> `SettingsPanel.tsx`
   - keep only `homeTab` and return-tab behavior in `App`.
6. Extract `AgentEditorScreen.tsx` and move the full `agentEditorState` plus its async handlers out of `App`.
7. Extract `CouncilEditorScreen.tsx` and move the full `councilEditorState` plus its async handlers out of `App`.
8. Extract `CouncilViewScreen.tsx` and move the full `councilViewState`, runtime actions, leave flow, and autopilot loop out of `App` while preserving current sequencing exactly.
9. Within `CouncilViewScreen.tsx`, split the view into narrower components:
   - `CouncilViewHeader.tsx`
   - `CouncilViewTabs.tsx`
   - `CouncilRuntimeAlerts.tsx`
   - `DiscussionTab.tsx`
   - `ConfigTab.tsx`
   - `AutopilotLimitDialog.tsx`
10. Push ephemeral subtree state downward where safe after screen extraction is stable:
   - conductor draft -> `ConductorComposerCard.tsx`
   - transcript refs/focus handling -> `TranscriptCard.tsx`
   - add-member panel open/search + local dialog state -> `MembersCard.tsx` / `AddMemberPanel.tsx`
   - inline config editing buffers and discard dialog -> `ConfigTab.tsx`
   - autopilot dialog form state -> `AutopilotLimitDialog.tsx`
11. Add/update tests only for extracted pure helpers or newly isolated behaviors where direct coverage adds real value; avoid redundant tests for pure JSX reshuffling.
12. Run validation after each major phase, then update `docs/status.md`, regenerate traceability, and run the full required validation command set.

## Implementation progress

### Completed in current implementation
- `src/renderer/App.tsx` now acts as a lightweight top-level screen switcher with home-tab ownership and return-to-last-home-tab behavior.
- Screen containers are extracted and own their screen-specific state:
  - `src/renderer/components/home/HomeScreen.tsx`
  - `src/renderer/components/settings/SettingsPanel.tsx`
  - `src/renderer/components/agents/AgentEditorScreen.tsx`
  - `src/renderer/components/councils/CouncilEditorScreen.tsx`
  - `src/renderer/components/council-view/CouncilViewScreen.tsx`
- Low-risk presentational/shared pieces already extracted:
  - `src/renderer/components/navigation/HomeTopBar.tsx`
  - `src/renderer/components/councils/CouncilCard.tsx`
  - `src/renderer/components/councils/CouncilCardMenu.tsx`
  - `src/renderer/components/agents/AgentCard.tsx`
  - `src/renderer/components/agents/AgentCardMenu.tsx`
  - `src/renderer/components/shared/ModelSelectField.tsx`
  - `src/renderer/components/shared/HomeListToolbar.tsx`
  - `src/renderer/components/shared/EditableConfigFieldRow.tsx`
  - `src/renderer/components/shared/TagsEditor.tsx`
  - `src/renderer/components/shared/DetailScreenShell.tsx`
  - home panel wrappers `src/renderer/components/home/CouncilsPanel.tsx` and `src/renderer/components/home/AgentsPanel.tsx`
  - home list ownership moved into the panel containers so `CouncilsPanel.tsx` and `AgentsPanel.tsx` now own their own query/filter/pagination/list-action state while `HomeScreen.tsx` only coordinates visible tab selection
- Council View leaf extraction is in progress and now includes:
  - `src/renderer/components/council-view/CouncilViewHeader.tsx`
  - `src/renderer/components/council-view/CouncilViewTabs.tsx`
  - `src/renderer/components/council-view/CouncilRuntimeAlerts.tsx`
  - `src/renderer/components/council-view/DiscussionTab.tsx`
  - `src/renderer/components/council-view/ConfigTab.tsx`
  - `src/renderer/components/council-view/TranscriptCard.tsx`
  - `src/renderer/components/council-view/AutopilotLimitDialog.tsx`
  - `src/renderer/components/council-view/TranscriptMessageRow.tsx`
  - `src/renderer/components/council-view/ThinkingMessageRow.tsx`
  - `src/renderer/components/council-view/BriefingCard.tsx`
  - `src/renderer/components/council-view/ConductorComposerCard.tsx`
  - `src/renderer/components/council-view/MembersCard.tsx`
  - `src/renderer/components/council-view/AddMemberPanel.tsx`
- Required validation/traceability/status updates were run and refreshed for the behavior-preserving decomposition pass.

### Still left to implement
- Optional cleanup still available if repetition becomes clearer after the council-view cuts:
- `src/renderer/components/council-view/CouncilViewScreen.tsx` remains the main remaining oversized renderer screen and is the best target for the next behavior-preserving decomposition slice.
- Focused direct tests remain optional follow-up only if any new pure helpers are extracted from the remaining council-view work.
- If the final renderer-only cleanup is split further, keep commits behavior-preserving and continue using the existing validation/traceability/status refresh workflow after each slice.

## Proposed component ownership model

### App-level ownership
- `src/renderer/App.tsx`
  - owns: `screen`, `homeTab`, return-to-last-home-tab tracking
  - delegates: all screen-specific async/draft/runtime state

### Home surface
- `src/renderer/components/home/HomeScreen.tsx`
  - orchestrates visible panel selection
- `src/renderer/components/home/CouncilsPanel.tsx`
  - owns councils list filters, pagination, load state, delete/export/archive flows
- `src/renderer/components/home/AgentsPanel.tsx`
  - owns agents list filters, pagination, load state, delete/archive flows
- `src/renderer/components/settings/SettingsPanel.tsx`
  - owns settings view state, provider drafts, accordion state, global-default selection, context-window input

### Editor surfaces
- `src/renderer/components/agents/AgentEditorScreen.tsx`
  - owns `agentEditorState` and all related commands
- `src/renderer/components/councils/CouncilEditorScreen.tsx`
  - owns `councilEditorState` and all related commands

### Council View surface
- `src/renderer/components/council-view/CouncilViewScreen.tsx`
  - owns `councilViewState`, runtime IPC actions, leave guard, autopilot loop
- local state moved downward after safe extraction:
  - transcript refs -> `TranscriptCard.tsx`
  - conductor input -> `ConductorComposerCard.tsx`
  - add-member panel/search -> `MembersCard.tsx` or `AddMemberPanel.tsx`
  - config edit buffers -> `ConfigTab.tsx`
  - autopilot modal form state -> `AutopilotLimitDialog.tsx`

## Suggested extraction order by risk

### Phase 1: Low-risk presentational cuts
- `HomeTopBar.tsx`
- `CouncilCard.tsx`
- `CouncilCardMenu.tsx`
- `AgentCard.tsx`
- `AgentCardMenu.tsx`
- `TranscriptMessageRow.tsx`
- `ThinkingMessageRow.tsx`
- `BriefingCard.tsx`

### Phase 2: Screen-container extraction
- `HomeScreen.tsx`
- `CouncilsPanel.tsx`
- `AgentsPanel.tsx`
- `SettingsPanel.tsx`
- `AgentEditorScreen.tsx`
- `CouncilEditorScreen.tsx`
- `CouncilViewScreen.tsx`

### Phase 3: Scoped local-state extraction
- `ConductorComposerCard.tsx`
- `TranscriptCard.tsx`
- `MembersCard.tsx`
- `AddMemberPanel.tsx`
- `ConfigTab.tsx`
- `AutopilotLimitDialog.tsx`

### Phase 4: Shared-field cleanup
- `ModelSelectField.tsx`
- optional `HomeListToolbar.tsx`
- optional `EditableConfigFieldRow.tsx`
- optional `TagsEditor.tsx`

## Risks and mitigations
- Risk: screen extraction changes event ordering or stale-closure behavior in async handlers.
  - Mitigation: move code in thin slices, preserve call order, and validate after each major extraction.
- Risk: autopilot loop behavior changes because hook dependencies or refs move.
  - Mitigation: defer internal autopilot refactors until `CouncilViewScreen.tsx` is stable; preserve existing effect semantics first.
- Risk: config-edit state currently blocks header/tab actions across the whole council view.
  - Mitigation: keep config-edit state in `CouncilViewScreen.tsx` during first extraction, then optionally push it into `ConfigTab.tsx` with an explicit `isEditing`/`onEditingChange` contract.
- Risk: `details`-based card menus rely on document-level outside-click behavior.
  - Mitigation: extract menu markup first without changing interaction model; only localize menu state later if behavior remains identical.
- Risk: too much generic reuse makes the result harder to follow.
  - Mitigation: prefer feature-specific components first; only extract shared components after repetition is proven.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| U1.1, U1.2, U1.3, U1.4, U1.5, U1.6, U1.7, U1.8 | `home navigation preserves tab behavior after screen extraction` | Verify top-level screen switching and return-to-tab behavior stay intact after `App` becomes a switcher |
| U3.1, U3.2, U3.3, U3.4, U4.1, U4.2, U4.3, U4.4 | `home panels keep list filters, menus, and card-open behavior after extraction` | Verify councils/agents list UX remains identical after `HomeScreen` decomposition |
| U5.1, U5.2, U5.3, U5.4, U5.5, U5.6, U5.7, U5.8, U5.9, U5.10, U5.11, U5.12 | `settings panel preserves provider draft and general settings behavior after extraction` | Verify settings decomposition preserves provider test/save/disconnect and general settings flows |
| U6.1, U6.2, U6.3, U6.4, U6.5, U6.6, U6.7, U6.8, U6.9, U6.10, U6.11, U6.12, U6.13 | `agent editor screen preserves save archive delete and model refresh behavior` | Verify `AgentEditorScreen.tsx` extraction is behavior-preserving |
| U7.1, U7.2, U11.1, U11.2, U11.3 | `council editor screen preserves required-field, member-removal, and delete-confirm flows` | Verify `CouncilEditorScreen.tsx` extraction is behavior-preserving |
| U8.1, U8.2, U8.3, U8.4, U8.5, U8.6, U8.7, U8.8, U8.9, U8.10, U8.11, U9.1, U9.2, U9.3, U9.4, U9.5, U9.6, U9.7, U9.8, U10.1, U10.2, U10.3, U10.4, U10.5, U10.6, U10.7, U10.8, U10.9, U10.10, U10.11, U10.12, U10.13, U10.14, U12.1, U12.2, U12.3, U12.4, U12.5, U12.6, U13.1, U13.2, U13.3, U13.4 | `council view screen preserves runtime controls transcript members config and modal behavior` | Verify `CouncilViewScreen.tsx` extraction does not change runtime UX or state semantics |
| U9.2, U9.3, U9.4 | `color picker helpers resolve popover and keyboard navigation` | Add direct unit coverage only if pure ColorPicker helpers are extracted |

## Validation commands to run
- `bun run format:check`
- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test:unit`
- `bun run test:integration`
- `bun run test:coverage`
- `bun run check:coverage-guardrails`
- `bun run check:boundaries`
- `bun run check:migrations`
- `bun run trace:generate`
- `bun run check:traceability`
- `bun run rebuild:native`
- `bun run diag:electron`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/refactor-conservative-smoke.json`

## Rollback strategy
- Revert the renderer decomposition commits in reverse phase order.
- If a later scoped-state extraction causes subtle regressions, keep the screen extraction but move the affected transient state back up one component boundary.
- Treat `CouncilViewScreen.tsx` internal state localization as optional follow-up if first-pass screen extraction already delivers sufficient maintainability.
