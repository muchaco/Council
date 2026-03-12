# Plan 057: Assistant Session Concurrency Guard

## Objective
Close the remaining Slice 1 blocker by making same-session assistant submits execution-safe while preserving existing cancel and close behavior.

## Scope
- Prevent a second submit from taking ownership of an active session execution.
- Ensure stale completions cannot clear or outlive a newer active execution after cancel or close.
- Add focused integration coverage for concurrent-submit rejection and stale-completion cleanup safety.

## Non-goals
- No renderer assistant UI changes.
- No planner/tool execution feature expansion.
- No broader assistant lifecycle redesign outside the Slice 1 in-memory session shell.

## Architecture impact assessment
- Preserves `A3` and `D5` by keeping abort ownership in the main-process assistant slice.
- Preserves session-scoped cancellation semantics by ensuring only the currently active execution can be cancelled or cleared.
- Keeps domain/service boundaries unchanged because the change is confined to slice-local session bookkeeping.

## Step-by-step implementation plan
1. Replace the single session abort-controller slot with execution metadata that can distinguish the active submit from stale completions.
2. Reject concurrent same-session submits before planner work starts.
3. Clear active execution state only when the finishing submit still owns the session execution token.
4. Add focused integration tests for concurrent rejection and cancel-then-resubmit stale-completion safety.

## Risks and mitigations
- Risk: a rejected concurrent submit could surface an unstable result shape.
  - Mitigation: return the existing safe assistant result envelope with a stable state-violation message.
- Risk: stale async completions could still mutate session timestamps after close.
  - Mitigation: gate cleanup on execution ownership and assert close still cancels the newer submit in tests.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| `R9.3`, `R9.20`, `R9.21`, `A3`, `D5` | `rejects a second concurrent submit for the same session` | Verify same-session submits fail closed instead of replacing the active abort owner |
| `R9.20`, `R9.21`, `A3`, `D5` | `keeps a stale cancelled submit from clearing newer in-flight work` | Verify stale async completions cannot clear the newer execution before close/cancel runs |

## Validation commands to run
- `bunx vitest run --config vitest.integration.config.ts tests/integration/assistant-ipc.contract.integration.spec.ts`
- `bun run typecheck`

## Rollback strategy
- Revert the slice concurrency bookkeeping, focused integration tests, and this plan file together.
