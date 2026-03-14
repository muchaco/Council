# Plan 061: Assistant Slice 5 Review Fixes

## Objective
Close the Slice 5 review blockers so current-draft save flows commit through authoritative main-owned handlers, current-draft update rewrites preserve the full requested payload, and commit-style reconciliation only completes after saved model/member visibility is confirmed.

## Scope
- Limit changes to Slice 5 assistant commit/draft reconciliation code, focused tests, and status/docs updates.
- Fix `saveAgentDraft` and `saveCouncilDraft` so main executes the authoritative save before renderer reconciliation.
- Fix current-draft rewrites for `updateAgent` and `updateCouncilConfig` so model/member fields are preserved.
- Extend commit-tool outputs so renderer reconciliation can verify authoritative saved model/conductor/member fields before final success.

## Non-goals
- No expansion of the assistant tool catalog beyond Slice 5.
- No redesign of non-Slice-5 navigation/runtime/destructive flows.
- No unrelated renderer/editor refactors.

## Architecture impact assessment
- Keep main authoritative for persisted mutations (`A1`, `A3`) by executing assistant saves through existing `saveAgent` / `saveCouncil` handlers in `src/main/features/assistant/slice.ts`.
- Keep renderer reconciliation limited to visible-state confirmation by reloading/navigating editors after the authoritative save already succeeds.
- Preserve draft-edit boundaries by passing current editor draft snapshots only as typed assistant execution input; do not create a renderer-only persistence path.

## Step-by-step implementation plan
1. Extend the assistant submit contract with an optional execution snapshot for the current visible agent/council draft.
2. Feed the snapshot from renderer assistant context state into submit calls without changing planner-visible context behavior.
3. Update main assistant execution to carry forward in-flight draft patch state and use it when `saveAgentDraft` / `saveCouncilDraft` call authoritative save handlers.
4. Update renderer reconciliation so save reconciliation only refreshes/navigates the visible editor after main has already saved.
5. Expand draft patch schemas/adapters so rewritten current-draft updates preserve model/member fields.
6. Extend commit-tool outputs plus renderer reconciliation checks so create/update/save waits for visible saved model/conductor/member fields.
7. Add focused integration/unit coverage for authoritative save execution, rewrite preservation, and visible saved-field confirmation.

## Risks and mitigations
- Risk: current-draft save may use stale data if sequential draft patches are not folded in. Mitigation: update execution-local snapshot after successful draft patch tools before save.
- Risk: renderer stays on stale state after same-entity save. Mitigation: add same-editor refresh adapters and wait for clean visible state before reconciliation success.
- Risk: wider IPC contract churn. Mitigation: keep the new execution snapshot optional and scoped to assistant submit only.

## Coverage matrix
- `R9.11`, `R9.17`, `R9.18`, `R9.22`, `A1`, `A3` -> `patches the current council draft and then saves it through the normal save flow` -> prove main saves authoritative merged draft before reconciliation completes.
- `R9.11`, `R9.14`, `R9.17`, `R9.22`, `A1`, `A3` -> `preserves model changes when rewriting a current-agent update into an in-place draft patch` -> prove rewrite keeps `modelRefOrNull`.
- `R9.11`, `R9.14`, `R9.17`, `R9.22`, `A1`, `A3` -> `preserves conductor and member changes when rewriting a current-council update into an in-place draft patch` -> prove rewrite keeps `conductorModelRefOrNull` and `memberAgentIds`.
- `R9.17`, `R9.18`, `R9.22`, `A1`, `A3` -> `requires authoritative saved agent model fields to become visible before reconciliation completes` -> prove renderer checks authoritative saved model payload, not just clean-draft state.
- `R9.17`, `R9.18`, `R9.22`, `A1`, `A3` -> `requires authoritative saved council conductor and member fields to become visible before reconciliation completes` -> prove renderer checks authoritative saved conductor/member payload, not just clean-draft state.

## Validation commands to run
- `bun run lint`
- `bun run typecheck`
- `bun test tests/integration/assistant-ipc.contract.integration.spec.ts tests/unit/assistant-shell-controller.spec.ts tests/unit/assistant-reconciliation-helpers.spec.ts`

## Rollback strategy
- Revert this plan's code changes and restore the previous Slice 5 assistant save/rewrite behavior if regressions appear outside the focused assistant commit flows.
