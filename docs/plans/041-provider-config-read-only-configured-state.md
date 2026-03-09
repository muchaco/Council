# 041 Provider Config Read-only Configured State

## Objective

Fix the Settings provider-card UX so configured providers stay read-only until disconnected, Test connection and Save stay hidden when Disconnect is the only valid action, and local draft typing no longer gets wiped by Settings auto-reloads.

## Scope

- Settings renderer provider-card state management and action visibility.
- Shared provider-card UI helpers for configured/read-only behavior.
- Unit coverage and Electron diagnostics for the configured-provider UX.
- Status and traceability updates required by repo policy.

## Non-goals

- Changing main-process provider save/test/disconnect semantics.
- Redesigning the Settings layout beyond the provider-card interaction fix.
- Altering provider credential validation rules.

## Architecture impact assessment

- Boundary compliance remains intact: the renderer still uses preload/IPC only for provider actions.
- The change stays in renderer/shared UI logic; main-process persistence/keychain boundaries do not change.
- Security posture is preserved because configured cards remain secret-safe and no credential values cross IPC.

## Step-by-step implementation plan

1. Update provider-card helper logic and Settings renderer state handling so configured providers are read-only, disconnect-only, and no longer trigger full Settings reloads on each keystroke.
2. Adjust Settings card rendering/copy so configured providers show read-only inputs, hide Test connection and Save until disconnect, and restore editable inputs after disconnect.
3. Add or update unit coverage for configured-card editability/action visibility and extend the Electron scenario to verify the new UX path.
4. Refresh `docs/status.md`, regenerate traceability, and run required validation commands.

## Risks and mitigations

- Risk: removing the Settings reload loop could leave stale saved baselines.
  - Mitigation: keep saved fingerprints refreshed from `loadSettingsView` while reading current drafts from refs inside the callback.
- Risk: configured cards may become permanently locked after disconnect failure.
  - Mitigation: only make cards editable from persisted configured state, and keep disconnect failure feedback inline without mutating saved provider state.
- Risk: action-visibility rules could drift from the helper tests.
  - Mitigation: centralize the gating in shared helper functions and cover them with `itReq(...)` tests.

## Coverage matrix

- `U5.2`, `U5.12` -> `configured providers are read-only until disconnected` -> verify configured cards keep inputs visible but non-editable.
- `U5.3`, `U5.12` -> `configured providers hide test and save while disconnect is the only action` -> verify action visibility follows the configured state.
- `U5.10`, `U5.12` -> `settings-provider-disconnect` -> verify disconnect returns the card to editable/not-configured state without reload regressions.

## Validation commands to run

- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test:unit`
- `bun run test:integration`
- `bun run trace:generate`
- `bun run check:traceability`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/settings-provider-disconnect.json`

## Rollback strategy

- Revert the renderer/helper/scenario/docs changes if the configured-provider card flow regresses editing, save gating, or Settings refresh behavior.
