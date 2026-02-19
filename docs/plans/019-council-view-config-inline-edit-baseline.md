# Plan 019 - Council View Config Inline Edit Baseline

## Objective

Implement a Council View Config tab baseline with inline edit mechanics (pencil-only entry, one active edit session, keyboard save/cancel semantics, and discard confirmation on cancel/outside click) while keeping existing IPC architecture boundaries intact.

## Scope

- Add Council View tabbing between Discussion and Config.
- Implement Config-tab fields (`Topic`, `Goal`, `Tags`, `Conductor model`) with pencil-triggered inline editors.
- Enforce one active inline edit session at a time.
- Implement edit keyboard semantics (`Enter` save, `Shift+Enter` newline, `Escape` cancel with discard confirmation when dirty).
- Implement click-outside behavior (close clean editor, prompt when dirty).
- Add Config actions in Council View (Export, Archive/Restore, Delete).
- Extend councils save contract to support `viewKind: "councilView"` for in-view config updates.
- Add/update unit and integration coverage with requirement trace mappings.
- Update status + traceability artifacts.

## Non-goals

- Full Council View two-column redesign and remaining `U8.*` layout polish.
- Rich chip-based tags editor (`U10.11`) beyond inline text baseline.
- New background runtime orchestration behavior.

## Architecture impact assessment

- Renderer continues using `window.api.*` via preload; no direct main/service access.
- Main-process state changes stay in existing councils slice and IPC handlers; no secret/path boundary changes.
- Shared keyboard behavior stays pure in `src/shared/council-view-accessibility.ts`.
- View-specific catalog semantics are preserved by allowing council config save with `viewKind: "councilView"`.

## Step-by-step implementation plan

1. Add shared pure inline-edit keyboard action resolver and unit tests.
2. Add Council View Config tab state and inline edit session state in renderer.
3. Implement field-level inline editors with pencil-only activation and one-session enforcement.
4. Implement discard-confirmation dialog for ESC and click-outside cancel paths.
5. Add Config actions (Export, Archive/Restore, Delete) to Council View Config tab.
6. Extend councils save request schema/type + slice usage for `councilView` context.
7. Update IPC contract tests for `councilView` save/refresh paths.
8. Run lint/typecheck/build/unit/integration/traceability checks.
9. Update `docs/status.md` and regenerated traceability files.

## Risks and mitigations

- Risk: edit session state can conflict with runtime action buttons.
  - Mitigation: disable conflicting controls while an edit session is active.
- Risk: outside-click detection can close editor unexpectedly.
  - Mitigation: scoped container ref checks and dirty-state confirmation.
- Risk: model snapshot mismatch when saving from Council View.
  - Mitigation: route save validation through `viewKind: "councilView"` model context.

## Coverage matrix

| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| U10.7, U15.2 | `maps inline config edit keyboard shortcuts` | Verify keyboard mapping for Enter/Shift+Enter/Escape behavior. |
| U10.1, U10.9, A3 | `creates and fetches council editor view` (extended with councilView save), `validates runtime command payloads` (extended councilView refresh) | Verify typed IPC + view-scoped config save/update contract behavior. |

## Validation commands to run

- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test:unit`
- `bun run test:integration`
- `bun run trace:generate`
- `bun run check:traceability`

## Rollback strategy

- Revert Council View Config tab/inline editing renderer changes.
- Revert save request contract broadening (`councilView`) in DTO/schema/slice.
- Revert added unit/integration tests.
- Re-run validation gates.
