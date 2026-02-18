# Plan 001: Foundation Bootstrap

## Objective

Bootstrap a runnable, architecture-compliant foundation for the Council desktop app so future vertical slices can be implemented with traceable quality gates.

## Scope

- Initialize Bun-managed project metadata and scripts.
- Create Electron main/preload/renderer skeleton with secure defaults.
- Establish shared FCIS primitives (domain error union, IDs, tag/model value objects, IPC DTO validator entry points).
- Add baseline services contracts (`DbService`, `KeychainService`, `AiService`, `ModelCatalogService`) and app environment wiring.
- Add quality automation scripts: lint, format, typecheck, build, unit/integration/coverage, architecture boundary check, migration verification.
- Add initial tests and scripts that execute successfully in current baseline.

## Non-goals

- Full feature implementation for Agents/Councils/Runtime.
- Production-ready provider adapters and persistence migrations.
- Final UI/UX implementation beyond shell-level placeholders.

## Architecture Impact Assessment

- Preserves dependency direction from `docs/dependency-boundaries.mermaid`:
  - renderer -> preload -> main IPC -> application -> domain/services.
- Domain modules are pure and do not import IO services.
- Services are interfaces/contracts only; no domain ownership.
- Security boundary starts enforced:
  - renderer only consumes preload API,
  - preload exposes narrow `window.api`,
  - main uses secure BrowserWindow defaults.

## Step-by-step Implementation Plan

1. Create project metadata (`package.json`) and TypeScript project references.
2. Add lint/format tooling configuration and basic ignore files.
3. Scaffold renderer app entry (`index.html`, React app shell, Vite config).
4. Scaffold Electron main/preload entries with secure defaults and typed bridge.
5. Add shared primitives (`errors`, `ids`, `tag`, `modelRef`, IPC schemas).
6. Add service contracts and application environment types in main.
7. Add baseline guardrail scripts (boundary check, migration verification).
8. Add minimal unit/integration tests and coverage threshold config.
9. Install dependencies and run validation commands; fix drift/issues.
10. Update `docs/status.md` with implementation pointers and requirement/test traceability.

## Risks and Mitigations

- Risk: Toolchain mismatch between Bun, TypeScript, Electron.
  - Mitigation: keep build to deterministic TS compile + Vite renderer build; postpone advanced packager wiring.
- Risk: Early boundary violations during bootstrap.
  - Mitigation: include static boundary script that fails on forbidden imports.
- Risk: Missing migration scripts before DB work starts.
  - Mitigation: add migration verification script now with explicit empty-state handling.

## Coverage Matrix

| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| A1, A2 | `main-window-security-defaults.spec.ts` | Ensure BrowserWindow options enforce process/security defaults. |
| A3 | `preload-api-contract.spec.ts`, `ipc-validator-shapes.spec.ts` | Verify typed bridge/API surface and DTO validation entry points exist. |
| E2, E3 | `domain-errors-shape.spec.ts` | Assert stable error kinds and typed Result-style contracts at domain boundary. |
| H1, H3 | `scripts-presence.integration.spec.ts` | Ensure required Bun scripts are defined and runnable. |
| IMPL-001 | `validation-gates.integration.spec.ts` | Verify baseline quality gate commands exist and execute successfully. |
| IMPL-005 | `boundary-check-script.integration.spec.ts` | Verify architecture guardrail script catches forbidden dependency edges. |

## Validation Commands to Run

- `bun install`
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

- If bootstrap fails quality gates, revert newly added scaffold files in a single changeset and keep only planning/status documentation updates.
- If a specific tooling choice blocks progress, retain FCIS/module structure and replace only the tooling layer (scripts/config) with minimal alternatives.
