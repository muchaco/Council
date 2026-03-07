# Plan 029: Editor Shell Visual Consistency

## Objective
Bring the Agent create/edit and Council create/edit screens back onto the same visual system as the rest of the renderer so the full-screen forms look intentional instead of falling back to unstyled browser defaults.

## Scope
- Restore a styled shell for Agent and Council editors.
- Style the editor action bar, native form controls, and member-selection rows so they match the existing modern workspace aesthetic.
- Add renderer-facing verification that the editor screens render inside the expected styled shell.
- Update implementation status and traceability metadata as required by repo policy.

## Non-goals
- No changes to editor validation, save/delete/archive semantics, or IPC contracts.
- No redesign of the home lists, Settings, or Council View.
- No persistence or main-process changes.

## Architecture impact assessment
- Renderer-only work in `src/renderer/App.tsx`, `src/renderer/styles.css`, and diagnostics under `scripts/diagnostics/scenarios/`.
- Existing dependency boundaries remain unchanged: renderer consumes the same typed editor view data and commands.

## Step-by-step implementation plan
1. Identify the missing shell/control classes used by the Agent and Council editors and align them with the current renderer visual language.
2. Add editor-specific shell, action-bar, form-surface, and member-row styles in `src/renderer/styles.css`.
3. Adjust editor markup only where needed to hook into the restored styled shell without changing behavior.
4. Extend UI diagnostics to assert that both editors render inside the intended styled container.
5. Update `docs/status.md`, regenerate traceability if needed, and run required validation commands.

## Risks and mitigations
- Risk: new generic form-control styles could unintentionally affect already-polished screens.
  - Mitigation: scope editor styling to the editor shell/classes instead of broad global selectors.
- Risk: diagnostics only prove class presence, not overall polish.
  - Mitigation: keep screenshot capture in the scenario and add explicit shell assertions for both editors.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| U6.1, U6.3, U6.10, R1.1, R1.2, R1.9 | `ui-inspect agent editor uses styled shell` | Verify the Agent full-screen editor renders inside the restored styled shell while preserving the adjacent model refresh affordance |
| U7.1, U7.2, R2.1, R2.2, R2.3 | `ui-inspect council editor uses styled shell` | Verify the Council full-screen editor renders inside the restored styled shell while preserving required create fields and layout |

## Validation commands to run
- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/ui-inspect.json`
- `bun run trace:generate`
- `bun run check:traceability`

## Rollback strategy
- Revert the renderer style/markup changes and diagnostics assertions if the restored editor shell causes regressions or visual inconsistencies.
