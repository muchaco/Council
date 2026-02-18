# Plan 003: Agents List + Create/Edit Slice

## Objective

Implement the first Agents vertical slice end-to-end so users can list, filter, sort, paginate, create, edit, and delete agents with model invalid-config semantics enforced against per-view model snapshots.

## Scope

- Add Agents DTOs + validators + preload API surface for list/editor/save/delete/refresh actions.
- Add main-process Agents slice and IPC handlers with:
  - required-field validation,
  - unique-name validation,
  - tag normalization/limits/duplicate prevention,
  - model invalid-config save blocking,
  - list filtering/sorting/pagination.
- Add renderer Home tab shell for Councils/Agents/Settings and full-screen Agent create/edit view.
- Add tests for validator shapes, handler orchestration, and IPC contract behavior.
- Add Playwright Electron diagnostic smoke scenario for agents flow.
- Update `docs/status.md` traceability pointers.

## Non-goals

- Council references for delete-guard (`R1.14`) until Councils persistence exists.
- Agent temperature behavior inside runtime prompts.
- Final polished list-row keyboard interactions for all accessibility details.

## Architecture Impact Assessment

- Preserves renderer -> preload -> main IPC boundary.
- Reuses Settings-owned model snapshot/global-default context through explicit dependency injection into Agents slice.
- Keeps domain validation pure where practical (`model-ref`, `tag`) and maps to typed `DomainError` kinds.

## Step-by-step Implementation Plan

1. Extend shared IPC DTOs/validators for agents operations.
2. Implement `src/main/features/agents/slice.ts` with pure validation and view-scoped model checks.
3. Implement `src/main/features/agents/ipc-handlers.ts` with schema validation and safe error mapping.
4. Register new IPC endpoints and preload bridge methods.
5. Replace renderer shell with Home tabs, Agents list controls, and Agent editor full-screen flow.
6. Add unit/integration tests for agents and validators.
7. Add Playwright Electron smoke scenario for agents flow.
8. Update `docs/status.md` requirement coverage + test mapping.
9. Run all quality gates and diagnostics.

## Risks and Mitigations

- Risk: cross-slice coupling between Agents and Settings snapshot semantics.
  - Mitigation: inject only minimal model-context dependency (`modelCatalog`, `globalDefaultModelRef`, `canRefreshModels`).
- Risk: list pagination regressions and filter drift.
  - Mitigation: integration tests cover page boundaries and filter combinations.
- Risk: UI drift between list/edit invalid-config states.
  - Mitigation: editor + list both consume same backend invalid-config semantics and are exercised by smoke checks.

## Coverage Matrix

| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| R1.1, R1.2, R1.4, R1.5, R1.8, R1.9, R1.15 | `agents-handlers.integration.spec.ts` | Save and edit flow validates required fields/name uniqueness/tags/model validity. |
| R1.12, R1.13 | `agents-handlers.integration.spec.ts::deletes-existing-agent` | Delete command flow and UI-triggered confirmation path support hard-delete. |
| R1.16, R1.17, R1.18, R1.19 | `agents-handlers.integration.spec.ts::filters-by-text-and-tag` | Search + tag filter + sort semantics in list queries. |
| R6.1, R6.2, R6.3, R6.4 | `agents-handlers.integration.spec.ts::creates-and-lists-agents-with-pagination` | Constant page size and load-more behavior on list queries. |
| U4.1, U4.2, U4.3, U4.4, U6.1, U6.2, U6.10 | `agents-smoke.json` (Electron diagnostic) | Validate Home tab navigation, list controls, full-screen editor, and refresh action presence. |
| A3 | `agents-ipc.contract.integration.spec.ts`, `ipc-validator-shapes.spec.ts` | IPC payload validation and typed bridge contract. |

## Validation Commands to Run

- `bun run format:check`
- `bun run lint`
- `bun run typecheck`
- `bun run test:unit`
- `bun run test:integration`
- `bun run build`
- `bun run check:boundaries`
- `bun run db:migrate:verify`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/agents-smoke.json`

## Rollback Strategy

- Revert `src/main/features/agents/*`, DTO/validator/preload changes, and renderer tab wiring together if the slice cannot satisfy quality gates.
- Keep diagnostics scenario + docs only if rollback occurs after implementation learning is useful.
