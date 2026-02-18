# Plan 004: SQLite Persistence Foundation (Settings + Agents)

## Objective

Replace volatile in-memory state for implemented slices with SQLite-backed persistence in Electron main so saved provider/settings/agent data survives app restarts and aligns with architecture requirements.

## Scope

- Add SQLite persistence service in main process with migration execution.
- Replace placeholder migration with baseline schema for:
  - `schema_migrations`
  - `settings`
  - `provider_configs`
  - `agents`
- Wire Settings and Agents slices to load persisted state and persist mutations.
- Add integration tests validating persistence behavior across re-open.
- Add native module rebuild command for Electron ABI compatibility.
- Keep existing UX/IPC behavior and contracts stable.

## Non-goals

- Councils/messages/runtime persistence tables and foreign-key rules.
- Full repository abstraction for all slices.
- Packaging/release automation for native module rebuilds.

## Architecture Impact Assessment

- Implements B1/B2/B3 foundation requirements from `docs/architecture-decision.md`.
- Preserves FCIS split: domain logic remains pure; persistence is in main-process IO service.
- Keeps keychain secret boundary intact: SQLite stores credential references only.

## Step-by-step Implementation Plan

1. Add `better-sqlite3` runtime dependency and typings.
2. Replace bootstrap migration placeholder with baseline schema creation SQL.
3. Implement SQLite persistence service (open DB, enable FK pragma, apply migrations, CRUD methods for settings/providers/agents).
4. Wire persistence into `register-ipc` and map DB failures to user-safe internal errors.
5. Extend Settings slice hydration + persistence hooks.
6. Extend Agents slice hydration + persistence hooks.
7. Add integration tests for persisted reload semantics.
8. Add native-module Electron rebuild script.
9. Validate with lint/type/test/build + Electron Playwright scenario.

## Risks and Mitigations

- Risk: Native module ABI mismatch between host test runtime and Electron runtime.
  - Mitigation: explicit `rebuild:native` command for Electron and documented host rebuild fallback (`npm rebuild better-sqlite3`).
- Risk: Migration/runtime path mismatch.
  - Mitigation: keep migrations under canonical repository path and validate with migration verification script.
- Risk: Persisted JSON payload drift.
  - Mitigation: conservative parse with defaults + typed DTO mapping at slice boundary.

## Coverage Matrix

| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| B1, B2, B3 | `sqlite-persistence.integration.spec.ts` | Ensure DB initializes, migrates, and persists data across re-open. |
| R7.1 | `sqlite-persistence.integration.spec.ts::persists-settings-and-providers-across-re-open` | Confirm local data durability for implemented slices. |
| R7.1 | `sqlite-persistence.integration.spec.ts::persists-agents-across-re-open-and-supports-delete` | Confirm agent persistence + delete semantics. |
| H2 | Manual: `bun run rebuild:native` + Electron smoke | Ensure native module compatibility for Electron runtime. |

## Validation Commands to Run

- `bun run format:check`
- `bun run lint`
- `bun run typecheck`
- `bun run test:unit`
- `bun run test:integration`
- `bun run build`
- `bun run check:boundaries`
- `bun run db:migrate:verify`
- `bun run rebuild:native`
- `node scripts/diagnostics/electron-diagnostic.mjs --scenario scripts/diagnostics/scenarios/settings-smoke.json --skip-build`

## Rollback Strategy

- Revert persistence service wiring and restore in-memory-only behavior while keeping migration verification and plan/status documentation.
- Keep migration file changes if schema foundation remains valid and does not block app startup.
