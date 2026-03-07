# Plan 028: Home List Visual Alignment and Refresh Control Consistency

## Objective
Align the Councils and Agents home-list surfaces so they feel like one product, while standardizing model-refresh affordances across every model selector.

## Scope
- Bring Councils and Agents toolbars onto the same visual system.
- Give both council and agent cards a subtle elevated surface treatment tied to the existing toolbar look.
- Remove archived-card dimming so archived councils remain clearly interactive.
- Move the agent overflow menu to the card header and use the same vertical more-actions affordance.
- Remove transient loading copy from the fast-loading home lists.
- Make every model-selector refresh control match the compact icon button used in Settings.
- Update documentation and diagnostics coverage for the renderer changes.

## Non-goals
- No main-process, IPC, or persistence changes.
- No changes to council/agent list filtering, pagination, or action semantics.
- No redesign of Settings beyond refresh-control consistency.

## Architecture impact assessment
- Renderer-only implementation in `src/renderer/App.tsx` and `src/renderer/styles.css`.
- Existing dependency boundaries remain intact: renderer consumes existing typed IPC/query data only.
- Diagnostics coverage stays in renderer-facing scenarios under `scripts/diagnostics/scenarios/`.

## Step-by-step implementation plan
1. Introduce shared toolbar and card surface classes for home-list sections.
2. Update Councils cards to use the new surface treatment and remove archived opacity dimming.
3. Update Agents toolbar/card markup to match Councils inputs/selects/buttons and move the overflow menu to the top-right header.
4. Replace text refresh buttons beside model selectors with the compact icon-button pattern in Agent edit, Council create/edit, and Council View config.
5. Remove transient `Loading councils...` and `Loading agents...` copy while preserving load-more progress affordances.
6. Update UX/functional docs, status tracking, and diagnostics coverage, then rerun validation.

## Risks and mitigations
- Risk: the new shared card background reduces contrast too much.
  - Mitigation: keep the delta subtle with border/shadow reinforcement and preserve text/badge contrast.
- Risk: moving the agent actions menu affects discoverability.
  - Mitigation: keep the control visible in the header with the same vertical more icon used on council cards.
- Risk: icon-only refresh controls become ambiguous.
  - Mitigation: keep explicit `aria-label` and `title` text on every button.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| R4.11, U5.7, U6.10, U10.13 | `uses consistent compact refresh buttons across model selectors` | Verify every model picker keeps an adjacent refresh affordance with the same compact icon treatment |
| U3.1, U3.2, U3.3, U4.1, U4.2 | `renders aligned council and agent home list surfaces` | Verify toolbar/card presentation and action placement stay consistent across home tabs |
| U3.7, U4.3 | `removes transient list loading copy while preserving list actions` | Verify home lists avoid flicker-only loading text without regressing pagination affordances |

## Validation commands to run
- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/ui-inspect.json`
- `bun run trace:generate`
- `bun run check:traceability`

## Rollback strategy
- Revert the renderer/style/scenario/doc changes in this plan if the shared visual direction or refresh-control treatment proves problematic.
