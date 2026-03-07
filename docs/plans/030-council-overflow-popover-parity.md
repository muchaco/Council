# Plan 030: Council Overflow Popover Parity

## Objective
Align the Councils card `...` interaction with the Agents card popover so both lists use the same lightweight in-card overflow pattern instead of opening a side sheet.

## Scope
- Replace the Councils card overflow sheet with an inline popover-style disclosure menu.
- Preserve existing Council actions: Export, Archive/Restore, and Delete.
- Preserve keyboard and focus behavior for the Councils overflow control.
- Add renderer-facing diagnostic coverage for the updated Councils overflow menu.
- Update implementation status and traceability metadata as required by repo policy.

## Non-goals
- No changes to Council action semantics, IPC contracts, or persistence behavior.
- No redesign of the Agents list overflow menu beyond maintaining parity.
- No changes to Council View, editor flows, or Settings.

## Architecture impact assessment
- Renderer-only work in `src/renderer/App.tsx`, `src/renderer/styles.css`, and diagnostics under `scripts/diagnostics/scenarios/`.
- Existing boundaries remain unchanged: renderer continues to call the same typed council commands through preload/IPC surfaces.

## Step-by-step implementation plan
1. Reuse the existing Councils disclosure keyboard/focus helpers in `src/renderer/App.tsx` and swap the card action UI from `Sheet` to a `details`-based popover.
2. Add Councils-specific popover classes in `src/renderer/styles.css`, aligned with the existing Agents action menu treatment.
3. Keep action handlers unchanged while ensuring menu close-on-action, outside click close, and focus return behavior still work.
4. Update a Councils diagnostics scenario to assert the new header popover structure and basic open/close behavior.
5. Update `docs/status.md`, regenerate traceability, and run required validation commands.

## Risks and mitigations
- Risk: swapping to an inline popover could regress Councils keyboard behavior.
  - Mitigation: wire the existing disclosure keyboard helpers onto the Councils menu and validate with diagnostics.
- Risk: the popover could visually clash with card stacking or clipping.
  - Mitigation: reuse the established Agents menu styling and keep the card overflow treatment compatible with an anchored menu.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| U3.8, U3.9, U3.10, U15.1, U15.2 | `council-card-dropdown-zindex councils overflow uses popover menu` | Verify Councils cards expose the expected inline overflow menu structure, action visibility, and close behavior |

## Validation commands to run
- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/council-card-dropdown-zindex.json`
- `bun run trace:generate`
- `bun run check:traceability`

## Rollback strategy
- Revert the Councils renderer markup/style changes and restore the prior sheet-based menu if the inline popover causes usability or layout regressions.
