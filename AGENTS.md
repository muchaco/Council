# Repository Guidelines

## Tech Snapshot

Council is an Electron desktop app with:

- Vite + React renderer (`src/`, `app/`, `components/`)
- Electron main process (`electron/`)
- Zustand stores (`stores/`)
- SQLite persistence via Electron IPC
- Effect-TS-driven FCIS migration (`lib/core`, `lib/application`, `lib/infrastructure`, `lib/shell`)

This repository is **not Next.js**. Prefer Vite/Electron conventions.

---

## What This Repository Expects

- Business policy goes in pure core modules.
- Runtime effects (DB, IPC, network, Electron, toasts, logging) stay out of core.
- Application use-cases orchestrate core decisions and interpret planned effects with Effect services.
- Shell layers (stores, IPC handlers) are thin adapters.

If you only remember one rule: **Decide in core, execute in application/shell.**

## DDD Alignment Rules

When implementing or refactoring features, align code with **Domain-Driven Design (DDD)**:

- **Ubiquitous Language:** Use exact product terms from PM requirements in function names, types, variables, and test cases. Prefer names that read like business rules over technical shorthand.
- **Bounded Contexts:** Organize by business slice first (for example, `session-tags`, `conductor`) and keep each slice coherent across core/application/infrastructure/shell. Avoid cross-context policy leakage.
- **Domain-Centric Core:** Keep the functional core focused on domain model + domain decisions only. Push all infrastructure details and orchestration plumbing into application, infrastructure adapters, and shell.align the code more closely with **Domain-Driven Design (DDD)**. Specifically:

* **Ubiquitous Language:** Let’s use the exact terminology the Product Managers use. Variable names, functions, and tests should read like business requirements, not technical implementations.
* **Bounded Contexts:** Let's organize the modules by 'business areas' (e.g., *Billing*, *Onboarding*) rather than technical types.
* **Domain-Centric Core:** Keep the **Functional Core** strictly focused on business logic (Domain Model), leaving all infrastructure and 'plumbing' to the **Imperative Shell**.

The goal is for the code to mirror the product's logic so closely that a PM could almost understand the logic just by reading the function signatures.

Litmus test: a PM should be able to skim core decision signatures and understand the business behavior.

## Architecture Map

```text
UI / Electron handlers (Shell)
  -> lib/application/use-cases/* (Effect orchestration)
    -> lib/core/decision/* (pure decisions)
      -> lib/core/plan/* (effect descriptions)
      -> lib/core/errors/* (typed expected failures)
    -> lib/application/... service interfaces (Context.Tag)
      -> lib/infrastructure/* adapters (DB/LLM/settings/clock/id)
```

Current examples:

- Session tags slice (Phase 1):
  - Core: `lib/core/domain/session-tags.ts`, `lib/core/decision/decide-assign-session-tag.ts`, `lib/core/decision/decide-remove-session-tag.ts`, `lib/core/plan/session-tags-plan.ts`
  - Application: `lib/application/use-cases/session-tags/*`
  - Infrastructure: `lib/infrastructure/db/session-tag-persistence.ts`
  - Shell: `stores/sessions.ts`
- Conductor slice (Phase 2 in progress):
  - Core: `lib/core/domain/conductor.ts`, `lib/core/decision/conductor/*`, `lib/core/plan/conductor-plan.ts`, `lib/core/errors/conductor-error.ts`
  - Application: `lib/application/use-cases/conductor/*`
  - Infrastructure: `lib/infrastructure/db/conductor-turn-repository.ts`, `lib/infrastructure/llm/conductor-selector-gateway.ts`
  - Shell: `electron/handlers/orchestrator.ts`

---

## Where To Put New Code

For each bounded context or feature slice, add code in this order:

1. `lib/core/domain/*` - domain types, policies, pure helpers.
2. `lib/core/errors/*` - typed expected failures for that slice.
3. `lib/core/plan/*` - planned effect/value types.
4. `lib/core/decision/*` - pure decision functions returning `Either`/`Option`/plain values.
5. `lib/application/use-cases/<slice>/*` - Effect orchestration using service dependencies.
6. `lib/infrastructure/*` - concrete adapters implementing service contracts.
7. Shell entrypoint updates (`stores/*`, `electron/handlers/*`, sometimes `lib/shell/*`).

---

## Feature Implementation Workflow

### 1) Start from behavior, not transport

Define what the domain should decide first:

- Inputs (commands + context/state)
- Validations and branch rules
- Typed error outcomes
- Successful plan output

### 2) Write pure core decision(s)

Use signatures like:

- `Decide(input, context) -> Either<DomainError, Plan>`
- `Decide(input) -> Option<Plan>`

Core rules:

