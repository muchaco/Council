# Plan 010 - Autopilot Start + Max-Turn Orchestration

## Objective

Implement Autopilot start/opening orchestration and max-turn runtime limits with typed IPC contracts and persistence-safe state transitions.

## Scope

- Extend council runtime state/contracts to support optional Autopilot max-turn limits for Start/Resume.
- Implement Autopilot Start opening flow:
  - Conductor generates opening message,
  - Conductor returns first planned speaker,
  - runtime persists opening message + briefing + planning state.
- Enforce max-turn stopping behavior in Autopilot runtime progression.
- Persist new runtime orchestration state in SQLite so transitions survive reload/restart safely.
- Update renderer Council View controls to collect optional max turns for Start/Resume and pass typed payloads.
- Add/extend tests for validators, IPC contracts, slice orchestration, and persistence.
- Update traceability in `docs/status.md` (requirements, tests, open decisions).

## Non-goals

- Full export flow implementation (`R3.32`-`R3.34`).
- Background/scheduled runtime execution outside active Council View lease.
- Final polished modal UX for all Autopilot controls.

## Architecture impact assessment

- Keeps boundary direction intact: renderer -> preload -> IPC -> councils slice -> services.
- Adds pure Conductor opening prompt/parse helpers in shared runtime module.
- Keeps provider calls behind `AiService`; no renderer/provider coupling introduced.
- Persists runtime orchestration state via existing SQLite persistence boundary.

## Step-by-step implementation plan

1. Extend shared IPC DTO + validators for Start/Resume max-turn payloads.
2. Add pure Conductor opening prompt/response contracts in shared runtime helper.
3. Extend councils runtime state with persisted max-turn fields and update transitions.
4. Implement Autopilot start opening orchestration and persisted planned-speaker behavior.
5. Enforce max-turn stopping semantics in `advanceAutopilotTurn`.
6. Add SQLite migration and persistence mapping for new runtime fields.
7. Wire renderer Council View Start/Resume to collect optional max turns and send typed payloads.
8. Update tests (`unit`, `integration`, `ipc contract`, `persistence`).
9. Update `docs/status.md` traceability and open-decision handling.

## Risks and mitigations

- Risk: opening-response parsing brittleness.
  - Mitigation: strict JSON envelope + deterministic parser errors + test coverage.
- Risk: max-turn counters drift across pause/resume.
  - Mitigation: persist explicit max-turn + completed-turn fields and reset on resume.
- Risk: start/opening failure leaves unstable runtime state.
  - Mitigation: use pause-on-error transitions and only persist turn increments after successful message append.

## Coverage matrix

| Requirement IDs | Planned tests | Validation intent |
| --- | --- | --- |
| R3.18, R3.22 | `tests/integration/councils-handlers.integration.spec.ts`, `tests/unit/council-runtime-conductor.spec.ts` | Validate start opening message generation and conductor-selected first speaker constraints |
| R3.23, U12.1, U12.2 | `tests/unit/ipc-validator-shapes.spec.ts`, `tests/integration/councils-ipc.contract.integration.spec.ts`, `tests/integration/councils-handlers.integration.spec.ts` | Validate typed max-turn payload handling and runtime stop-on-limit behavior |
| R3.24, R8.3 | `tests/integration/councils-handlers.integration.spec.ts` | Ensure autopilot pause-on-error semantics remain stable with new opening flow |
| B1, B2, R7.1 | `tests/integration/sqlite-persistence.integration.spec.ts` | Verify new runtime orchestration fields persist and reload correctly |

## Validation commands

- `bun run lint`
- `bun run typecheck`
- `bun run test:unit`
- `bun run test:integration`
- `bun run build`

## Rollback strategy

- Revert Start/Resume max-turn DTO and validator extensions.
- Revert opening orchestration helper and councils slice integration.
- Remove migration for new runtime columns if not yet released; otherwise keep schema and ignore columns in runtime mapping.
