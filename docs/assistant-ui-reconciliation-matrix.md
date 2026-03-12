# Assistant UI Reconciliation Matrix

## 1. Purpose
This document defines how assistant actions must reconcile authoritative app state with visible renderer state.

The goal is simple:
- the assistant must never report a task as complete while the UI still appears unchanged or stale.

## 2. Core principle
Assistant execution has two success conditions:
1. the real app action completed successfully in the authoritative layer, and
2. the user can see the resulting state in the renderer.

If only condition 1 is true, the assistant is not done yet.

## 3. Terms
- `authoritative state`: persisted or accepted app state owned by existing handlers/services.
- `visible state`: the screen, draft, list, badges, runtime controls, and entity content currently shown to the user.
- `reconciliation`: the work needed after an assistant step so visible state matches authoritative state.
- `completion-ready`: a step is allowed to be presented as done because both authoritative and visible state are aligned.

## 4. Reconciliation rules

### 4.1 Global rules
- Every mutating assistant tool must define a reconciliation strategy.
- The assistant should prefer the least-jarring visible sync that still makes the result obvious.
- Reconciliation may use navigation, local draft updates, list refresh, detail reload, or runtime-state refresh depending on the action.
- "Done" means completion-ready, not merely persisted.
- If reconciliation fails after a successful mutation, the assistant must report `completed but not yet visible` and trigger a safe refresh/reload path instead of silently claiming success.

### 4.2 Preferred reconciliation order
1. Update the currently visible draft/state directly if that is the source the user is working in.
2. Refresh the smallest affected view model or query.
3. Navigate to the affected entity when that best communicates success.
4. Fall back to a broader screen reload only when narrower reconciliation is unavailable.

## 5. Source-of-truth rules by interaction type

### 5.1 Existing visible draft is the source of truth
Use renderer-visible draft tools when:
- the user is already in an Agent editor and asks to change that Agent draft,
- the user is already in a Council editor and asks to change that Council draft,
- the assistant is helping complete a form before save.

In these cases:
- the visible draft must update immediately,
- the assistant should describe the draft change before or while applying it,
- save remains a distinct action unless the user requested saving too.

### 5.2 Persisted domain state is the source of truth
Use main-process command/query tools when:
- the action creates, archives, restores, deletes, exports, or resumes something,
- the action spans multiple entities,
- the action depends on runtime or persistence constraints.

In these cases:
- the assistant must explicitly reconcile the affected view afterward.

## 6. Action matrix

