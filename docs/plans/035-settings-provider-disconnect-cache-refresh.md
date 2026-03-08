# 035 Settings Provider Disconnect Cache Refresh

## Objective

Add a provider disconnect flow so a configured provider can be explicitly removed, its saved models disappear from cached catalogs, and users must disconnect before testing a replacement configuration for that provider.

## Scope

- Provider-management requirements/UX docs for the new disconnect behavior.
- Settings slice, IPC contracts, persistence, and keychain support for provider disconnect.
- Settings renderer/provider-card actions and feedback for disconnecting configured providers.
- Tests, diagnostics, and status/traceability updates required by repo policy.

## Non-goals

- Reworking unrelated Settings layout or model-picker visuals.
- Changing provider credential-validation rules beyond the new disconnect gate.
- Broad multi-window cache invalidation beyond the existing webContents-scoped snapshot model.

## Architecture impact assessment

- Boundary compliance remains intact: renderer triggers disconnect through preload/IPC only; main process owns persistence, keychain, and model-catalog mutation.
- Domain/service direction stays the same: settings slice orchestrates behavior, persistence/keychain services remain IO-only.
- Security posture is preserved: disconnect removes stored credential refs/secrets and never exposes secret values over IPC.

## Step-by-step implementation plan

1. Extend `/docs/requirements.md` and `/docs/ux-requirements.md` with explicit provider-disconnect requirements and capture coverage targets for the new flow.
2. Add a provider-disconnect command across DTOs, validators, preload/window API, IPC registration, and settings IPC handlers.
3. Extend persistence/keychain services with provider-config and secret removal primitives, then implement settings-slice disconnect orchestration that clears provider state and refreshes view snapshots/model catalogs.
4. Update Settings renderer provider cards to expose a Disconnect action for configured providers, block connection tests for changed drafts until disconnect happens, and surface clear inline/toast feedback.
5. Add/update unit, integration, IPC-contract, persistence, and diagnostic coverage; regenerate traceability and refresh `docs/status.md`.

## Risks and mitigations

- Risk: disconnect removes saved config but leaves stale models in cached snapshots.
  - Mitigation: clear webContents snapshots during disconnect and verify via integration tests/diagnostic scenario.
- Risk: users lose in-progress replacement credentials when disconnecting.
  - Mitigation: keep renderer draft inputs local while clearing only persisted provider state.
- Risk: secret cleanup failures leave a provider partially disconnected.
  - Mitigation: treat keychain delete failures as blocking provider errors and only mutate in-memory/persisted state after cleanup succeeds.

## Coverage matrix

- `R4.9`, `R4.10`, `R4.22` -> `disconnect removes provider models from refreshed catalog` -> verify disconnect updates the current view model catalog without reload and removes the disconnected provider section.
- `R4.22`, `C1`, `C2`, `R7.1` -> `disconnect removes persisted config and credential secret` -> verify persistence/keychain cleanup succeeds and no secret leaks over IPC.
- `U5.3`, `U5.12` -> `configured providers require disconnect before replacement test` -> verify provider-card action gating and feedback for changed drafts against saved config.
- `U5.10`, `U5.11`, `U5.12` -> `settings-provider-disconnect` -> verify Settings updates in place after disconnect and shows the provider as not configured.

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

- Revert the disconnect command, service removals, renderer action wiring, and diagnostics/docs updates if the feature causes provider-state regressions.
