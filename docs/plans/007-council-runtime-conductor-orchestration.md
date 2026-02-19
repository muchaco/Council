# Plan 007 - Council Runtime Conductor Orchestration

## Objective

Increase Council runtime requirement coverage by implementing conductor-driven briefing and goal evaluation orchestration after each new message, with stricter Autopilot speaker-rule handling and pause-on-error behavior.

## Scope

- Add pure prompt/response contracts for runtime conductor calls.
- Update runtime orchestration in `councils/slice.ts` to:
  - run conductor briefing+goal call after Manual member turns and Conductor injections,
  - run conductor briefing+goal update after Autopilot member turns,
  - validate no-consecutive-speaker semantics and algorithmic fallback when only one member is eligible,
  - pause Autopilot on generation/provider errors while preserving stable state.
- Keep current IPC contracts stable; no new renderer API surface in this step.
- Add/extend tests covering conductor briefing persistence, goal flag updates, speaker-rule behavior, and autopilot pause-on-error.

## Non-goals

- Full production provider adapters replacing the runtime fake AI boundary.
- Export flow and markdown transcript generation.
- Full automated Autopilot loop scheduler/background leasing.

## Architecture impact assessment

- Preserves dependency direction: renderer -> preload -> IPC handlers -> councils slice -> services.
- Adds pure runtime orchestration helpers in shared code (`src/shared/*`) with no IO.
- Keeps SDK/provider-specific details behind `AiService`; councils slice only consumes text outputs.
- Maintains cancellation semantics through existing abort-controller registry.

## Step-by-step implementation plan

1. Add shared pure runtime prompt/decision helper module for conductor briefing/goal requests.
2. Extend `councils/slice.ts` with conductor decision parsing + invocation helper.
3. Integrate helper into manual-member turn and conductor-injection flows to persist briefing/goal updates.
4. Integrate helper into autopilot turn flow and enforce no-consecutive rules with algorithmic fallback when only one member remains.
5. Add autopilot pause-on-provider-error state transition for runtime generation/orchestration failures.
6. Update and add tests (`councils-handlers.integration.spec.ts` and unit helpers where appropriate).
7. Update `docs/status.md` traceability to reflect newly covered requirement IDs and test mappings.

## Risks and mitigations

- Risk: conductor response parsing could be brittle.
  - Mitigation: enforce strict JSON envelope in prompt and provide deterministic parse errors with safe user messages.
- Risk: new conductor calls could regress existing manual/autopilot UX.
  - Mitigation: keep IPC response shapes unchanged and validate via current integration + electron diagnostics.
- Risk: fake AI output in diagnostics may not satisfy new conductor format.
  - Mitigation: adjust runtime fake AI behavior in composition only as needed to emit valid conductor decision JSON.

## Coverage matrix

| Requirement IDs | Planned tests | Validation intent |
| --- | --- | --- |
| R3.13, R3.14, R3.15, R3.27 | `tests/integration/councils-handlers.integration.spec.ts` | Conductor briefing+goal update happens after each new manual/conductor message and persists final briefing state |
| R3.19, R3.20, R3.21 | `tests/integration/councils-handlers.integration.spec.ts` | Autopilot turn progression respects no-consecutive speaker rule and algorithmic single-eligible fallback |
| R3.24, R8.3 | `tests/integration/councils-handlers.integration.spec.ts` | Autopilot provider/generation error transitions council to paused while preserving stable transcript |
| E1, E2 | `tests/unit/*` + `tests/integration/*` | Prompt/decision helper remains pure and orchestration keeps Result-based error modeling |

## Validation commands

- `bun run lint`
- `bun run typecheck`
- `bun run test:unit`
- `bun run test:integration`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/councils-ui.json`

## Rollback strategy

- Revert conductor orchestration helper and slice integration points.
- Keep persisted briefing schema unchanged; existing runtime flows continue with prior simple briefing placeholder behavior.
