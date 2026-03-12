# Plan 056: Assistant Slice 1 Final Blockers

## Objective
Close the remaining Slice 1 blockers by fully redacting assistant path-like text that includes spaces and by rejecting assistant submits whose context view scope does not match the session-scoped view kind.

## Scope
- Tighten assistant path-like text detection/redaction for context, request, response, planner output, and audit payload sanitization.
- Enforce assistant session/view-kind consistency in the main assistant slice before planning or settings-view resolution.
- Add focused unit/integration coverage for both blockers.

## Non-goals
- No renderer assistant UI changes.
- No tool execution implementation beyond existing planner/result scaffolding.
- No unrelated traceability or requirement document edits beyond what this fix requires.

## Architecture impact assessment
- Preserves `A3` by keeping trust-boundary sanitization and session-scope validation in shared/main contracts.
- Preserves `R9.4` and `R9.19` by preventing partial raw path leakage across IPC/audit payloads.
- Preserves `R9.22` by rejecting cross-view session reuse before planner/model-resolution work can run against the wrong scope.

## Step-by-step implementation plan
1. Replace the assistant path-like regexes with a redaction pattern that consumes multi-token filesystem-like values, including paths with spaces.
2. Add focused sanitizer tests that prove space-bearing paths are fully redacted.
3. Reject assistant submits when `request.context.viewKind` differs from the stored session `viewKind`, and avoid resolving settings/planning for mismatched scope.
4. Add focused integration coverage for the view-kind mismatch rejection.
5. Refresh status/traceability artifacts if the updated test coverage changes generated mappings.

## Risks and mitigations
- Risk: broader path detection could over-redact nearby prose.
  - Mitigation: stop redaction at common sentence connectors/punctuation and cover representative cases in tests.
- Risk: rejecting mismatched view kinds could surface a new failure message path.
  - Mitigation: return a stable safe result shape and verify the planner is not invoked.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| `R9.4`, `R9.19`, `A3`, `F2` | `fully redacts path-like values that contain spaces` | Verify assistant sanitization removes full filesystem-like strings instead of leaving trailing fragments |
| `R9.3`, `R9.4`, `R9.22`, `A3` | `rejects submits whose context view kind does not match the session scope` | Verify assistant sessions cannot be reused across view scopes and that planning/settings lookup fail closed |

## Validation commands to run
- `bun test tests/unit/assistant-audit.spec.ts tests/unit/assistant-ipc-validators.spec.ts tests/integration/assistant-ipc.contract.integration.spec.ts`
- `bun run typecheck`
- `bun run trace:generate`
- `bun run check:traceability`

## Rollback strategy
- Revert the assistant sanitizer, slice, focused test, and traceability/status updates together so Slice 1 returns to the previous contract.
