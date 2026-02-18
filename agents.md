# Agent Policy and Workflow

## A) Purpose and Operating Principles

- Source of truth is `/docs`: functional requirements (`/docs/requirements.md`), UX requirements (`/docs/ux-requirements.md`), architecture decisions (`/docs/architecture-decision.md`), architecture plan (`/docs/architecture-plan.md`), dependency boundaries (`/docs/dependency-boundaries.mermaid`), architecture diagram (`/docs/architecture-diagram.mermaid`), and pre-merge checks (`/docs/pre-merge-checklist.md`).
- Implementations must preserve requirement IDs exactly (for example `R3.24`, `U10.8`, `A3`) and keep traceability updated in `/docs/status.md`.
- Zero-error policy is mandatory: no lint, format, type, build, test, migration, or CI failures may remain. Treat warnings as errors.
- If suppression is unavoidable, document in `/docs/status.md` with: what was suppressed, exact location, justification, and removal condition.
- Do not guess stack/tooling: this repository is Bun + Electron + React/Vite + shadcn/ui with SQLite (`better-sqlite3`), keychain (`keytar`), and Vercel AI SDK in main process only.

## B) How to Validate Work (Commands)

- Use Bun for all scripts.
- Run validation from repo root.
- Minimum documented command gates today (from `/docs/pre-merge-checklist.md`):
  - `bun run lint`
  - `bun run typecheck`
  - `bun run build`
- Required validation categories for all future work (must exist as runnable scripts before feature merge):
  - Formatting check (script defined in `package.json`, fail on drift)
  - Lint
  - Typecheck
  - Build
  - Unit tests
  - Integration tests
  - Coverage report + threshold enforcement
  - Architecture guardrail checks (import/dependency boundary validation)
  - Migration verification (for DB changes)
- Electron implementation validation is a first-class gate (zero-error policy):
  - Run `bun run diag:electron` for default app smoke validation.
  - Use `bun run tool:electron -- --scenario <scenario.json>` for feature-specific renderer/Electron navigation and assertions.
  - Store/update reusable scenarios under `scripts/diagnostics/scenarios/` and treat failures as blocking.
  - Diagnostic artifacts (`artifacts/electron-tool/`) must be reviewed when debugging regressions.
- If a required validation category has no script yet, adding that automation is part of the change.

## C) Test and Coverage Rules

- Test-as-spec is mandatory: every externally observable behavior change requires test updates/additions.
- Rare escape hatch (no test change) is only allowed for provable behavior-preserving refactors; document proof in `/docs/status.md`.
- No E2E tests are planned.
- Test slices for this repo:
  - Unit tests: pure domain/decider/prompt/model-resolution logic (no IO, avoid mocks, deterministic inputs/outputs).
  - Integration tests: application handlers + DB migration/constraints + IPC contract boundaries using controlled fakes only where IO boundaries must be isolated.
  - Contract checks: IPC DTO validation, secret/path non-leak, and architecture boundary checks.
- Coverage targets:
  - Unit: 90% (focus on pure domain and prompt/model resolution logic)
  - Integration: 50% (critical command/query flows, migration/constraints, runtime error/cancel semantics)
  - Contract/guardrail checks: 100% pass/fail gate (not line coverage; all required checks must pass)
- Mocking policy:
  - Prefer real pure functions and in-memory deterministic fixtures.
  - Use mocks/fakes only at hard IO boundaries (`AiService`, keychain, filesystem, external providers).
  - Keep mocks minimal and behaviorally faithful.

## D) Architecture Guardrails

- Enforce dependency direction from `/docs/dependency-boundaries.mermaid`:
  - Renderer -> Preload -> Main IPC -> Application handlers -> Domain + Services.
  - Renderer must not call providers/services directly and must never handle secrets.
  - Domain is pure: no IO, no service imports.
  - Services are IO only and must not own domain decision logic.
- Security/IPC guardrails:
  - Main IPC validates types, required fields, and length limits.
  - IPC must never expose secrets or raw filesystem paths.
  - Provider credentials remain in keychain and never cross IPC.
