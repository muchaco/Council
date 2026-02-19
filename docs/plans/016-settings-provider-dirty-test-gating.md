# Plan 016 - Settings Provider Dirty-Test Gating and Config Visibility

## Objective

Improve Settings provider-card UX so connection testing only runs when a provider draft changed, while making saved provider configuration status clearer at a glance.

## Scope

- Add pure shared helpers for provider draft fingerprinting/change detection and configured-state derivation.
- Disable "Test connection" when provider draft is unchanged.
- Guard runtime test action and show user guidance when trying to test unchanged drafts.
- Add explicit provider-card configured/not-configured visual status.
- Keep save gating semantics unchanged (`U5.4`: save still requires successful test token).
- Add unit coverage for new helper behavior.
- Update diagnostics scenario to avoid provider test/save prerequisites that require secrets.
- Update status + traceability docs.

## Non-goals

- Changing backend provider validation logic.
- Removing test-before-save requirement.
- Introducing secret-aware diagnostics that require real API keys.

## Architecture impact assessment

- Changes are renderer/shared only and preserve `Renderer -> Preload -> Main` boundaries.
- No changes to IPC DTO contracts or main-process provider services.
- No changes to keychain/secret boundaries.

## Step-by-step implementation plan

1. Add shared pure helper module for provider draft fingerprints/change detection/configured-state derivation.
2. Wire helper usage in Settings provider-card rendering and button enablement.
3. Add unchanged-draft early-return guard in test action with clear user message.
4. Add provider configured-status badge in provider cards.
5. Add helper unit tests.
6. Update councils diagnostics scenario to avoid provider test/save clicks.
7. Run lint/typecheck/tests/traceability generation and update `docs/status.md`.

## Risks and mitigations

- Risk: users may miss why test button is disabled.
  - Mitigation: add tooltip message and in-action info toast/inline message.
- Risk: save/test flow regression.
  - Mitigation: keep existing testToken save gate unchanged.

## Coverage matrix

| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| U5.2 | `marks provider as configured when saved` | Ensure card-level configured visibility is deterministic. |
| U5.3 | `builds stable provider draft fingerprints`; `detects provider draft changes against saved fingerprint` | Ensure test-button dirty-state behavior is stable. |
| U5.4 | Existing provider integration tests + unchanged save gate code path | Preserve save-only-after-successful-test behavior. |

## Validation commands to run

- `bun run lint`
- `bun run typecheck`
- `bun run test:unit`
- `bun run test:integration`
- `bun run trace:generate`
- `bun run check:traceability`

## Rollback strategy

- Revert provider helper module and renderer wiring.
- Revert provider-card status badge and dirty-test button gating.
- Revert diagnostics scenario and unit tests.