- No DB/IPC/network/filesystem/time/random.
- No React/Electron imports.
- No thrown exceptions for expected business outcomes.

### 3) Define a plan model

Plans should describe intended side effects, for example:

- `PersistX`
- `EnsureY`
- `RefreshZ`

Application interprets these; core only describes them.

### 4) Build use-case orchestration in Effect

In `lib/application/use-cases/<slice>/...`:

- Define service interfaces with `Context.Tag`.
- Run core decision.
- Fail early with typed domain errors.
- Interpret plan effects (prefer exhaustive `switch` on `_tag`).
- Return typed result DTO for shell.

### 5) Implement infrastructure adapters

In `lib/infrastructure/*`:

- Wrap runtime calls with `Effect.tryPromise` / `Effect` combinators.
- Convert runtime errors to typed infrastructure errors.
- Keep adapter logic thin and deterministic where possible.

### 6) Keep shell thin

Shell code should:

- Gather request/input data.
- Provide services/layers.
- Run use-case and map result/error to UI/IPC response.
- Apply view state and toasts.

Shell should not host domain policy branches.

---

## Testing Expectations

- Core decisions: table-driven tests are primary confidence source.
- Use-cases: a few focused tests for orchestration + error mapping.
- Shell: minimal tests (wiring and boundary behavior).

Suggested pattern names:

- `decide_*_spec` for core
- `execute_*_use_case_spec` for application
- `<store>_spec` or `<handler>_spec` for shell

---

## Development Commands

```bash
# Install dependencies
npm install

# Renderer-only dev
npm run dev

# Full Electron app in dev mode
npm run electron:dev

# Build renderer
npm run build

# Compile Electron TypeScript
npm run electron:build

# Lint + test
npm run lint
npm run test
```

---

## ⚠️ CRITICAL: Registry Management Rules

Requirements and bugs MUST be managed exclusively through CLI commands.

### DO NOT

- Directly edit files in `requirements/` or `bugs/`
- Manually modify `requirements/index.json` or `bugs/index.json`
- Create/delete items by writing/removing files directly

### ALWAYS

- Use `npm run req:*` scripts for requirements
- Use `npm run bug:*` scripts for bugs
- Keep history by status updates rather than deletion

### Why

The CLI ensures consistent IDs, indexing, and scoring. Manual edits can corrupt the registry.

---

## Registry CLI Reference

```bash
# Requirements
npm run req:create
npm run req -- list
npm run req -- get REQ-001
npm run req -- mark REQ-001 in-progress
npm run req:next

# Bugs
npm run bug:create
npm run bug -- list
npm run bug -- get BUG-001
npm run bug -- mark BUG-001 in-progress
npm run bug:next
```

Status values:

- Requirements: `draft`, `pending`, `in-progress`, `completed`, `cancelled`
- Bugs: `open`, `in-progress`, `resolved`, `closed`, `wontfix`

---

## Tribal Knowledge Capture

If you discover non-obvious, hard-to-find, or trial-and-error knowledge, append one concise bullet under `## Tribal Knowledge`.

Format:

- **[Topic]:** practical solution/path/command.

## Tribal Knowledge

*(Agent: Append new insights below this line)*

- **[Effect test tooling]:** Keep `vitest`, `@vitest/ui`, and `@effect/vitest` aligned (`vitest@3.2.x`, `@vitest/ui@3.2.x`, `@effect/vitest@0.27.0`) to avoid peer dependency conflicts.
- **[FCIS slice map - commit 90d1a31]:** Read `lib/core/{domain,decision,plan,errors}` for pure business rules and typed failures, `lib/application/use-cases/**` for Effect orchestration over core decisions, `lib/infrastructure/**` for runtime interpreters/adapters, and `stores/sessions.ts` + `lib/shell/**` as imperative entrypoints that call use-cases and apply UI/IPC side effects.
- **[Electron + shared FCIS modules]:** If Electron handlers import root `lib/**` modules, set `electron/tsconfig.json` `rootDir` to `..`, include `../lib/**/*.ts`, and run Electron from `electron/dist/electron/main.js` (not `electron/dist/main.js`) so emitted relative imports resolve.
- **[FCIS readonly-to-SDK mapping]:** Keep core/application DTOs readonly for purity, then convert to SDK-specific mutable request objects (for example Gemini `startChat` history) inside infrastructure gateway adapters.
- **[FCIS failure precedence]:** Preserve legacy failure ordering by checking settings/auth preconditions before repository reads, and validating cheap domain preconditions before expensive context loads; back this with tests that assert skipped dependency calls.
- **[Query shell runtime wiring]:** When use-cases move UUID/time behind services, ensure each Electron shell runner provides `LiveIdGeneratorLayer` and `LiveClockLayer` alongside repository services before executing effects.
