# Plan 046: Tagging UX Standardization

## Objective
Standardize tagging across Agents, Councils, and Council View so every tag-editing and tag-filtering surface feels like one coherent system while preserving the 3-tag cap and the current free-text, no-registry data model.

## Scope
- Replace comma-separated tag text fields in Agent and Council editors with the same chip-based tag editor pattern already used in Council View.
- Consolidate renderer-side tag parsing, validation, inline messaging, and keyboard behavior into shared UI helpers/components.
- Standardize read-only tag rendering in cards and detail/config surfaces.
- Improve tag filtering UX in Agents and Councils home lists without introducing a persistent/global tag registry.
- Add focused unit, integration, and Electron diagnostic coverage for the standardized behavior.
- Update `docs/status.md` and regenerate traceability output.

## Non-goals
- No change to the backend tag model: tags remain free-text strings stored on Agents and Councils.
- No increase to the 3-tag limit.
- No database-backed tag registry, tag table, or tag analytics/indexing feature.
- No cross-process autocomplete service that loads all tags globally.
- No tag editing from list cards.

## Architecture impact assessment
- Primary changes stay in renderer/shared UI layers: shared tag helpers in `src/shared/app-ui-helpers.ts`, shared tag UI in `src/renderer/components/shared/`, and screen wiring in Agent/Council/Council View surfaces.
- Main-process behavior should remain mostly unchanged because validation and persistence rules already exist in `src/shared/domain/tag.ts` and the feature slices; renderer work must continue to defer final authority to those domain rules.
- Home-list filtering continues through preload IPC and existing list handlers, preserving `Renderer -> Preload -> Main IPC -> Application handlers` boundaries.
- If we add any lightweight suggestion affordance, it should be renderer-local only (for example from currently loaded list items or currently edited object context), never a new global registry.

## Step-by-step implementation plan
1. Introduce a shared tagging interaction spec in code: committed chips, dedicated add input, Enter-to-add, Escape-to-cancel, remove-by-x, optional Backspace-last-chip behavior, inline validation text, and explicit `3 tags max` feedback.
2. Refactor `src/renderer/components/shared/TagsEditor.tsx` into the canonical tag editor used by Council View, Agent editor, and Council editor; make it support disabled/read-only states, inline error text, count/slot messaging, and consistent accessibility labels.
3. Replace the raw comma-separated tag inputs in `src/renderer/components/agents/AgentEditorScreen.tsx` and `src/renderer/components/councils/CouncilEditorScreen.tsx` with the shared tag editor while preserving existing save semantics and archived/read-only rules.
4. Consolidate tag helper logic in `src/shared/app-ui-helpers.ts` so all edit surfaces use the same normalization, append/remove behavior, validation messages, and draft serialization.
5. Standardize read-only tag presentation by introducing one shared tag-list/display primitive and use it in `src/renderer/components/agents/AgentCard.tsx`, `src/renderer/components/councils/CouncilCard.tsx`, and the Council View Config read state.
6. Upgrade home-list filtering UX in `src/renderer/components/shared/HomeListToolbar.tsx` and the Agents/Councils panels from a generic text box to a committed-tag filter interaction that still submits a single exact-match free-text tag to the existing API contract.
7. Add click-to-filter behavior from tag badges on list cards so a visible tag can immediately become the active list filter in the current view.
8. Decide and implement the lowest-risk discovery enhancement:
   - preferred baseline: no autocomplete, only stronger affordances (`Filter by exact tag`, helper text, committed filter chip, clear action);
   - optional low-risk enhancement: surface suggestions only from the currently loaded/visible list items, clearly labeled as local suggestions, not a full catalog.
9. Add/update unit tests for shared tag helpers and shared tag UI behavior, integration coverage for editor saves and exact-match filtering, and Electron scenarios that cover tag add/remove/filter flows in Agents, Councils, and Council View.
10. Update `docs/status.md`, regenerate traceability artifacts, and run the full validation gates.

## Risks and mitigations
- Risk: editor migrations drift from the existing domain rules.
  - Mitigation: keep `src/shared/domain/tag.ts` as the final rule source and funnel all renderer helpers through the same constraints/messages.
- Risk: filter UX becomes more complex than the current simple text field.
  - Mitigation: keep the data model simple (one exact-match active tag), use a chip/token visualization only for clarity, and preserve one-click clear.
- Risk: local suggestions create false expectations of complete autocomplete.
  - Mitigation: ship without suggestions first, or label them as `Visible tags` sourced only from loaded results.
- Risk: three different tag display implementations continue to drift visually.
  - Mitigation: create one shared read-only tag list primitive and remove ad hoc badge/span markup.
- Risk: keyboard behavior regresses across inline edit surfaces.
  - Mitigation: add focused unit/Electron coverage for Enter, Escape, removal, archived disabled state, and filter commit/clear flows.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| R1.15, R5.3, R5.6, U6.6 | `agent editor uses shared chip tag editor` | Verify Agent editing uses chip-based add/remove behavior with max-3 and shared validation feedback. |
| R2.20, R5.3, R5.6 | `council editor uses shared chip tag editor` | Verify Council editing matches Agent/Council View tag behavior and persists normalized tags. |
| U10.10, U10.11, R5.3, R5.6 | `council config tag editor shares standardized behavior` | Verify Council View keeps chip editing, inline validation, and keyboard behavior aligned with the shared component. |
| R5.5 | `shared tag list renders tags consistently across cards and config views` | Verify read-only tag display uses one visual/component contract. |
| R1.17, R1.27, R2.22, R5.7, R5.8 | `home list tag filter commits exact-match tag chips` | Verify list filtering remains exact-match and typed-text based while using the improved committed-filter UX. |
| R1.17, R2.22, R5.5 | `clicking a visible tag applies the current list filter` | Verify visible tags in cards can activate the matching list filter without editing data. |
| U3.2, U4.2, U6.1, U10.11 | `tagging-standardization scenario covers add remove and filter flows` | Verify end-to-end parity across Agents, Councils, and Council View in Electron diagnostics. |

## Validation commands to run
- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test:unit`
- `bun run test:integration`
- `bun run check:coverage-guardrails`
- `bun run trace:generate`
- `bun run check:traceability`
- `bun run diag:electron`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/tagging-standardization.json`

## Rollback strategy
- Revert the shared tag editor/helper/display changes if the standardized interaction proves too disruptive.
- Revert home-list filter interaction changes independently if the committed-chip filter pattern tests poorly while keeping editor standardization.
- Keep the domain tag rules and IPC contracts unchanged so rollback is isolated to renderer/shared UI changes.
