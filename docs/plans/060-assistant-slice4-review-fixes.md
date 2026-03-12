## Objective

Close the Slice 4 blocking review issues by letting current-draft tools target the visible editor without redundant saved IDs, preserving typed draft reconciliation completion metadata through renderer -> main finalization, and tightening the slice diagnostics/docs around the updated contract.

## Scope

- Assistant Slice 4 main/renderer/shared draft-reconciliation files.
- Focused assistant integration/unit coverage and the current-draft diagnostic scenario.
- `docs/status.md` traceability/status notes for this review pass.

## Non-goals

- Adding new assistant tool categories beyond the current Slice 4 subset.
- Broad navigation/session refactors outside the current-draft reconciliation path.
- Expanding Electron diagnostics beyond the existing assistant draft scenario.

## Architecture impact assessment

- Keeps assistant tool execution and scope validation in main while allowing omitted draft IDs to resolve against the current renderer scope only.
- Preserves renderer-owned visibility reconciliation by keeping draft patch application local to the visible editor and returning typed completion metadata back through IPC.
- Maintains safe scope boundaries by still failing mismatched explicit entity IDs and non-matching view kinds closed.

## Step-by-step implementation plan

1. Relax current-draft targeting so omitted `entityId` values resolve against the visible editor while explicit mismatches still fail.
2. Update renderer draft adapters to treat `null` as the current visible draft instead of a mismatch for saved entities.
3. Refresh stale reconciliation copy/tool descriptions so draft-edit reconciliation messaging matches the actual flow.
4. Add focused integration coverage for `setCouncilDraftFields` and renderer-shell coverage proving non-null completion metadata reaches `completeReconciliation`.
5. Update the current-draft assistant scenario to exercise the omission-based contract and run focused validation.

## Risks and mitigations

- Risk: omitted draft IDs could accidentally patch the wrong scope.
  - Mitigation: main still requires the expected view kind and only resolves omitted IDs against the active visible entity for that editor.
- Risk: renderer adapters could accept stale explicit IDs.
  - Mitigation: adapters continue to reject non-null IDs that do not match the visible draft.
- Risk: completion metadata could be dropped between renderer and main.
  - Mitigation: add shell-controller coverage that asserts non-null completion payloads are forwarded unchanged into `completeReconciliation`.

## Coverage matrix

| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| `R9.11`, `R9.14`, `R9.17`, `R9.18`, `R9.22`, `A1`, `A3` | `keeps current agent draft edits pending until renderer reconciliation acknowledges completion metadata` | Verify omitted agent `entityId` values still target the visible saved editor safely |
| `R9.11`, `R9.14`, `R9.17`, `R9.18`, `R9.22`, `A1`, `A3` | `keeps current council draft edits pending until renderer reconciliation acknowledges completion metadata` | Verify council draft-edit reconciliation is covered end to end with typed completion metadata |
| `R9.17`, `R9.18`, `R9.22`, `U18.7`, `U18.10`, `U18.11` | `forwards draft reconciliation completion metadata into the final reconciliation request` | Verify renderer shell passes non-null completion payloads through to main finalization |

## Validation commands to run

- `bun test tests/integration/assistant-ipc.contract.integration.spec.ts tests/unit/assistant-shell-controller.spec.ts`
- `bun run typecheck`
- `bun run trace:generate`

## Rollback strategy

- Revert the current-draft targeting and adapter updates together so omitted-ID draft requests do not diverge between main validation and renderer reconciliation.
