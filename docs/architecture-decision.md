# Missing Pieces to Add (Architecture and Platform Decisions)

This document consolidates agreed architectural and platform decisions for the Council desktop application. It complements the functional requirements by defining technology stack, security boundaries, persistence, AI layer integration, FP strategy, and packaging constraints so implementation can proceed without ambiguity.

Confidence scale: **1.00** = fully specified and testable, **0.85** = minor detail still open, **0.70** = notable ambiguity remaining.

---

## A. Electron Architecture and Security

### A1. Process Responsibilities **[1.00]**
- **Renderer (React/Vite + shadcn/ui)**: UI only. Use shadcn/ui for project UI components. No provider secrets. No direct provider network calls.
- **Main process**: persistence (SQLite), provider networking, AI SDK execution, encryption/keychain access, filesystem export, and OS integration.
- **Preload**: exposes a narrow, typed IPC API to the renderer (`window.api.*`).

### A2. Security Defaults **[1.00]**
Electron windows must be created with:
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true` (where feasible)
- `enableRemoteModule: false`
- `webSecurity: true`

### A3. IPC Boundary Rules **[1.00]**
- Renderer may only call main via preload-exposed typed methods.
- All IPC handlers in main must validate:
  - input types
  - required fields
  - string length limits (prompts, tags, titles, messages)
- IPC must never expose raw filesystem paths or secrets.

---

## B. Persistence (SQLite in Main) + Migrations

### B1. Storage Engine **[1.00]**
- SQLite database in main process using `better-sqlite3`.

### B2. Database Location **[1.00]**
- Database file stored under Electron `app.getPath("userData")`.

### B3. Schema Versioning and Migration **[0.95]**
Add requirements:
- Database contains a schema version table.
- App startup checks schema version and runs migrations if needed.
- Migrations must be:
  - ordered
  - transactional where possible
  - safe to re-run (guarded)
- Migration failures block app startup with a clear error.

### B4. Referential Integrity **[0.95]**
SQLite foreign keys must be enabled and reflect domain constraints where feasible:
- Agents referenced by Councils cannot be deleted.
- Members with existing messages cannot be removed.
- Councils cascade-delete messages on Council deletion.

---

## C. Encryption of Provider API Keys

### C1. Key Storage Mechanism **[1.00]**
- Provider API keys stored in OS keychain via `keytar`.
- SQLite stores only a provider credential reference (not the secret).

### C2. Linux Keychain Availability Handling **[0.95]**
Add requirement:
- If OS keychain is unavailable or errors, provider credential save must fail with clear UI error.
- No insecure fallback storage for API keys.

### C3. Encryption Scope **[1.00]**
- Only provider API keys are protected at rest.
- Councils, agents, transcripts, and settings are stored unencrypted.

---

## D. AI Layer Architecture (Vercel AI SDK)

### D1. SDK Placement **[1.00]**
- Vercel AI SDK is used only in Electron main process.
- Renderer never imports or calls AI SDK directly.

### D2. Internal AI Service Boundary **[1.00]**
AI SDK usage is encapsulated behind a main-process `AiService` module.

Add requirement:
- Renderer and domain layers interact only with `AiService`.
- SDK-specific types must not leak outside the service boundary.

### D3. Provider Execution Model **[0.95]**
Add requirement:
- AI calls include provider ID, model ID, messages, temperature, and abort signal.
- Service maps internal message format to SDK/provider format.
- Only final text output is returned (no streaming).

### D4. Cancellation Semantics **[1.00]**
Add requirement:
- All AI generation calls must accept an abort signal.
- Cancelled calls must discard output entirely.
- No partial content may be returned or persisted.

### D5. Secrets Boundary **[1.00]**
- Provider credentials retrieved from keychain only inside main.
- Credentials never cross IPC or enter renderer memory.

---

## E. Domain and Functional Core Strategy

### E1. Functional Core / Imperative Shell **[1.00]**
Architecture follows:
- Pure domain layer: state transitions and validation
- Imperative services: DB, AI, keychain, filesystem
- Orchestrator: coordinates services + domain

### E2. Result Type and Error Modeling **[1.00]**
- Use `neverthrow` `Result` / `ResultAsync`.
- Domain functions return `Result<NewState, DomainError>`.
- Domain functions perform no IO.

### E3. Domain Error Union **[1.00]**
Define discriminated union errors with stable `kind`:
- `ValidationError`
- `NotFoundError`
- `ConflictError`
- `InvalidConfigError`
- `StateViolationError`
- `ProviderError`

Each error must include:
- `kind`
- developer message
- user-displayable message

### E4. Service Layer Contracts **[0.95]**
Main-process services:
- `DbService`
- `KeychainService`
- `AiService`
- `ModelCatalogService` (future)

Each service:
- performs IO
- returns `ResultAsync`
- does not contain domain logic

---

## F. Prompt and Context Handling

### F1. Context Window Size **[1.00]**
- Context size `N` is configurable via app config.
- Domain does not hardcode `N`.

### F2. Stored Content **[1.00]**
- Only model outputs (messages, briefings) are persisted.
- Raw prompts and provider payloads are not stored.

---

## G. Packaging and Distribution (Linux First)

### G1. Packaging Format **[1.00]**
- Primary distribution: AppImage.

### G2. User Data Persistence Across Upgrades **[1.00]**
Add requirement:
- Upgrades must not overwrite user data directory.
- Database migrations run automatically on version change.

### G3. Platform Scope **[0.95]**
- Initial OS: Linux.
- Later OS: macOS.
- Windows not in initial scope.

---

## H. Bun Toolchain Integration

### H1. Package Manager and Scripts **[1.00]**
- Bun used for dependency installation and scripts.
- UI component package standard is `shadcn/ui` for the renderer.

### H2. Native Module Compatibility **[0.90]**
Add requirement:
- Native modules (`better-sqlite3`, `keytar`) must build and run under Bun + Electron on Linux.
- If Bun-native build fails, build pipeline must invoke Electron rebuild tooling.

### H3. Script Coverage **[0.95]**
All project scripts runnable via Bun:
- dev (Vite + Electron)
- build
- typecheck
- lint
- database migration
- packaging (AppImage)

---

## I. Data Identity and Time

### I1. Stable Identifiers **[1.00]**
- Agents, Councils, Messages, Providers use UUIDs.
- Names are not identifiers.

### I2. Timestamps **[1.00]**
- All timestamps stored in UTC.
- Renderer converts to local time.

---

## J. Out of Scope for Current Phase

Recorded but deferred:
- Provider adapter taxonomy and retry strategy
- Orchestration state machine implementation
- Multi-window concurrency rules
- Full backup/import system
- Advanced search indexing (FTS)
- Automated testing strategy

These items must not block initial GUI, persistence, and AI integration layers.