| Assistant action category | Example actions | Authoritative source of truth | Preferred reconciliation behavior | User-visible completion state | Notes / edge cases |
| --- | --- | --- | --- | --- | --- |
| Read-only query | `listCouncils`, `getAgent`, `getCouncilRuntimeState` | Main query handlers | No special reconciliation; render answer and optionally highlight current context | Assistant answer matches current screen context | If visible screen is stale relative to current query, assistant may trigger a lightweight refresh before answering |
| Navigation | `navigateToHomeTab`, `openCouncilView`, `openAgentEditor` | Renderer route/view state | Navigate and wait until destination screen data is loaded | User is on the expected screen with stable data | Navigation is not complete when route changes alone; destination data must be ready |
| List query update | `setHomeQuery`, `resetHomeQuery` | Renderer query state plus list query results | Update query UI, trigger list refresh, wait for loaded results state | Search/filter controls and list results reflect the new query | Draft-based query UIs must preserve apply/refresh semantics where required |
| Current editor draft update | `setAgentDraftFields`, `setCouncilDraftFields` | Renderer draft state | Patch the visible draft immediately | User sees fields changed in the editor | Do not bypass the visible draft by persisting behind the editor |
| Draft membership/tag edit | `addCouncilDraftMember`, `removeCouncilDraftMember`, draft tag edits | Renderer draft state | Update visible member/tag lists immediately | Member/tag chips/rows reflect the change | If a requested draft change is invalid, show the same validation block as manual UI |
| Save current draft | `saveAgentDraft`, `saveCouncilDraft` | Existing save handlers in main | Persist, then refresh/reload current entity state and clear dirty state if save succeeded | User sees saved data, success state, and no stale draft indicator | If save returns validation errors, keep user on draft and surface those errors inline |
| Create new entity | `createAgent`, `createCouncil` | Existing create handlers in main | Persist, then either open the created entity or refresh the relevant list and reveal it | User can see the new Agent/Council in context | Preferred default: open the created entity when the request is object-centric; refresh list when it is bulk/list-centric |
| Single-entity update outside current editor | `updateAgent`, `updateCouncilConfig` | Existing update handlers in main | Refresh the currently visible detail view if open; otherwise refresh affected list item or navigate to entity | User sees updated values on the relevant screen | Avoid hidden background mutations with no visible destination |
| Archive / restore single entity | `archiveAgent`, `restoreCouncil` | Existing archive/restore handlers in main | Refresh the current detail/list state and badges; if current filter hides the item after change, explain and navigate or refresh accordingly | User sees the updated archived state or understands why the item disappeared from the filtered list | A disappearing item is acceptable only if the assistant explains it |
| Delete single entity | `deleteAgent`, `deleteCouncil` | Existing delete handlers in main | After confirmed deletion, navigate away from deleted detail views and refresh affected lists | User is no longer viewing a deleted object and sees the post-delete state | Never leave the user on a dead detail screen |
| Bulk list mutation | `archiveCouncilsByTag`, `restoreFilteredAgents`, bulk delete | Existing bulk-capable orchestration over existing handlers | Execute, refresh the list query, show affected counts, and preserve or explain current filters | User sees list results changed to match the action | Strong confirmation required before execution |
| Runtime action | `startCouncil`, `pauseCouncil`, `resumeCouncil`, `cancelCouncilGeneration` | Existing runtime handlers and runtime state | Refresh Council View runtime state, controls, notices, and transcript shell as needed | User sees new runtime status and available controls | Completion must wait for visible status transition, not just command acceptance |
| Manual runtime intervention | `selectManualSpeaker`, `sendConductorMessage` | Existing runtime handlers | Refresh runtime state and transcript/briefing region after command settles | User sees the resulting runtime change in Council View | If command produces delayed model work, show in-progress state clearly |
| Export | `exportCouncil` | Existing export handler | Show resulting success/failure feedback in current screen; do not expose raw filesystem path | User sees export success feedback | If the product later supports opening exported location, it must still honor raw-path restrictions |
| Settings change | `saveProviderConfig`, `disconnectProvider`, `refreshModelCatalog`, `setGlobalDefaultModel` | Existing settings handlers | Refresh the affected settings cards/forms/model pickers and invalid-config badges | User sees updated provider/model/default state | Provider mutations are high-trust and should confirm when scope is broad |

## 7. Unsaved changes matrix

| User situation | Assistant intent | Required behavior |
| --- | --- | --- |
| Dirty editor, request targets current draft | Modify current draft | Update visible draft in place; no discard confirmation needed |
| Dirty editor, request implies save of current draft | Save current draft | Validate and save through normal handler; keep inline validation if blocked |
| Dirty editor, request targets a different entity or screen | Navigate away or replace draft | Require explicit confirmation before leaving or replacing the draft |
| Dirty editor, request can be satisfied without leaving | Stay on current object | Prefer the non-destructive in-place path |

## 8. Completion semantics

### 8.1 A step can be shown as `done` only when
- mutation/query returned success,
- required follow-up refresh/navigation finished,
- the resulting screen or draft is visibly aligned.

### 8.2 A step should be shown as `completed with follow-up refresh` when
- the mutation succeeded,
- the first reconciliation attempt did not make the result visible,
- the assistant is now reloading or navigating to make the result visible.

### 8.3 A step should be shown as `partial` when
- the authoritative change succeeded,
- some requested visible outcomes could not be completed,
- the assistant can explain the exact remaining gap.

## 9. Eventing and refresh guidance
- Prefer explicit targeted refresh calls over blind full-screen remounts.
- Tools that mutate entities should return enough metadata for reconciliation, such as `entityId`, `affectedIds`, `shouldOpenDetail`, or `shouldRefreshListKind`.
- Renderer should treat assistant reconciliation as first-class UI work, not as an afterthought appended to the modal.
- If the product later adds event subscriptions, they can reduce manual refresh steps, but assistant tools should still define expected visible completion behavior.

## 10. Recommended implementation contract
Each mutating assistant tool should declare:

```ts
type AssistantToolReconciliation = {
  visibleTarget: "current-draft" | "current-list" | "detail-view" | "runtime-view" | "settings-view";
  strategy: "patch-local" | "refresh-query" | "reload-entity" | "navigate-and-load";
  successCondition: string;
};
```

This makes visible completion part of the tool contract rather than tribal knowledge.

## 11. Recommended product rule
The assistant should never say "done" unless the user can already see the result or the assistant explicitly states why a final visible transition is still in progress.

That rule is the trust boundary for the whole feature.
