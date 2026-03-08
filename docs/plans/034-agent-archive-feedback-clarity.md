# Plan 034: Agent Archive Feedback Clarity

## Objective
Make Agent archive and archived-filter interactions feel immediate and unambiguous so users can tell that archive/restore actions succeeded from the Agents list and Agent edit view.

## Scope
- Add immediate renderer-side list updates for Agent archive/restore actions while preserving the existing IPC-backed source of truth refresh.
- Surface explicit inline list refresh feedback for Agents when list filters or archive actions trigger a reload.
- Add regression coverage for the renderer helper logic and an Electron archive-flow scenario.
- Update status tracking and traceability artifacts.

## Non-goals
- No change to Agent archive persistence, DTO contracts, or main-process state semantics.
- No change to Council archive semantics.
- No redesign of the Agents list layout beyond feedback/clarity improvements.

## Architecture impact assessment
- Renderer-only behavior change in `src/renderer/App.tsx` and shared pure UI helper logic in `src/shared/app-ui-helpers.ts`.
- Main/preload/IPC boundaries remain unchanged; archive state continues to flow only through preload-backed APIs.
- New coverage remains in unit diagnostics and Electron scenario automation, preserving existing dependency direction.

## Step-by-step implementation plan
1. Add a pure helper that applies Agent archive/restore results to the current list according to the active archived filter.
2. Use that helper in the Agents list archive action so the card badge/removal updates immediately before the reconciliation reload completes.
3. Add an inline `Refreshing agents...` status affordance while the Agents list is reloading with existing cards still visible.
4. Add/update unit tests with exact requirement IDs for the helper behavior and add a focused Electron scenario for Agent archive/filter/edit feedback.
5. Update `docs/status.md`, regenerate traceability, and run required validation commands.

## Risks and mitigations
- Risk: optimistic list updates could temporarily diverge from the persisted page contents.
  - Mitigation: keep the existing `loadAgents({ page: 1, append: false })` reconciliation after every archive/restore mutation.
- Risk: helper logic could mishandle archived-filter edge cases.
  - Mitigation: keep the logic pure and cover `all`, `active`, and `archived` filter cases in unit tests.
- Risk: extra inline status text could add visual noise.
  - Mitigation: show it only while a refresh is in progress and items are already on screen.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| R1.20, R1.21, R1.22, R1.24, R1.27, U4.2, U4.5, U4.6 | `applies immediate agent archive list updates for every archived filter state` | Verify renderer-side archive/restore feedback keeps badges and filtered visibility aligned with the active archived filter |
| R1.20, R1.21, R1.22, R1.24, U4.2, U4.5, U4.6, U6.11, U6.12, U6.13 | `agents archive flow updates list filtering and editor read-only feedback` | Verify Electron archive action, archived-only filter, and editor restore/read-only flow behave visibly end-to-end |

## Validation commands to run
- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test:unit`
- `bun run test:integration`
- `bun run check:coverage-guardrails`
- `bun run check:boundaries`
- `bun run check:migrations`
- `bun run diag:electron`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/agents-smoke.json`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/agents-archive-feedback.json`
- `bun run trace:generate`
- `bun run check:traceability`

## Rollback strategy
- Revert the renderer helper, Agents list inline status text, unit coverage, and the new Electron scenario together if the feedback changes prove noisy or misleading.
