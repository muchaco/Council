# Plan 018 - Shared Toast Queue Foundation

## Objective

Extend toast notifications from a Settings-only pattern into a shared renderer primitive that can be reused across Home, Editors, and Council View while preserving deterministic, user-readable behavior.

## Scope

- Add pure shared toast queue logic that deduplicates identical messages and caps visible queue size.
- Wire renderer toast hook to use the shared helper while preserving auto-dismiss behavior.
- Keep existing toast rendering path in App flows (no IPC or main-process changes).
- Add unit coverage for shared toast queue behavior.
- Update status and traceability artifacts.

## Non-goals

- Building the full Council View Config-tab inline-edit UX (`U10.*`).
- Introducing new domain/main-process commands.
- Reworking toast visual design beyond current CSS.

## Architecture impact assessment

- Changes stay within renderer/shared modules and preserve `Renderer -> Preload -> Main IPC` boundaries from `docs/architecture-diagram.mermaid` and `docs/dependency-boundaries.mermaid`.
- Queue mutation logic is pure (`src/shared/app-ui-helpers.ts`) and side effects remain in renderer hook (`src/renderer/use-toast-queue.ts`).
- No DTO/schema or security-boundary changes.

## Step-by-step implementation plan

1. Add shared toast types and `upsertToast` queue helper in `src/shared/app-ui-helpers.ts`.
2. Refactor `src/renderer/use-toast-queue.ts` to consume `upsertToast`.
3. Preserve timer cleanup semantics when toasts are deduplicated or trimmed.
4. Add unit tests for dedupe + bounded queue behavior in `tests/unit/app-ui-helpers.spec.ts`.
5. Run quality gates and traceability generation.
6. Update `docs/status.md` with completed scope and next step.

## Risks and mitigations

- Risk: stale timers could try to clear already-removed toasts.
  - Mitigation: remove timers for deduped/trimmed IDs immediately during queue updates.
- Risk: dedupe could hide meaningful repeated events.
  - Mitigation: dedupe only exact (`level + message`) matches and refresh timeout when repeated.

## Coverage matrix

| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| U2.6 | `deduplicates and bounds toast queue entries` | Validate normalized message dedupe and bounded queue behavior for shared toast UX feedback. |

## Validation commands to run

- `bun run lint`
- `bun run typecheck`
- `bun run test:unit`
- `bun run test:integration`
- `bun run trace:generate`
- `bun run check:traceability`

## Rollback strategy

- Revert toast helper additions in `src/shared/app-ui-helpers.ts`.
- Revert hook refactor in `src/renderer/use-toast-queue.ts`.
- Revert toast helper unit test additions.
- Re-run validation gates.