- Runtime guardrails:
  - AbortSignal required for generation; cancelled output is fully discarded.
  - No streaming token persistence.
  - No background runtime execution outside active Council View lease.
- Common implementation pitfalls and prevention:
  - Pitfall: mixing domain logic into DB/AI services -> keep rules in deciders and model resolution modules.
  - Pitfall: bypassing model snapshot semantics -> always use view-scoped catalog snapshot for availability checks.
  - Pitfall: handling expected errors via exceptions -> use `neverthrow` `Result/ResultAsync` with stable error `kind` values.
  - Pitfall: adding cross-slice coupling -> keep vertical slice ownership and shared primitives only.
- Automate guardrails where possible via lint/import rules, dependency analyzers, and CI checks.

## E) Automation Expectations

- Automation-first is mandatory: if a guardrail can be checked automatically, implement the check.
- Required automation areas:
  - Coverage threshold enforcement in test config/CI.
  - Lint/type/import-boundary rules.
  - Architecture invariant checks (forbidden imports/layer violations).
  - Pre-commit quality gates (format/lint/tests for changed scope).
  - Migration and schema safety checks when DB changes.
  - Electron app diagnostics via Playwright scenario execution (`tool:electron`) for implementation verification.
- New tooling rules:
  - Must align with `/docs` architecture and Bun toolchain.
  - Keep additions minimal and focused.
  - Must run in CI and pass locally with the same commands.

## F) Status Tracking

- `/docs/status.md` is mandatory and must always reflect current implementation state.
- After every meaningful change, update `/docs/status.md` with:
  - implemented behavior,
  - implementation approach and concrete code locations,
  - in-progress items,
  - remaining gaps,
  - updated requirement <-> test traceability mappings.
- Requirement IDs must remain exact and bidirectional traceability must be complete.

## G) Planning Artifacts

- Any non-trivial implementation must create a plan file under `/docs/plans/`.
- Plan file template requirements:
  - Objective
  - Scope
  - Non-goals
  - Architecture impact assessment (including boundary compliance)
  - Step-by-step implementation plan
  - Risks and mitigations
  - Coverage matrix (`requirement IDs -> planned test case names -> validation intent`)
  - Validation commands to run
  - Rollback strategy (if relevant)
- Execution should not begin on non-trivial work without a plan artifact.

## H) CI / GitHub Actions Expectations

- CI must enforce the same quality gates as local validation (no local/CI drift).
- At minimum, CI must execute lint, typecheck, build, test slices, and coverage enforcement.
- CI must include architecture/boundary checks and fail on violations.
- CI must fail on warnings where tooling supports warning-as-error mode.
- Merge readiness follows `/docs/pre-merge-checklist.md` plus this policy; any deliberate deviation must be documented in `/docs/status.md` and relevant requirement docs.

## I) Tribal Knowledge and Gotchas

- Playwright scenario validation is required for meaningful UI changes:
  - Do not stop at generic smoke runs.
  - Add or update a feature-specific scenario under `scripts/diagnostics/scenarios/` that exercises the changed UX path end-to-end.
  - Prefer deterministic setup using `evaluate` with `window.api.*` seeding for prerequisites when UI-only setup is flaky or slow.
- `tool:electron` runner behavior details:
  - `error: script "dev:renderer" exited with code 143` at the end is expected from teardown (`SIGTERM`) and is not itself a failure signal.
  - Real failure is indicated by `[tool] FAIL ...` and a non-zero script exit.
- Native module ABI mismatch is a common source of false-negative diagnostics:
  - Node/Vitest path may require `npm rebuild better-sqlite3 keytar`.
  - Electron/Playwright path may require `bun run rebuild:native`.
  - If tests pass but Electron launch times out waiting for first window, check ABI mismatch first.
- Runtime order that avoids churn:
  - Run Node-side checks (`test:*`) after Node rebuild.
  - Run Electron scenarios after `bun run rebuild:native`.
  - If switching between both repeatedly, expect to rebuild again for the target runtime.
- Scenario artifact hygiene:
  - `artifacts/electron-tool/*.state.json` are frequently touched by diagnostics and must still pass formatter checks when tracked.
  - Run formatter/lint after scenario runs to avoid unrelated CI failures.
