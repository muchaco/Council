# Plan 037: Agent Card Config-Error Badge Parity

## Objective
Align Agent card invalid-config presentation with the Councils card treatment so config errors read as the same bottom-right status cluster pattern.

## Scope
- Move Agent card archived/invalid-config badges out of the header and into a bottom-right status cluster.
- Reuse the same visual treatment as Council card archived/config-error badges.
- Refresh diagnostics and status tracking for the renderer-only UX change.

## Non-goals
- No change to Agent invalid-config derivation, archive behavior, or editor flows.
- No change to Council card visuals beyond using them as the parity reference.
- No IPC, persistence, or domain-logic changes.

## Architecture impact assessment
- Renderer-only change in `src/renderer/App.tsx` and `src/renderer/styles.css`.
- Existing dependency boundaries remain intact because the change only affects card markup and styling.

## Step-by-step implementation plan
1. Update Agent card markup to remove header badges and render archived/config-error badges in a footer status cluster.
2. Reuse the Council status-badge classes so invalid-config cards share the same iconography, copy, and visual weight.
3. Update the shared UI inspection diagnostic to verify Agent status badges render in the footer cluster.
4. Update `docs/status.md` and run the required validation commands.

## Risks and mitigations
- Risk: Agent cards could feel visually unbalanced without header badges.
  - Mitigation: keep the footer badges right-aligned and preserve the existing content spacing.
- Risk: Agent archived badge styling could drift from Councils later.
  - Mitigation: reuse the Council status badge classes instead of introducing duplicate Agent-only styles.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| U4.1, U4.5 | `ui-inspect verifies agent footer status badges` | Verify Agent cards render archived status in the shared bottom-right status cluster instead of the header |
| U14.1 | `ui-inspect verifies agent config-error badge treatment parity` | Verify Agent invalid-config badge treatment stays aligned with the Council config-error pattern when present |

## Validation commands to run
- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/ui-inspect.json`

## Rollback strategy
- Revert the renderer, diagnostic, and status-doc updates from this plan if the footer badge treatment makes Agent cards harder to scan.
