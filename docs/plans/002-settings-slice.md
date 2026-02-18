# Plan 002: Settings + Providers + Model Catalog Slice

## Objective

Implement the first end-to-end functional vertical slice for Settings so users can configure providers, test before save, manage a global default model, and refresh the per-view model catalog with traceable requirement coverage.

## Scope

- Add pure shared-domain model resolution + invalid-config rules for explicit and null model refs.
- Add main-process providers/settings slice with:
  - provider config persistence,
  - keychain-bound secret handling service interface usage,
  - provider connection test flow,
  - model catalog fetch/refresh and grouped models.
- Add strict IPC DTOs/validators and safe error mapping for new settings/provider commands.
- Add preload API methods and renderer Settings UI with provider cards, test-before-save gate, global default model picker, refresh models action, and invalid-config indication.
- Add tests (unit + integration) mapped to R4.*, C*, D*, and H* requirements.
- Update `docs/status.md` with implementation pointers and requirement-to-test traceability.

## Non-goals

- Agents/Councils/runtime feature wiring beyond shared model-resolution semantics.
- Real external provider SDK/network integration (slice will use deterministic provider gateway behavior).
- Full production persistence/migration expansion for unrelated entities.

## Architecture Impact Assessment

- Preserves boundaries from `docs/dependency-boundaries.mermaid`:
  - renderer -> preload -> main IPC -> feature handlers -> pure domain + IO services.
- Keeps domain pure (no IO imports) and uses `neverthrow` `Result`/`ResultAsync` for expected errors.
- Keeps provider secrets in main-only keychain service path and excludes secrets from IPC DTOs and responses.
- Adds DTO validation in main IPC using shared Zod schemas and consistent safe error mapping.

## Step-by-step Implementation Plan

1. Add settings/provider plan-specific shared domain module(s) for model resolution and invalid-config state derivation.
2. Add shared IPC DTOs and validators for providers/settings operations.
3. Implement main services for provider config repository, keychain-backed secret boundary usage, connection testing, and model catalog refresh.
4. Implement settings/providers application handlers returning typed `IpcResult` payloads with safe error mapping.
5. Register IPC endpoints and expose preload `window.api` methods for settings/providers/model catalog actions.
6. Replace renderer bootstrap view with Settings slice UI (provider cards, test status, save gating, model picker, refresh UX).
7. Add/extend unit and integration tests for pure rules, IPC validation, handler orchestration, and secret non-leak semantics.
8. Update `docs/status.md` with concrete file pointers and exact requirement <-> test mappings.
9. Run all required validation commands and fix any regressions.

## Risks and Mitigations

- Risk: DTO/IPC surface grows quickly and can drift.
  - Mitigation: centralize DTO types + validators in `src/shared/ipc/*` and cover validator shapes with tests.
- Risk: Secrets accidentally leak in error payloads or DTO responses.
  - Mitigation: sanitize provider errors, never return secret-bearing fields, and add explicit non-leak tests.
- Risk: Test-before-save bypass via stale test state.
  - Mitigation: bind successful test status to exact draft fingerprint and invalidate gate when inputs change.
- Risk: Model invalid-config semantics become inconsistent.
  - Mitigation: enforce one shared pure resolver used by settings logic and tests.

## Coverage Matrix

| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| R4.8, U5.4 | `providers-handlers.integration.spec.ts::requires-successful-test-before-save` | Save stays blocked until latest test passes for current draft. |
| R4.7, U5.5 | `providers-handlers.integration.spec.ts::ollama-does-not-require-api-key` | Ollama validates and saves without API key and never requires one. |
| R4.9, R4.10, U5.9, U5.10 | `providers-handlers.integration.spec.ts::save-and-refresh-update-catalog` | Save triggers catalog refresh and manual refresh updates current view snapshot. |
| R4.12, U5.7 | `model-resolution.spec.ts::grouped-model-catalog-shape` | Model picker data remains grouped by provider. |
| R4.15, R4.18, R4.19, U5.8 | `model-resolution.spec.ts::null-resolution-and-invalid-config` | Null refs resolve via global default and invalid config is detected when unavailable. |
| C1, C2, D5, A3 | `providers-ipc.contract.integration.spec.ts::secret-never-crosses-ipc` | Credentials stay in keychain boundary and IPC responses remain secret-safe. |
| A3 | `ipc-validator-shapes.spec.ts::settings-provider-dto-validation` | DTO validators enforce required fields and length constraints. |
| H1, H3 | Existing script/integration suites + full command run | Quality gates remain runnable for expanded slice. |

## Validation Commands to Run

- `bun run format:check`
- `bun run lint`
- `bun run typecheck`
- `bun run test:unit`
- `bun run test:integration`
- `bun run test:coverage`
- `bun run check:boundaries`
- `bun run db:migrate:verify`
- `bun run build`

## Rollback Strategy

- Revert settings/providers slice files as one changeset while retaining plan/status docs if implementation cannot satisfy all quality gates.
- If UI integration fails, keep main/shared slice and disable Settings view wiring behind a temporary non-default renderer flag documented in `docs/status.md`.
