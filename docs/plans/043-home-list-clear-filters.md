# Plan 043: Home List Clear Filters

## Objective
Add an explicit clear-filters action to the Agents and Councils home-list toolbars so users can return both lists to their default query state in one click.

## Scope
- Add shared renderer helper logic for resetting home-list toolbar state back to defaults.
- Render clear-filters controls in both the Councils and Agents toolbars.
- Add focused regression coverage and an Electron diagnostic for the reset behavior.
- Update `docs/status.md` and regenerate traceability output.

## Non-goals
- No change to main-process list filtering, sorting, pagination, or persistence semantics.
- No change to card layouts, overflow menus, or editor flows.
- No new global search/filter abstractions beyond what the current home lists need.

## Architecture impact assessment
- This is a renderer/shared-helper change centered in `src/renderer/App.tsx` and `src/shared/app-ui-helpers.ts`.
- Existing boundaries remain intact because filtering state stays in the renderer and list queries continue going through preload IPC.
- Diagnostic coverage stays in the Electron-tool scenario layer without introducing new runtime dependencies.

## Step-by-step implementation plan
1. Add shared helper(s) that define the default home-list toolbar state and detect whether a clear-filters action should be enabled.
2. Wire the helper(s) into `src/renderer/App.tsx` so Agents and Councils each expose a `Clear filters` button that resets search, tag, archived, and sort controls.
3. Add/update unit coverage for the shared helper behavior with exact requirement traceability IDs.
4. Add a dedicated Electron diagnostic scenario that exercises filter changes and verifies `Clear filters` restores the default toolbar state in both tabs.
5. Update `docs/status.md`, regenerate traceability artifacts, and run the required validation commands.

## Risks and mitigations
- Risk: users may expect sort controls to remain untouched while only search/filter inputs reset.
  - Mitigation: treat all toolbar query controls as part of the filter state and make the button label/action consistent across both tabs.
- Risk: duplicated reset logic between Agents and Councils could drift later.
  - Mitigation: centralize defaults and active-state checks in shared helper functions.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| R1.17, R1.19, R1.22, R1.27, U4.2 | `resolves agent home-list clear filters state and defaults` | Verify Agents toolbar can detect active query state and restore default search/tag/archive/sort values |
| R2.22, R2.24, U3.2 | `resolves council home-list clear filters state and defaults` | Verify Councils toolbar can detect active query state and restore default search/tag/archive/sort values |
| U3.2, U4.2, U1.4 | `home-list-clear-filters scenario resets both toolbars` | Verify both home tabs keep state while browsing and return to default toolbar state when `Clear filters` is clicked |

## Validation commands to run
- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test:unit`
- `bun run trace:generate`
- `bun run check:traceability`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/home-list-clear-filters.json`

## Rollback strategy
- Revert the renderer/helper/test/diagnostic/doc changes from this plan if the clear-filters affordance proves confusing or redundant in usability review.
