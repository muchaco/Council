## Objective

Close the Slice 3 blocking review issues by restoring global-default-model planning, moving navigation completion semantics back under main ownership through typed renderer acknowledgements, and failing final assistant outcomes closed when visible navigation never reconciles.

## Scope

- Assistant Slice 3 main/renderer/shared IPC contract files.
- Focused assistant integration/unit tests and the Slice 3 diagnostic scenario/docs references.
- `docs/status.md` traceability/status notes for the slice.

## Non-goals

- Adding new assistant tool categories beyond the current read/navigation subset.
- Broad renderer routing changes outside the assistant flow.
- Expanding provider/model management beyond the existing global default model contract.

## Architecture impact assessment

- Keeps model/provider resolution in main by requiring planner requests to use the settings-backed global default model only.
- Preserves renderer -> preload -> main IPC boundaries by introducing a typed assistant reconciliation acknowledgement IPC instead of exposing main internals to renderer.
- Keeps navigation visibility owned by renderer, but moves completion semantics back to main by requiring typed reconciliation acknowledgements before final success is returned.

## Step-by-step implementation plan

1. Remove the hard-coded local assistant planner fallback and gate planner execution on a valid global default model.
2. Add typed assistant reconciliation acknowledgement DTOs, validators, preload/window API wiring, and main IPC handlers.
3. Change assistant execution so navigation tools return pending reconciliation state until renderer visibility is acknowledged.
4. Update renderer assistant control flow to perform navigation reconciliation, submit acknowledgements, and only apply the final assistant result after main finalizes it.
5. Add focused tests for invalid/missing global default model gating and failed navigation reconciliation.
6. Align the assistant diagnostic scenario naming/docs references and refresh `docs/status.md` for the slice.

## Risks and mitigations

- Risk: reconciliation acknowledgements arrive late or for stale sessions.
  - Mitigation: scope acknowledgements to session ownership, reject missing/mismatched pending reconciliations, and keep async-token guards in renderer.
- Risk: failed navigation leaves the modal claiming success.
  - Mitigation: main converts failed/missing acknowledgements into typed tool failures and recomputes final outcome from finalized execution results only.
- Risk: planner gating blocks previously permissive test flows.
  - Mitigation: update focused integration coverage to assert the intended InvalidConfigError behavior explicitly.

## Coverage matrix

| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| `R9.3`, `A1`, `D1`, `D5` | `fails closed when the global default model is missing or invalid` | Verify assistant planning never falls back to a local planner model and returns typed safe failures instead |
| `R9.17`, `R9.18`, `R9.22`, `U18.8`, `U18.10`, `U18.11` | `finalizes navigation only after renderer reconciliation acknowledgement` | Verify main does not finalize navigation success until renderer confirms the visible destination loaded |
| `R9.17`, `R9.18`, `R9.22`, `U18.8`, `U18.10`, `U18.11` | `fails navigation reconciliation closed when the visible destination never appears` | Verify final assistant outcome is not `success` when renderer cannot reconcile the requested navigation |

## Validation commands to run

- `bun test tests/integration/assistant-ipc.contract.integration.spec.ts tests/unit/assistant-shell-controller.spec.ts`
- `bun run typecheck`

## Rollback strategy

- Revert the assistant reconciliation IPC additions and slice/controller changes together so submit/finalization flow stays consistent.
