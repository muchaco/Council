# Plan 031: Clickable Council Cards and Status Badge Rebalance

## Objective
Refine the Councils home-card interaction model so the whole card opens Council View, while rebalancing status badges to avoid crowding the title and giving archived councils a clearer visual identity.

## Scope
- Remove the separate `Open Council` button from council cards.
- Make the council card surface open Council View on click/keyboard activation, excluding the overflow menu region.
- Move council status badges away from the header/title area to the lower-right of the card.
- Add icon treatment to the archived badge so it visually matches paused/stopped status chips better.
- Update diagnostics, tests, and docs/status tracking for the renderer behavior change.

## Non-goals
- No changes to main-process council commands, persistence, or IPC contracts.
- No redesign of the Agents cards.
- No changes to council list filtering, sorting, pagination, or overflow menu actions.

## Architecture impact assessment
- Renderer-only implementation in `src/renderer/App.tsx` and `src/renderer/styles.css`.
- Shared renderer-safe interaction helper updates live in `src/shared/home-keyboard-accessibility.ts`.
- Existing dependency boundaries remain intact: renderer still consumes existing typed list/query data and routes actions through preload IPC only.

## Step-by-step implementation plan
1. Add a small shared helper that determines whether a council-card interaction should open the card or be ignored because it originated inside the overflow/menu controls.
2. Update council-card markup to remove the footer CTA, move badges to a lower-right status row, and make the card itself keyboard/click activatable.
3. Refresh council-card styling for the new interaction model, footer badge layout, and archived badge icon treatment.
4. Add/update renderer-facing test coverage and an Electron scenario that verifies the missing CTA and card-surface open behavior.
5. Update UX docs and `docs/status.md`, regenerate traceability metadata, and run required validation.

## Risks and mitigations
- Risk: card click handling could accidentally trigger while using the overflow menu.
  - Mitigation: explicitly guard menu/details/button-originated events in a shared helper and cover it with tests.
- Risk: removing the footer button could reduce discoverability.
  - Mitigation: give the full card clear hover/focus affordances and preserve visible overflow actions in the header.
- Risk: moving badges could create cramped layouts on small screens.
  - Mitigation: allow badge wrapping and keep the footer row right-aligned but flexible.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| U3.7, U15.2 | `opens council cards from the card surface while ignoring nested menu controls` | Verify the shared interaction helper only opens from the intended card surface and preserves keyboard semantics |
| U3.2 | `council card redesign keeps archived status visually distinct` | Verify the renderer diagnostic path captures the archived indicator with icon treatment and footer badge layout |
| U3.7 | `council cards open without a separate Open Council button` | Verify the Electron scenario uses card click instead of a dedicated CTA |

## Validation commands to run
- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test:unit`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/ui-inspect.json`
- `bun run trace:generate`
- `bun run check:traceability`

## Rollback strategy
- Revert the renderer, shared-helper, diagnostic, and docs changes from this plan if the clickable-card model proves confusing or interferes with overflow-menu behavior.
