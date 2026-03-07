# Plan 027: Settings Accordions and Inline Model Refresh

## Objective
Give the Settings screen clearer structure with collapsible groups and remove the standalone model-catalog UI in favor of an inline refresh control beside the global model picker.

## Scope
- Group Settings content into `Providers` and `General` accordions.
- Default `Providers` to expanded and `General` to collapsed.
- Remove the standalone `Model Catalog` card.
- Add a compact refresh action next to the `Global Default Model` picker.
- Preserve toast-based feedback and existing refresh/save/test behavior.

## Non-goals
- No IPC or persistence changes.
- No changes to refresh semantics beyond presentation.
- No changes to provider save/test rules.

## Architecture impact assessment
- Renderer-only changes in `src/renderer/App.tsx` and `src/renderer/styles.css`.
- Existing preload/main boundaries and model-catalog data flow remain unchanged.

## Step-by-step implementation plan
1. Wrap provider cards in a `Providers` accordion section with compact, functional header styling.
2. Wrap `Global Default Model` and `Context Window` in a `General` accordion section that starts collapsed.
3. Remove the separate model-catalog card and inline refresh status text.
4. Add a compact refresh button next to the global model picker that refreshes the dropdown data in place.
5. Update status documentation and rerun validation.

## Risks and mitigations
- Risk: collapsing groups hides important settings too aggressively.
  - Mitigation: keep `Providers` expanded by default and use clear summaries in headers.
- Risk: inline refresh affordance is too subtle.
  - Mitigation: place it directly beside the model picker and keep toast feedback.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| U5.1, U5.7, U5.9 | `renders grouped settings sections with inline model refresh` | Verify settings structure remains clear and model refresh remains available |
| U2.6, U5.11 | `uses toasts instead of persistent refresh status copy` | Keep action feedback visible without static implementation-detail text |

## Validation commands to run
- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run trace:generate`
- `bun run check:traceability`

## Rollback strategy
- Revert the Settings renderer/style changes and corresponding status-doc updates.
