# Plan 058: Assistant Slice 2 Review Fixes

## Objective
Close the Slice 2 blocking review issues by making renderer assistant sessions scope-safe across navigation, failing closed when Stop lands before `sessionId` creation finishes, hardening modal focus return, and adding assistant-specific UI-shell diagnostics coverage.

## Scope
- Reset renderer-side assistant follow-up state when the visible assistant scope changes.
- Prevent stale async assistant completions from writing clarify/confirm/result state into a new scope.
- Invalidate in-flight assistant setup immediately when Stop is pressed before `createSession` finishes.
- Return focus to a visible assistant launcher or safe fallback after modal close, including after a view switch.
- Add minimal assistant-specific unit and Electron diagnostic coverage for launcher visibility and modal keyboard/focus behavior.

## Non-goals
- No new assistant tool execution features.
- No main-process planner redesign beyond existing session close usage.
- No broader renderer navigation refactor outside the assistant shell.

## Architecture impact assessment
- Preserves `A1`, `A3`, and `D5` by keeping all assistant execution on the existing typed IPC path while making renderer scope changes fail closed.
- Preserves `R9.21` by closing stale sessions when the visible assistant scope changes.
- Keeps changes inside the Slice 2 renderer shell, assistant diagnostics, and traceability/status docs.

## Step-by-step implementation plan
1. Add a renderer assistant scope key so modal state can be rebased safely when the active screen context changes.
2. Guard async create/submit completions so stale responses cannot repopulate a rebased modal.
3. Fail Stop closed even before a session ID exists so pending `createSession` work is invalidated immediately.
4. Harden focus restoration to prefer the current visible launcher and fall back to another visible focus target.
5. Add focused unit coverage for scope rebasing and pre-session Stop invalidation, plus Electron diagnostics for launcher visibility and modal focus/keyboard behavior across a view switch.
6. Refresh `docs/status.md` and generated traceability outputs.

## Risks and mitigations
- Risk: scope rebasing could discard benign unsent text too aggressively.
  - Mitigation: preserve idle draft input only, while clearing action-bearing follow-up phases.
- Risk: focus fallback could target hidden UI.
  - Mitigation: filter candidates by visibility and hidden ancestors before focusing.
- Risk: Electron diagnostics could be flaky if they depend on planner behavior.
  - Mitigation: stub assistant IPC methods inside the scenario so launcher/modal behavior stays deterministic.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| `R9.17`, `R9.21`, `U18.12`, `U18.14` | `rebases assistant state to a new scope without replaying stale follow-up work` | Verify renderer scope changes clear stale follow-up state and reject stale async updates |
| `R9.17`, `R9.21`, `U18.12`, `U18.14` | `invalidates session setup work after stop before session creation finishes` | Verify Stop increments the async token and cancels planning even when no session ID exists yet |
| `R9.1`, `R9.2`, `R9.17`, `R9.21`, `U18.1`, `U18.3`, `U18.6`, `U18.12`, `U18.14` | `assistant-shell-scope-guard` | Verify launcher visibility, modal clarify reset on view switch, Enter send, Escape close, and focus return |

## Validation commands to run
- `bunx vitest run --config vitest.unit.config.ts tests/unit/assistant-ui-state.spec.ts`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/assistant-shell-scope-guard.json`
- `bun run lint`
- `bun run typecheck`

## Rollback strategy
- Revert the renderer assistant scope/focus changes, the focused unit test, the assistant Electron scenario, and the status/traceability updates together.
