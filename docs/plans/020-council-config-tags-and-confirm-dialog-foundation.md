# Plan 020 - Council Config Tags and Confirm Dialog Foundation

## Objective

Start the next Council View UX increment by adding richer Config-tag editing (chip add/remove baseline) and introducing a reusable confirmation-dialog primitive for in-view destructive/discard actions.

## Scope

- Add shared pure tag-draft helpers for Council Config (`parse + append` with UI-safe validation).
- Upgrade Council View Config `Tags` editing from textarea-only to chip add/remove interaction while preserving inline-save flow.
- Introduce a reusable renderer confirm dialog component and adopt it for Config discard and Config delete actions.
- Add unit coverage for new shared tag helpers with requirement trace mapping.
- Update status tracking docs.

## Non-goals

- Full replacement of all existing browser `window.confirm` prompts across Agents/Councils editors.
- New main-process or IPC contract changes.
- Finalized, cross-app dialog system design tokens.

## Architecture impact assessment

- Changes remain in renderer/shared layers only and preserve `Renderer -> Preload -> Main IPC` boundaries from `docs/architecture-diagram.mermaid` and `docs/dependency-boundaries.mermaid`.
- Domain/IO boundaries are unchanged; no secrets/path handling changes.
- Shared logic remains pure in `src/shared/app-ui-helpers.ts`; side effects stay in renderer event handlers.

## Step-by-step implementation plan

1. Add pure Council Config tag helpers in `src/shared/app-ui-helpers.ts`.
2. Add unit tests in `tests/unit/app-ui-helpers.spec.ts` for normalize/append rules.
3. Add reusable renderer confirm dialog component (`src/renderer/ConfirmDialog.tsx`).
4. Integrate chip-based tag editing in Council View Config in `src/renderer/App.tsx`.
5. Replace Config discard and Config delete modals with reusable confirm dialog usage.
6. Run validation commands and update status/traceability artifacts.

## Risks and mitigations

- Risk: chip editing diverges from backend tag rules.
  - Mitigation: keep shared helper constraints aligned with existing max-tag and duplicate semantics.
- Risk: dialog keyboard behavior regression.
  - Mitigation: preserve Escape/Enter handling and reuse existing modal shell styling.

## Coverage matrix

| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| U10.11 | `normalizes council config tags from draft text`, `appends council config tags with ui-friendly validation` | Validate deterministic chip-edit helper behavior and limits before renderer wiring. |

## Validation commands to run

- `bun run lint`
- `bun run typecheck`
- `bun run test:unit`
- `bun run test:integration`
- `bun run trace:generate`
- `bun run check:traceability`

## Rollback strategy

- Revert `src/shared/app-ui-helpers.ts` helper additions and matching tests.
- Revert `src/renderer/ConfirmDialog.tsx` and `src/renderer/App.tsx` integration.
- Revert `src/renderer/styles.css` chip/editor styling additions.
- Re-run validation gates.
