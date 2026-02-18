# Plan 006 - Council Runtime Foundation

## Objective

Implement the first runtime foundation for Councils so users can start a council, pause/resume Autopilot state, and open a basic Council View with persisted runtime status.

## Scope

- Add Council runtime fields (started/paused/turn count) to persistence and DTOs.
- Add main-process runtime commands for start, pause, and resume.
- Enforce archive restrictions for running (unpaused) Autopilot councils.
- Add Council View renderer screen and wire Councils list row open behavior.
- Add tests for runtime transitions, archive guardrails, validators, and persistence mapping.

## Non-goals

- AI generation orchestration, speaker selection, or briefing updates.
- Transcript/message persistence and export flows.
- Final Council View layout polish (two-column tabs, composer, transcript bubbles).

## Architecture impact assessment

- Keep boundary direction unchanged: Renderer -> Preload -> IPC handlers -> Councils slice -> persistence service.
- Runtime state decisions remain in the Councils slice; persistence stores plain runtime fields only.
- Runtime command payloads use strict IPC validators; no secrets or paths cross IPC.
- Migration is forward-only (`0003_*`) and preserves compatibility with existing databases.

## Implementation plan

1. Add migration for runtime columns on `councils` (`started_at_utc`, `autopilot_paused`, `turn_count`).
2. Extend persistence and DTO contracts with runtime fields.
3. Add validators and IPC contracts for runtime commands and Council View fetch.
4. Implement runtime methods in `councils/slice.ts`:
   - `getCouncilView`
   - `startCouncil`
   - `pauseCouncilAutopilot`
   - `resumeCouncilAutopilot`
   - archive blocking when Autopilot is running and not paused.
5. Wire IPC handlers/channels and preload/window API bridges.
6. Add Council View screen in renderer and connect list row opening + runtime controls.
7. Add/extend tests (slice, IPC contract, validators, persistence).
8. Update `docs/status.md` traceability for covered requirements.

## Risks and mitigations

- Risk: Runtime semantics could drift from final generation state machine.
  - Mitigation: keep this scope explicitly to lifecycle state only; document remaining runtime gaps.
- Risk: Added DTO fields may break existing tests and renderer assumptions.
  - Mitigation: update all affected contract and integration tests in the same change.
- Risk: Archive guard conflicts with existing editor behavior.
  - Mitigation: enforce in slice as source of truth and mirror in UI button disable messaging.

## Coverage matrix

| Requirement IDs | Planned tests | Validation intent |
| --- | --- | --- |
| R2.11, R3.7, R3.8 | `tests/integration/councils-handlers.integration.spec.ts` | Start/pause/resume transitions and archive blocking while Autopilot is running |
| R3.1, R3.2 | `tests/integration/councils-ipc.contract.integration.spec.ts` | Council View payload validation and runtime command contracts |
| A3 | `tests/unit/ipc-validator-shapes.spec.ts`, `tests/integration/councils-ipc.contract.integration.spec.ts` | New IPC schemas and handler validation behavior |
| B1, B2, B3, R7.1 | `tests/integration/sqlite-persistence.integration.spec.ts` | Runtime fields persist and round-trip through SQLite |

## Validation commands

- `bun run test:unit`
- `bun run test:integration`
- `bun run typecheck`

## Rollback strategy

- Revert runtime IPC channels and renderer Council View lifecycle controls.
- Keep migration file if applied; stop reading/writing runtime columns in slice paths.
