# Plan 017 - Home Tab and List Keyboard Navigation

## Objective

Extend accessibility coverage from Council View into Home navigation by adding keyboard tab switching and keyboard-friendly list-row open behavior for Councils and Agents lists.

## Scope

- Add pure shared helper logic for Home tab keyboard navigation (`ArrowLeft`, `ArrowRight`, `Home`, `End`).
- Implement ARIA tab semantics for Home tabs.
- Make Councils and Agents list rows keyboard-openable via focusable row-open controls.
- Add unit coverage for new keyboard helper behavior.
- Update status + traceability docs.

## Non-goals

- Implementing Council View Config-tab inline editing (`U10.*`).
- Reworking list row visual design beyond accessibility and focus behavior.
- Introducing new IPC/main-process functionality.

## Architecture impact assessment

- Changes are renderer/shared-only and preserve `Renderer -> Preload -> Main` boundaries from `docs/dependency-boundaries.mermaid`.
- New shared helper is pure and has no IO/service dependency.
- No DTO/API contract changes.

## Step-by-step implementation plan

1. Add shared helper for Home tab keyboard index resolution.
2. Add tablist/tabpanel semantics and keyboard handlers in `src/renderer/App.tsx`.
3. Add keyboard-open row controls in Councils and Agents list rows.
4. Add focus styling for row-open controls.
5. Add unit tests for helper behavior.
6. Run validation commands and regenerate traceability artifacts.
7. Update `docs/status.md` with done/gaps/next-step alignment.

## Risks and mitigations

- Risk: tab keyboard handling could conflict with default button behavior.
  - Mitigation: only handle arrow/Home/End keys; keep Enter/Space button semantics unchanged.
- Risk: row-open control may accidentally trigger when using overflow actions.
  - Mitigation: keep row-open control separate from row action button group.

## Coverage matrix

| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| U15.2 | `cycles tab focus index with ArrowRight and ArrowLeft`; `supports Home and End for tab keyboard navigation`; `recognizes Enter and Space list-row open keys` | Verify deterministic keyboard behavior for Home tab movement and list-row open key mapping. |

## Validation commands to run

- `bun run lint`
- `bun run typecheck`
- `bun run test:unit`
- `bun run test:integration`
- `bun run trace:generate`
- `bun run check:traceability`

## Rollback strategy

- Revert Home tab keyboard/ARIA wiring in `src/renderer/App.tsx`.
- Revert list-row open control/focus style changes.
- Revert Home keyboard helper and unit tests.
- Re-run validation gates.
