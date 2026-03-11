# Plan 048: Council Create Member Modal and Tag Search

## Objective
Generalize the Council View add-member modal flow into the New Council editor so member addition uses the same lightweight picker pattern, and expand picker search to match agent tags in addition to title and description.

## Scope
- Reuse or generalize the existing add-member modal UI so it can power both Council View member adds and New Council member adds.
- Extend the renderer-safe agent option DTO and pure search helper so modal search can match agent tags as well as title and description.
- Replace the New Council checkbox-based member add surface with a selected-members section plus modal-driven add flow.
- Add focused automated coverage for tag-aware picker filtering and the New Council member-picker flow.
- Update `docs/status.md`, regenerate traceability artifacts, and keep requirement wording aligned.

## Non-goals
- No change to council persistence semantics, runtime member-mutation rules, or archived-agent enforcement.
- No fuzzy search, ranking service, or backend search endpoint.
- No redesign of the existing Council View members rows beyond the shared modal behavior/search copy.
- No broader Council Editor visual overhaul outside the member-add interaction.

## Architecture impact assessment
- The change stays within existing renderer -> preload -> main DTO boundaries.
- Search behavior remains in a pure shared helper so both Council View and Council Create use identical filtering semantics.
- DTO widening is additive and limited to renderer-safe agent metadata already available from agent records.
- New Council editor state must preserve user-owned local draft changes without introducing extra side effects or backend reads.

## Step-by-step implementation plan
1. Widen `CouncilAgentOptionDto` and the councils slice mapping so each picker option includes agent tags for renderer-side search.
2. Generalize the existing add-member dialog copy and shared helper so search matches normalized name, description, and tag values.
3. Refactor `CouncilEditorScreen.tsx` to manage modal open/search state locally and replace the checkbox add surface with modal-driven adding plus a selected-members list.
4. Preserve existing create constraints by continuing to exclude archived agents from addable results and by keeping member removal/edit interactions local to the draft.
5. Add or update unit coverage for tag-aware filtering and integration/diagnostic coverage for the New Council flow.
6. Refresh `docs/status.md`, regenerate traceability, and run the required validation commands.

## Risks and mitigations
- Risk: Council View and Council Create picker behavior diverge over time.
  - Mitigation: centralize filtering and dialog rendering props in shared logic/components used by both surfaces.
- Risk: adding tags to the picker DTO increases renderer payload noise.
  - Mitigation: keep the field additive, renderer-safe, and scoped to existing agent metadata only.
- Risk: replacing the checkbox list regresses quick removal during draft editing.
  - Mitigation: keep selected members visible in the editor with explicit remove actions and test add/remove draft updates.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| U7.1, U9.7 | `filters addable council members by title description and tags` | Verify the shared picker search matches tags in addition to title/name and description while still excluding existing and archived members. |
| R2.13, U7.1 | `omits archived agents from the new council member selector` | Keep create-view eligibility behavior intact after moving to modal-driven add flow. |
| U7.1 | `councils-ui scenario adds members through the new council modal` | Verify New Council member addition now uses the modal interaction and keeps create flow working end-to-end. |

## Validation commands to run
- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test:unit`
- `bun run test:integration`
- `bun run trace:generate`
- `bun run check:traceability`
- `bun run diag:electron`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/councils-ui.json`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/council-view-right-panel.json`

## Rollback strategy
- Revert the New Council editor member-picker wiring and restore the prior checkbox list while keeping any additive DTO field if harmless.
- If tag search proves undesirable, revert the shared helper to name/description-only matching and remove tag display/search references from the modal.
