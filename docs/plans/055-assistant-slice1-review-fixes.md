# Plan 055: Assistant Slice 1 Review Fixes

## Objective
Close the Slice 1 assistant review blockers by tightening the assistant IPC text/context contract, validating planner output against the shared tool registry before it crosses IPC, removing raw request text from assistant audit storage/logging, and scoping cancel/close operations to the owning `webContents` when available.

## Scope
- Normalize or reject unsafe path-like strings in `AssistantContextEnvelope` before assistant payloads cross IPC.
- Sanitize assistant submit/clarification text at the IPC boundary before main-process planning consumes it.
- Validate/sanitize planner planned calls against the shared tool registry before returning them to the renderer.
- Replace raw assistant request/clarification audit storage with sanitized summaries and metadata only.
- Scope assistant cancel/close session commands to the owning `webContents`.
- Update focused assistant unit/integration tests and status/traceability docs.

## Non-goals
- No renderer assistant UI work.
- No new assistant tools or planner execution behavior beyond existing Slice 1 scaffolding and planner-output validation.
- No durable audit persistence schema changes beyond the current logger-backed service.

## Architecture impact assessment
- Keeps `A3` intact by validating/sanitizing assistant IPC payloads in shared/main contracts before slice logic consumes them.
- Keeps `D5` intact by ensuring renderer-facing/session-control operations remain scoped to the originating `webContents`.
- Keeps `F2` intact by preventing raw prompt/request text from being stored in assistant audit payloads.

## Step-by-step implementation plan
1. Extend assistant sanitization helpers with request/response audit-summary builders and reusable text redaction.
2. Apply assistant context plus submit/clarification text normalization at the shared IPC schema boundary.
3. Validate planner planned calls against the shared tool registry and sanitize safe payloads before returning them over IPC.
4. Update assistant slice audit payloads to record metadata summaries instead of raw request/clarification text.
5. Thread `webContentsId` through assistant cancel/close handlers and enforce owner checks in the slice.
6. Update focused unit/integration tests for IPC normalization, planner-output validation, audit summaries, and owner-scoped cancellation/close behavior.
7. Refresh `docs/status.md` and generated traceability artifacts.

## Risks and mitigations
- Risk: over-broad path detection could redact legitimate UI labels.
  - Mitigation: limit normalization to clear filesystem-like patterns and cover with validator tests.
- Risk: owner-scoped cancel/close could break lifecycle cleanup.
  - Mitigation: keep `releaseWebContentsSessions()` using the owning `webContentsId` so teardown still succeeds.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| `R9.4`, `R9.19`, `A3` | `normalizes unsafe assistant context strings before they cross ipc` | Verify unsafe path-like values are sanitized at the shared IPC boundary |
| `R9.4`, `R9.19`, `A3` | `sanitizes assistant submit text before it reaches main` | Verify raw request/clarification text is redacted at the shared IPC boundary |
| `R9.9`, `R9.11`, `R9.13`, `R9.14`, `R9.22`, `A1` | `sanitizes valid planned call payloads before returning them` | Verify planner tool calls are registry-validated and redacted before renderer return |
| `R9.9`, `R9.11`, `R9.13`, `R9.14`, `R9.22`, `A1` | `maps unknown planner tools to a safe failure result` | Verify unknown planner tools fail closed instead of crossing IPC |
| `R9.19`, `R9.20`, `A3`, `F2` | `summarizes assistant request text instead of persisting it` | Verify audit helpers retain metadata without storing raw request text |
| `R9.16`, `R9.21`, `A3`, `D5` | `scopes cancel and close operations to the owning webcontents session` | Verify non-owner renderers cannot cancel or close another renderer's assistant session |

## Validation commands to run
- `bun test tests/unit/assistant-audit.spec.ts tests/unit/assistant-ipc-validators.spec.ts tests/unit/assistant-plan-schema.spec.ts --runInBand`
- `bun test tests/integration/assistant-ipc.contract.integration.spec.ts --runInBand`
- `bun run typecheck`
- `bun run trace:generate`
- `bun run check:traceability`

## Rollback strategy
- Revert the assistant sanitizer, validator, slice, handler, and test changes together so Slice 1 returns to its prior contract and audit behavior.
