# Plan 038: Home List Page-Fill Pagination

## Objective
Adjust the default Agents and Councils home-list pagination size so each loaded page fills the three-column desktop card grid cleanly instead of leaving a partially filled final row after the first page.

## Scope
- Update the shared app wiring for Agents and Councils default list page size.
- Add or update automated coverage for the returned default page size.
- Add/update an Electron diagnostics scenario that verifies the first loaded page fills the desktop grid before `Load more`.
- Refresh `docs/status.md` and traceability artifacts impacted by the test/scenario updates.

## Non-goals
- No change to filtering, sorting, or `Load more` semantics.
- No change to renderer grid breakpoints or card styling.
- No change to slice-level pagination behavior beyond the configured default page size used by the app.

## Architecture impact assessment
- Main-process wiring change in `src/main/ipc/register-ipc.ts` only; slice pagination logic remains unchanged.
- IPC contracts remain stable; only the returned `pageSize` value changes for app-wired list responses.
- Renderer and diagnostics continue to use preload-only APIs, preserving dependency boundaries.

## Step-by-step implementation plan
1. Introduce a shared default home-list page-size constant aligned to the three-column desktop grid and wire it into both Agents and Councils slice creation.
2. Update integration/contract coverage to assert the configured default page size returned by app-facing list responses.
3. Add or update an Electron scenario that seeds more than one page of Agents/Councils and asserts the initial visible card count matches the filled-page size before using `Load more`.
4. Refresh `docs/status.md`, regenerate traceability artifacts, and run the required validation commands.

## Risks and mitigations
- Risk: increasing the first-page count could make the initial home-list load feel heavier.
  - Mitigation: keep the change modest (from 10 to 12) and preserve existing `Load more` pagination semantics.
- Risk: tests could keep using slice-local page sizes and miss the app-wired regression.
  - Mitigation: add assertions in IPC-level coverage where the app default is surfaced in responses.
- Risk: diagnostics could be flaky if seeded counts collide with prior local data.
  - Mitigation: seed unique scenario-tagged records and assert minimum card counts scoped to those names/tags.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| R6.1, R6.2, U3.4, U4.3 | `returns the configured default agents page size through ipc` | Verify app-facing Agent list responses expose the updated constant page size used by the home list |
| R6.1, R6.2, U3.4 | `returns the configured default councils page size through ipc` | Verify app-facing Council list responses expose the updated constant page size used by the home list |
| U3.4, U4.3 | `home lists fill the first desktop grid page before load more` | Verify Electron diagnostics seed enough records and the first visible page shows 12 cards for both tabs |

## Validation commands to run
- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test:integration`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/home-list-pagination-page-fill.json`
- `bun run trace:generate`
- `bun run check:traceability`

## Rollback strategy
- Revert the default page-size constant, IPC/integration assertions, diagnostic scenario updates, and docs changes together if the larger first page negatively affects home-list load performance.
