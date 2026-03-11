# Plan 049: Home List Toolbar Redesign

## Objective
Redesign the Agents and Councils home-list search/toolbar into a compact shared query bar with draft-based search, a filter/sort popover, explicit refresh/apply semantics, and a trailing `New` action.

## Scope
- Replace the current always-expanded home-list controls with a shared compact toolbar for both Agents and Councils.
- Make search draft-based so typing does not query until Enter or refresh/apply.
- Move tag, archived-status, and sort controls into a compact popover with `Apply` and `Reset` actions.
- Add visual query-state affordances: filter-active dot and refresh accent when any draft query differs from the applied query.
- Move the list-create CTA to the end of the toolbar and relabel it to `New`.
- Add or update focused unit coverage, Electron diagnostics, docs, status tracking, and traceability.

## Non-goals
- No change to main-process filtering, sorting, pagination, or persistence semantics.
- No change to card layouts, list item contents, overflow menus, or editor flows.
- No list-level model refresh action; the toolbar refresh is a query execution action only.
- No introduction of a global saved-filter system or per-tab persisted query storage beyond the current in-session renderer state.

## Architecture impact assessment
- Primary changes stay in the renderer/shared UI layer: `src/renderer/components/shared/`, `src/renderer/components/home/`, `src/renderer/styles.css`, and `src/shared/app-ui-helpers.ts`.
- Existing dependency boundaries remain intact because applied query state still flows from Renderer -> Preload -> Main IPC -> feature slices using the existing typed request contracts.
- Main-process list handlers should remain behaviorally unchanged; they already support the required query fields.
- Diagnostics should continue to validate behavior through Electron scenarios without adding new runtime dependencies.

## Step-by-step implementation plan
1. Introduce shared home-list query state helpers that distinguish draft and applied query state, compute filter-indicator state, and compute whether the refresh button should show an accent/dirty style.
2. Refactor `src/renderer/components/shared/HomeListToolbar.tsx` into the new compact layout with search input, filter button, refresh button, trailing `New` button, and a compact inline popover/panel for tag, archived, and sort controls.
3. Update `src/renderer/components/home/AgentsPanel.tsx` and `src/renderer/components/home/CouncilsPanel.tsx` to use draft/applied query state, submit on Enter/refresh, apply popover changes explicitly, and reset only popover-owned controls while preserving search text.
4. Extend shared styling in `src/renderer/styles.css` for the new toolbar, popover, active-dot indicator, refresh accent state, compact `New` button placement, and responsive/mobile behavior.
5. Add/update focused unit tests for shared helper logic and any query-state behavior changes, all using exact requirement IDs via `itReq([...], ...)`.
6. Update or add Electron diagnostics that verify: search stays draft-only until refresh, popover apply triggers the same query action, reset clears filters/sort without clearing search, the filter button shows an active dot, and the refresh button accents when draft query state differs from applied state.
7. Update `docs/ux-requirements.md` and any related requirement/status docs to reflect the explicit refresh/apply toolbar interaction, then regenerate traceability and validate the full required command set.

## Risks and mitigations
- Risk: moving controls into a popover could reduce discoverability.
  - Mitigation: keep the filter icon always visible, show an active dot when the applied query is non-default, and keep apply/reset actions explicit.
- Risk: draft/applied state divergence could create confusing refresh behavior.
  - Mitigation: centralize comparison helpers in `src/shared/app-ui-helpers.ts` and cover them with focused tests.
- Risk: keyboard handling regresses for Enter/Escape/tab flow.
  - Mitigation: preserve Enter-to-submit from the search input, ESC-to-close popover, explicit button labels/ARIA text, and add diagnostic coverage for the new flow.
- Risk: prior diagnostics depend on old visible select controls and break noisily.
  - Mitigation: update the affected scenarios together with the renderer change and add stable selectors/labels where needed.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| R1.17, R1.19, R1.22, R1.27, U4.2 | `resolves agent toolbar draft and applied query state` | Verify agent toolbar tracks draft vs applied search/filter/sort state and recognizes active query/default query transitions |
| R2.22, R2.24, U3.3 | `resolves council toolbar draft and applied query state` | Verify council toolbar uses the same explicit apply/refresh semantics and default-state detection |
| U3.3, U4.2, U15.1, U15.2 | `home-list-toolbar-redesign scenario covers draft search apply and reset flows` | Verify both home tabs support the compact toolbar, Enter/refresh submission, filter apply/reset, indicator states, and accessible interaction flow |

## Validation commands to run
- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test:unit`
- `bun run test:integration`
- `bun run check:coverage-guardrails`
- `bun run trace:generate`
- `bun run check:traceability`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/home-list-toolbar-redesign.json`

## Rollback strategy
- Revert the shared toolbar/query-state/styling/test/diagnostic/doc changes if the explicit refresh/apply interaction proves too heavy.
- Keep rollback isolated to renderer/shared UI layers since the main-process list contracts and filtering logic remain unchanged.
