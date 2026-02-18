# Plan 005 - Councils Slice Foundation

## Objective

Implement the first Councils vertical slice so users can create, list, edit, archive/restore, and delete councils with local persistence and strict IPC boundaries.

## Scope

- Add Council DTOs and IPC validators.
- Add main-process Councils slice + IPC handlers.
- Add SQLite persistence and migration support for councils and council members.
- Add renderer Councils tab list + editor screen with explicit save actions.
- Enforce Agent deletion guard when an Agent is referenced by any Council.
- Add tests for council slice behavior, IPC contract validation, and persistence.

## Non-goals

- Runtime Council View orchestration (start/pause/resume/generation/autopilot/manual turns).
- Message transcript persistence and runtime state machine.
- Final UX polish for keyboard navigation and accessibility details beyond baseline controls.

## Architecture impact assessment

- Boundary compliance remains Renderer -> Preload -> IPC handlers -> Councils slice -> persistence service.
- Domain rules (validation, mode immutability, list filters/pagination, archive semantics) stay in slice logic, not in DB layer.
- Persistence service only stores and retrieves records; it does not own validation decisions.
- Agent delete guard is enforced in the Agents slice via injected dependency that queries Councils references through persistence.

## Implementation plan

1. Extend shared IPC contracts for councils list/editor/save/delete/archive actions.
2. Add zod validators for new payload shapes.
3. Add `councils` migration and persistence service methods for councils + members and reference counting by agent id.
4. Implement `src/main/features/councils/slice.ts` with:
   - required-field checks,
   - tag normalization,
   - mode immutability after create,
   - list filters/search/sort/pagination,
   - archive/restore and delete operations.
5. Implement councils IPC handlers and wire new IPC channels in register/preload/window API.
6. Add renderer Councils tab list controls and editor flow.
7. Inject council-reference guard into Agents delete path.
8. Add/extend integration and unit tests.
9. Update `docs/status.md` traceability.

## Risks and mitigations

- Risk: Adding Councils UI in an already large `App.tsx` increases complexity.
  - Mitigation: Keep state and helpers grouped and use clear council-specific naming.
- Risk: Migration compatibility with existing local DB files.
  - Mitigation: Add a new forward-only migration (`0002_*.sql`) and avoid mutating `0001`.
- Risk: Requirement drift on archive/runtime constraints.
  - Mitigation: Explicitly mark runtime-dependent constraints as follow-ups in status docs.

## Coverage matrix

| Requirement IDs | Planned tests | Validation intent |
| --- | --- | --- |
| R2.1, R2.2, R2.3, R2.4, R2.6, R2.7, R2.8, R2.9, R2.20, R2.21, R2.22, R2.23, R2.24 | `tests/integration/councils-handlers.integration.spec.ts` | Council create/edit/list/archive/restore/delete and list query semantics |
| R6.1, R6.2, R6.3, R6.4, R6.6 | `tests/integration/councils-handlers.integration.spec.ts` | Page-size, load-more, filter reset compatible query behavior |
| A3 | `tests/integration/councils-ipc.contract.integration.spec.ts` | IPC input validation and channel behavior |
| B1, B2, B3, R7.1 | `tests/integration/sqlite-persistence.integration.spec.ts` | Council persistence roundtrip and member mapping |
| R1.14 | `tests/integration/agents-handlers.integration.spec.ts` | Agent delete blocked when referenced by a council |

## Validation commands

- `bun run test:unit`
- `bun run test:integration`
- `bun run typecheck`

## Rollback strategy

- Revert council IPC channel registration and renderer council editor/list UI.
- Keep migration file if already applied; only stop using the new tables in code paths.
