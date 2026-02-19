# Plan 015 - Council View Accessibility Baseline

## Objective

Implement the next Council View UX increment by adding keyboard/focus accessibility semantics for runtime controls, transcript interactions, and Autopilot modal dialog behavior, while preserving existing runtime orchestration and IPC boundaries.

## Scope

- Add reusable pure helpers for transcript keyboard navigation and ARIA label composition.
- Improve Council View transcript keyboard navigation (`ArrowUp`, `ArrowDown`, `Home`, `End`) with focus movement.
- Improve Autopilot Start/Resume modal keyboard semantics (initial focus target, Escape to cancel, Enter to submit).
- Add explicit accessible labels to warning badges in renderer views.
- Add visible focus styles for interactive controls.
- Add unit coverage for new pure accessibility helpers.
- Extend Electron diagnostic scenario coverage for keyboard transcript navigation.
- Update status and traceability docs.

## Non-goals

- Full app-wide accessibility completion for every tab and dialog flow.
- Council View layout redesign into final two-column UX.
- Runtime orchestration changes in main process.

## Architecture impact assessment

- Renderer-only interaction updates keep `Renderer -> Preload -> Main` boundaries unchanged per `docs/dependency-boundaries.mermaid`.
- New helper module remains pure in shared layer and introduces no IO/service dependencies.
- No provider/keychain/DB/IPC surface changes; existing security boundaries and domain invariants remain intact.

## Step-by-step implementation plan

1. Add pure shared helper module for transcript focus navigation and transcript ARIA labels.
2. Wire helper into Council View transcript rendering and keyboard handlers.
3. Add dialog keyboard handlers and open-focus behavior for Autopilot Start/Resume modal.
4. Add explicit badge ARIA labels and global focus-visible styles.
5. Add unit tests for helper module behavior.
6. Extend diagnostics scenario to assert keyboard transcript navigation.
7. Run lint/typecheck/unit tests/integration tests + councils diagnostic scenario.
8. Regenerate requirement traceability and update `docs/status.md`.

## Risks and mitigations

- Risk: keyboard handlers interfere with normal input behavior.
  - Mitigation: scope transcript handlers to transcript rows only; keep textarea/input behavior unchanged.
- Risk: dialog Enter handling could submit unexpectedly.
  - Mitigation: handler applies only within Autopilot modal; no multiline inputs in modal.
- Risk: accessibility changes regress renderer styles.
  - Mitigation: add focused CSS changes and validate with diagnostic scenario screenshot.

## Coverage matrix

| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| U15.2 | `moves focus down and up within transcript bounds`; `supports Home and End keyboard navigation` | Verify deterministic keyboard navigation behavior in pure helper and renderer scenario path. |
| U15.3 | `builds descriptive aria labels with identity and message details` | Ensure badge/transcript labels are explicit for assistive technology. |
| U15.4 | `builds descriptive aria labels with identity and message details` | Ensure transcript identity always includes member/conductor name text. |

## Validation commands to run

- `bun run lint`
- `bun run typecheck`
- `bun run test:unit`
- `bun run test:integration`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/councils-ui.json`
- `bun run trace:generate`

## Rollback strategy

- Revert Council View accessibility helper wiring and keyboard handlers.
- Revert focus-visible and transcript button styling changes.
- Revert diagnostic scenario and helper unit test additions.
- Re-run validation gates to confirm rollback baseline.
