# Plan 047: Council View Add Member Modal

## Objective
Replace the inline Council View add-member browser with a modal picker that stays lightweight, keeps member-editing rules unchanged, and adds simple text search across each candidate agent's title and description.

## Scope
- Replace the `Members` card inline add-member expansion with a modal dialog in Council View.
- Render a simple searchable list of addable agents inside the modal.
- Expand the Council View agent-option DTO so the renderer can search and display a short description for each agent candidate.
- Add focused automated coverage for the new search/filter behavior and update the existing Council View Electron scenario.
- Update `docs/ux-requirements.md`, `docs/status.md`, and regenerate traceability artifacts.

## Non-goals
- No change to council member persistence, runtime gating, or add/remove save rules.
- No new backend search endpoint or fuzzy-search service.
- No redesign of the existing member rows, color picker, or manual speaker controls.
- No archived-agent behavior change beyond the existing exclusion from addable results.

## Architecture impact assessment
- The change remains renderer-first: Council View UI stays in `src/renderer/components/council-view/` and continues to call preload APIs only through the existing save flow.
- Shared DTO changes stay additive and flow through the existing `Main -> IPC DTO -> Renderer` contract without introducing new commands or boundary violations.
- Search/filter logic should be extracted into a pure helper so behavior is testable without introducing renderer-side imperative branching in the component.

## Step-by-step implementation plan
1. Update the Council View agent-option contract to include a renderer-safe description field derived from the Agent system prompt.
2. Extract a pure helper that filters addable agents by current council membership, archived state, and normalized title/description search text.
3. Replace the inline `AddMemberPanel` composition with a modal dialog component that contains a simple search input, compact list rows, and add buttons.
4. Keep the existing save callback semantics, but close/reset the modal search state after a successful add and preserve disabled-state messaging when members cannot be edited.
5. Update UX docs/status wording from `subpanel` to `modal`, add requirement-linked automated coverage, and refresh the Council View Electron scenario so it verifies the modal flow.
6. Run the required validation, traceability, and Electron checks.

## Risks and mitigations
- Risk: adding description text to the DTO leaks too much prompt content into a compact picker.
  - Mitigation: reuse the existing system prompt text already visible in Agent cards, keep it renderer-only, and visually clamp it in the modal list.
- Risk: modal local state becomes stale after a council refresh.
  - Mitigation: reset search text and close the dialog after add success; derive results from current props on every render.
- Risk: search semantics drift from the requested title/description behavior.
  - Mitigation: centralize matching in a pure helper and cover exact title match, description match, and empty-state behavior with unit tests.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| U9.7 | `filters addable council members by title and description` | Verify the modal picker search matches candidate agent title/name and description/system prompt text while excluding existing and archived members. |
| U9.7, U9.8, U13.1 | `council-view-right-panel scenario opens add-member modal and adds a member` | Verify the Council View Overview members flow now uses a modal picker without regressing manual-mode controls. |

## Validation commands to run
- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test:unit`
- `bun run test:integration`
- `bun run trace:generate`
- `bun run check:traceability`
- `bun run diag:electron`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/council-view-right-panel.json`

## Rollback strategy
- Revert the modal component and helper changes in Council View while keeping the additive DTO field if needed.
- If the DTO expansion proves undesirable, revert the contract change and return to name-only filtering while restoring the previous inline UI.
