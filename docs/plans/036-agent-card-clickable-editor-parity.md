# Plan 036: Clickable Agent Cards and Overflow Action Narrowing

## Objective
Bring Agents list interaction into parity with Councils so clicking an Agent card opens the Agent editor directly, while the overflow menu stays focused on archive/restore and delete actions.

## Scope
- Make the Agent card surface open the Agent editor on click/keyboard activation, excluding nested menu controls.
- Remove the separate `Edit agent` overflow action from the Agent `...` menu.
- Keep archive/restore and delete actions in the Agent overflow menu.
- Update tests, diagnostics, and status/traceability artifacts for the renderer behavior change.

## Non-goals
- No change to Agent archive persistence, delete semantics, or IPC contracts.
- No redesign of the Agent editor itself.
- No change to Council card behavior beyond keeping the shared helper aligned.

## Architecture impact assessment
- Renderer-only interaction change in `src/renderer/App.tsx` and `src/renderer/styles.css`.
- Shared keyboard/click guard logic continues to live in `src/shared/home-keyboard-accessibility.ts`.
- Existing dependency boundaries remain intact: renderer opens the existing Agent editor flow through preload-backed APIs only.

## Step-by-step implementation plan
1. Reuse the shared card-open interaction helper for Agents and add card click/keyboard handlers that open the Agent editor.
2. Update Agent card markup and styling to make the card surface activatable and remove the `Edit agent` overflow action.
3. Add/update unit coverage for shared card-open helper behavior with Agent parity expectations.
4. Update Electron diagnostics to verify Agent cards open the editor from the card surface and that the overflow menu no longer exposes edit.
5. Refresh `docs/ux-requirements.md`, `docs/status.md`, regenerate traceability artifacts, and run required validation commands.

## Risks and mitigations
- Risk: card activation could trigger unintentionally when users interact with the overflow menu.
  - Mitigation: keep the shared `isCardOpenInteractionTarget()` guard and cover nested-menu exclusions in unit tests.
- Risk: removing the explicit edit action could reduce discoverability.
  - Mitigation: apply the same card-wide interactive affordance already used by Councils and verify editor entry via diagnostics.
- Risk: keyboard access could regress for Agent cards.
  - Mitigation: mirror the Council card `tabIndex` and Enter/Space handling pattern and keep requirement-tagged helper coverage.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| U4.6, U15.2 | `opens home cards from the card surface while ignoring nested menu controls` | Verify the shared helper allows card-surface activation while excluding nested controls for both Council and Agent cards |
| U4.6, U6.1 | `agents archive flow opens editor from the card surface and keeps overflow actions scoped to archive/delete` | Verify archived Agent cards still open the read-only editor directly while the overflow menu no longer includes edit |
| U4.6 | `agent cards open editor without a separate Edit agent menu item` | Verify renderer diagnostics use card click to enter the Agent editor and confirm the overflow menu contents |

## Validation commands to run
- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test:unit`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/ui-inspect.json`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/agents-archive-feedback.json`
- `bun run trace:generate`
- `bun run check:traceability`

## Rollback strategy
- Revert the Agent card renderer/styles/test/diagnostic/docs changes from this plan together if the clickable-card interaction proves confusing or interferes with overflow actions.
