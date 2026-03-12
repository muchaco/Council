# Plan 052: Assistant UI Reconciliation Matrix

## Objective
Document how assistant actions keep the renderer visibly in sync with authoritative app mutations so the user can always see the result of completed work.

## Scope
- Define UI reconciliation principles for assistant-driven execution.
- Document the action-to-sync matrix for major assistant tool categories.
- Define source-of-truth rules, renderer update expectations, and failure handling.
- Link this guidance into the existing assistant PRD and architecture spike.

## Non-goals
- No implementation of subscriptions, events, cache invalidation, or renderer state changes.
- No final decision on exact IPC event shapes.
- No replacement of the assistant architecture spike; this complements it.

## Architecture impact assessment
- This work is primarily about renderer/main coordination after assistant actions complete.
- It preserves the existing architecture by keeping domain mutations in existing handlers while adding explicit UI reconciliation expectations for visible state.
- It prevents the assistant from becoming "correct in storage but invisible in UI," which would undermine user trust.

## Step-by-step implementation plan
1. Define reconciliation principles: authoritative state, visible state, and completion semantics.
2. Document recommended sync behavior for read, navigation, draft-edit, commit, runtime, and bulk tools.
3. Define what "done" means for the assistant from the user's perspective.
4. Add follow-up implementation notes for eventing, refresh, and navigation decisions.
5. Update planning/status docs to reference the matrix.

## Risks and mitigations
- Risk: mutation succeeds but stale renderer state hides the result.
  - Mitigation: require every mutating tool to declare its reconciliation behavior.
- Risk: renderer-only edits diverge from authoritative state.
  - Mitigation: keep draft-edit tools explicit and pair them with save/refresh semantics.
- Risk: over-refresh creates jarring UX.
  - Mitigation: define preferred reconciliation per screen and action, not a blanket full reload.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| R9.17, R9.18, R9.22, U18.8, U18.10, U18.11 | `assistant action completion keeps visible ui state aligned with executed results` | Future implementation should verify that successful assistant actions are reflected in the visible screen before the assistant reports completion |
| R9.14, R9.16, U18.12, U18.13 | `assistant draft and navigation reconciliation handles unsaved state cancellation and context correctly` | Future implementation should verify safe handling of dirty drafts, close/cancel, and context-preserving transitions |

## Validation commands to run
- Documentation review only for this matrix.

## Rollback strategy
- Revert the documentation-only reconciliation matrix and references if product direction changes.
