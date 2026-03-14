## Objective

Close the remaining Slice 4 blockers by preventing assistant current-draft patches from reporting success in read-only/invalid editor contexts and by making the current-draft Electron scenario exercise a deterministic live path through the real preload bridge.

## Scope

- Slice 4 assistant main/renderer/shared draft-edit files.
- Focused Slice 4 unit/integration coverage and the `assistant-current-draft-assist.json` scenario.
- `docs/status.md` updates for the blocker closure.

## Non-goals

- New assistant tool categories or broader planner capabilities.
- General assistant runtime refactors outside the current-draft path.
- Unrelated editor UX fixes outside the assistant draft-edit guardrails.

## Architecture impact assessment

- Keeps main responsible for validating whether a current-draft mutation is safe before reporting reconciling success.
- Keeps renderer-owned draft patch application local, but mirrors the same read-only/save-rule guards so visible state never drifts from main expectations.
- Preserves the preload-only Electron boundary by removing scenario-time mutation of `window.api.assistant.*` functions.

## Step-by-step implementation plan

1. Add shared draft-edit guard helpers that describe read-only/invalid current-editor mutation contexts for agent and council draft tools.
2. Apply those guards in main assistant tool execution before returning reconciling results.
3. Apply the same guards in renderer draft adapters before mutating visible editor state.
4. Add a deterministic current-draft planner shortcut for the scenario's live draft-assist request.
5. Update focused tests, refresh the Electron scenario, and update `docs/status.md` plus generated traceability.

## Risks and mitigations

- Risk: renderer/main draft-edit rules drift again.
  - Mitigation: centralize the guard rules in shared helpers and cover them with focused tests.
- Risk: the deterministic scenario path bypasses normal assistant safety checks.
  - Mitigation: keep it inside main planner orchestration after the standard session/context/config checks.
- Risk: council edit rules remain too loose for saved drafts.
  - Mitigation: explicitly block archived saved councils and saved-council mode changes, matching current UI/save constraints.

## Coverage matrix

| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| `R9.11`, `R9.14`, `R9.22`, `A1`, `A3` | `fails current draft edits when the current agent editor is archived` | Verify assistant current-draft edits fail closed for read-only agent editors |
| `R9.11`, `R9.14`, `R9.22`, `A1`, `A3` | `fails current draft edits when the current council editor is archived or mode-locked` | Verify assistant current-draft edits fail closed for non-persistable council editor contexts |
| `R9.1`, `R9.11`, `R9.14`, `R9.17`, `U18.7`, `A1`, `D5` | `builds a deterministic current agent draft shortcut plan` | Verify the live Electron scenario request can exercise the real current-draft assist path without preload mutation seams |

## Validation commands to run

- `bun test tests/integration/assistant-ipc.contract.integration.spec.ts tests/unit/assistant-draft-edit-guards.spec.ts tests/unit/assistant-planner-shortcuts.spec.ts`
- `bun run typecheck`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/assistant-current-draft-assist.json`
- `bun run trace:generate`

## Rollback strategy

- Revert the shared guard helper, assistant slice, renderer adapter, and scenario updates together so main validation, renderer reconciliation, and diagnostics stay aligned.
