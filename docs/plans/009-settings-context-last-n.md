# Plan 009 - Settings Context Window Management

## Objective

Complete settings-level management for runtime context window size (`context_last_n`) by wiring persistence, IPC, and renderer controls so users can configure `N` without code changes.

## Scope

- Extend settings state contracts to include `contextLastN` in DTOs and settings view responses.
- Add new settings command for updating context window size through typed IPC.
- Persist `context_last_n` in SQLite and ensure global-default writes do not overwrite it.
- Propagate context size from settings slice into councils runtime prompt composition.
- Add unit/integration coverage for validators, handlers, and persistence.
- Update status traceability for `F1`/`F2` and settings requirements.

## Non-goals

- Advanced UX polish for context controls (tooltips/inline help/error banners).
- Adding per-council context window overrides.
- Changing provider payload schemas or runtime orchestration algorithms.

## Architecture impact assessment

- Maintains renderer -> preload -> IPC -> settings slice -> persistence dependency flow.
- Keeps context-window decision logic pure in shared runtime helper modules.
- Preserves service boundaries: settings owns config persistence; councils slice consumes config via dependency.
- Continues storing outputs-only runtime artifacts (messages/briefings), not raw prompts.

## Step-by-step implementation plan

1. Add `SetContextLastN` request/response DTOs and IPC validators.
2. Extend settings slice state and dependencies for `contextLastN` load/persist.
3. Add settings IPC handler and preload bridge for `settings:set-context-last-n`.
4. Update SQLite persistence service with `saveContextLastN` and non-destructive global-default updates.
5. Pass context size from settings slice to councils runtime dependency (`getContextLastN`).
6. Add renderer settings input + save action for context window size.
7. Update tests and traceability documentation.

## Risks and mitigations

- Risk: settings updates could accidentally reset global default model or other settings fields.
  - Mitigation: use targeted SQL upserts that preserve untouched columns.
- Risk: invalid context values passed from renderer.
  - Mitigation: validate in IPC schema and re-check in settings slice.
- Risk: runtime and settings context values drift.
  - Mitigation: councils reads context size through settings slice getter at prompt-build time.

## Coverage matrix

| Requirement IDs | Planned tests | Validation intent |
| --- | --- | --- |
| F1 | `tests/unit/ipc-validator-shapes.spec.ts`, `tests/integration/providers-handlers.integration.spec.ts` | Verify context window value validation and settings update behavior |
| F2 | `tests/integration/sqlite-persistence.integration.spec.ts`, `tests/integration/councils-handlers.integration.spec.ts` | Ensure context config is persisted while only output artifacts are stored |
| A3, D5 | `tests/integration/providers-ipc.contract.integration.spec.ts` | Confirm typed/sanitized IPC behavior for new settings command |

## Validation commands

- `bun run lint`
- `bun run typecheck`
- `bun run test:unit`
- `bun run test:integration`
- `bun run build`

## Rollback strategy

- Remove `settings:set-context-last-n` IPC surface and renderer control.
- Revert settings-slice/persistence additions for `context_last_n` writes.
- Keep councils runtime defaulting to built-in context size.
