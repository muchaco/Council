# 032 Settings Model Refresh No Remount

## Objective

Keep settings and editor model refresh actions in-place so refreshing model options updates only the selector data and does not remount the surrounding view or collapse open UI state.

## Scope

- Settings General accordion model refresh behavior in `src/renderer/App.tsx`.
- Shared renderer behavior for other model-refresh buttons to confirm they stay in-place.
- Renderer diagnostics covering the no-remount refresh path.
- Status/traceability updates required by repo policy.

## Non-goals

- Broader Settings screen refactors.
- Reworking provider save/test flows unrelated to model refresh.
- Changing main-process model catalog APIs.

## Architecture impact assessment

- Boundary compliance remains unchanged: renderer still calls preload IPC only.
- Change is renderer-local state handling; no secrets or provider credentials cross new boundaries.
- No domain or service logic moves layers.

## Step-by-step implementation plan

1. Inspect current settings refresh flow and identify why refresh causes remount/collapsed accordion state.
2. Update renderer state handling so settings model refresh preserves visible UI state and only updates refreshed selector data.
3. Verify other refresh buttons already use in-place updates; adjust only if any remounting path exists.
4. Update diagnostics to assert the selector refresh path without full-view remount.
5. Run targeted validation, then refresh status/traceability artifacts.

## Risks and mitigations

- Risk: preserving stale drafts after refresh could desync saved provider data.
  - Mitigation: preserve only renderer draft/UI state for refresh, while still replacing fetched settings view data.
- Risk: accordion state may still reset on conditional remounts.
  - Mitigation: store accordion expansion state explicitly in React state.

## Coverage matrix

- `U5.11` -> `settings-refresh-no-remount` -> refreshing settings model options keeps the General accordion open and avoids a full-view remount.
- `U2.6` -> `refactor-conservative-smoke` -> refresh feedback still appears through toast notifications without full-view remount.

## Validation commands to run

- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/refactor-conservative-smoke.json`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/settings-refresh-no-remount.json`

## Rollback strategy

- Revert the renderer-side state handling changes and the updated diagnostic scenario if the refresh path regresses view consistency.
