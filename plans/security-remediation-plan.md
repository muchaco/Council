# Council Security Remediation Plan

Date: 2026-02-11
Last updated: 2026-02-12 (execution status updated through Slice 7)
Owner: Security + Platform
Scope: Electron main/preload/IPC boundaries, settings secret handling, protocol hardening, validation and abuse controls

## Execution Status Snapshot (2026-02-12)

- Slice 1 - Security primitives + protocol containment (P0): **Completed**
  - Added trusted sender checks and protocol path containment primitives.
  - Hardened `electron/main.ts` navigation/window-open behavior and removed string-based hash routing.
- Slice 2 - Sender trust gate rollout to all IPC handlers (P0): **Completed**
  - Applied privileged sender trust wrapper across db/settings/llm/conductor/export handlers.
  - Standardized unauthorized renderer response shape.
- Slice 3 - Plaintext key elimination from renderer boundary (P0): **Completed**
  - Replaced plaintext key retrieval with key-presence workflow (`settings:getApiKeyStatus`).
  - Updated preload/types/stores/UI to use `isApiKeyConfigured` semantics.
- Slice 4 - Header auth migration + error sanitization for settings network calls (P0): **Completed**
  - Replaced query API key auth with `x-goog-api-key` header.
  - Sanitized renderer-facing settings network errors.
- Slice 5 - Encryption key policy unification + crypto migration safety (P1): **Completed**
  - Centralized encryption key policy; removed weak default-key usage patterns.
  - Enforced packaged-mode key requirement and kept backward-compatible decrypt logic.
- Slice 6 - IPC abuse controls for highest-cost endpoints (P1): **Completed**
  - Extended secure IPC wrapper with Zod payload parsing + per-sender sliding-window throttling.
  - Onboarded `llm:chat`, `conductor:processTurn`, `settings:testConnection`, and `settings:listModels`.
- Slice 7 - Full schema/error-hardening rollout to remaining IPC endpoints (P1): **Completed**
  - Added Zod argument validation across remaining db/settings/conductor/export privileged IPC channels.
  - Replaced renderer-facing exception text pass-through with deterministic public error messages.

## Verification Log (completed slices)

- For each completed slice run in-session gates:
  - `npm run lint`
  - `npm run test`
  - `npm run electron:build`
- Current status: all gates passing after Slice 7 changes.
- Bug registry status: BUG-003, BUG-004, BUG-005, BUG-006, BUG-007, and BUG-008 are marked `resolved`.

## Objectives

- Close the highest-risk local privilege-escalation paths in the Electron trust boundary.
- Prevent API key disclosure from renderer memory, URLs, and weak key-management defaults.
- Add deterministic boundary controls: input schema validation, endpoint throttling, and sanitized error surfaces.

## Linked Bugs (Critical Priority)

- BUG-003: Harden Electron trust boundary with IPC sender allowlist and navigation restrictions.
- BUG-004: Remove plaintext API key exposure to renderer and migrate to key-presence workflow.
- BUG-005: Enforce production-grade encryption key management for settings secrets.
- BUG-006: Replace URL query API key usage with header-based authentication.
- BUG-007: Protect custom app:// protocol from path traversal.
- BUG-008: Add schema validation and rate limiting for privileged IPC endpoints.

## Prioritized Incremental Delivery Plan

### Baseline Findings (Current Code)

- `electron/main.ts` currently uses string-based `executeJavaScript` for hash routing, allows weak navigation handling, and has an unsafe `app://` file resolver (`path.join` without containment enforcement).
- All privileged handlers (`db`, `settings`, `llm`, `conductor`, `export`) register `ipcMain.handle` without shared sender trust validation.
- `settings:getApiKey` returns decrypted plaintext API key to renderer (`electron/handlers/settings.ts`) and preload exposes that API (`electron/preload.ts`).
- Renderer stores plaintext key in Zustand (`stores/settings.ts` `geminiApiKey`) and uses it for UI gating.
- Gemini model listing/testing still sends key in URL query (`?key=...`) in `electron/handlers/settings.ts`.
- Fallback encryption key defaults exist in three places (`electron/handlers/settings.ts`, `lib/infrastructure/settings/council-chat-settings.ts`, `lib/infrastructure/settings/conductor-settings.ts`).
- No shared IPC schema validation + rate limiting layer exists for privileged endpoints.

### Slice 1 - Security primitives + protocol containment (P0)

Goal: quickly remove highest-value exploit chain components with minimal product behavior change.

Scope:

1) Add security primitives in Electron shell
- Introduce shared modules for trusted sender checks and protocol path normalization/containment.
- Add unit tests for allowlist/denylist and traversal rejection vectors.

2) Harden app protocol and navigation in `electron/main.ts`
- Replace unsafe `app://` resolution with URL parse + canonical path resolve + strict `out/` containment.
- Deny untrusted `will-navigate` targets.
- Add `setWindowOpenHandler(() => ({ action: 'deny' }))` by default.
- Remove string-based `executeJavaScript` hash routing.

Acceptance checks:
- `app://../../...`, encoded traversal, and malformed protocol payloads are rejected.
- External navigation and window-open attempts are blocked and logged.

Linked bugs: BUG-003, BUG-007

### Slice 2 - Sender trust gate rollout to all IPC handlers (P0)

Goal: enforce trust boundary at every privileged entrypoint.

Scope:

1) Gate every privileged channel
- Apply shared `assertTrustedSender(event)` (or equivalent wrapper) to:
  - `electron/handlers/db.ts`
  - `electron/handlers/settings.ts`
  - `electron/handlers/llm.ts`
  - `electron/handlers/conductor.ts`
  - `electron/handlers/export.ts`
- Deny untrusted origins/schemes and subframes.

2) Keep failure surfaces deterministic
- Return a stable unauthorized response contract for rejected senders.
- Avoid leaking frame URLs or internals to renderer.

Acceptance checks:
- Untrusted origin scripts cannot invoke DB/settings/LLM/conductor/export IPC.

Linked bugs: BUG-003

### Slice 3 - Plaintext key elimination from renderer boundary (P0)

Goal: keep API keys in privileged process only.

Scope:

1) Introduce key-presence workflow
- Add `settings:getApiKeyStatus` returning `{ configured: boolean }`.
- Deprecate `settings:getApiKey` plaintext return (optional temporary compatibility shim for one release window).

2) Remove renderer plaintext persistence
- Update preload and type contracts (`electron/preload.ts`, `lib/electron.d.ts`).
- Refactor settings store/UI (`stores/settings.ts`, `app/settings/page.tsx`, `app/personas/page.tsx`) to use `isApiKeyConfigured` instead of `geminiApiKey` value.

Acceptance checks:
- No IPC route used by renderer returns plaintext API key.
- DevTools/state audit shows no raw key in renderer store.

Linked bugs: BUG-004

### Slice 4 - Header auth migration + error sanitization for settings network calls (P0)

Goal: remove key leakage in URL history and tighten external-call error surfaces.

Scope:

1) Replace query auth with header auth
- For model listing/test calls in `electron/handlers/settings.ts`, replace `?key=...` with `x-goog-api-key` header.

2) Sanitize all returned/logged errors for these paths
- Ensure renderer errors are generic and do not include credential-bearing payloads.

Acceptance checks:
- No outbound settings request includes API key in URL.
- Returned errors contain no raw credential content.

Linked bugs: BUG-006

### Slice 5 - Encryption key policy unification + crypto migration safety (P1)

Goal: remove weak defaults and enforce hardened packaged runtime behavior.

Scope:

1) Unify encryption policy
- Centralize encryption key policy in one shared settings security module.
- Remove all fallback defaults.
- In packaged mode, fail fast on missing/weak `COUNCIL_ENCRYPTION_KEY`.

2) Clean encryption implementation details
- Remove unused randomness in encryption format for new writes.
- Maintain backward-compatible decrypt logic for existing values.
- Add migration path (lazy read-migrate-write or explicit migration routine).

Acceptance checks:
- Packaged app refuses startup with missing/weak encryption key.
- Previously stored encrypted values remain readable after migration.

Linked bugs: BUG-005

### Slice 6 - IPC abuse controls for highest-cost endpoints (P1)

Goal: establish resilient boundary controls where abuse cost is highest.

Scope:

1) Add shared secure IPC wrapper
- Wrapper includes sender trust check, Zod payload parsing, sanitized public error mapping, and per-webContents sliding-window throttling.

2) Onboard hot endpoints first
- `llm:chat`
- `conductor:processTurn`
- `settings:testConnection`
- `settings:listModels`

Acceptance checks:
- Invalid payloads are rejected before use-case execution.
- High-frequency calls return deterministic rate-limit responses.

Linked bugs: BUG-008

### Slice 7 - Full schema/error-hardening rollout to remaining IPC endpoints (P1)

Goal: complete consistent boundary enforcement across all privileged channels.

Scope:

1) Apply schema validation to remaining endpoints
- Roll through DB/settings/conductor/export endpoints not covered in Slice 6.
- Validate setting keys against allowlist for `settings:get`/`settings:set`.

2) Replace direct error pass-through globally
- Remove `(error as Error).message` pass-through from renderer-facing responses.
- Keep internal detail only in privileged logs.

Acceptance checks:
- Renderer-facing errors contain no stack traces, SQL details, or internal exception text.
- Privileged endpoints have schema coverage and deterministic validation failures.

Linked bugs: BUG-008

## Verification Strategy

- Mandatory gate after each slice
  - `npm run lint`
  - `npm run test`
  - `npm run electron:build`

- Unit tests
  - Sender guard allowlist/denylist behavior and subframe denial.
  - Protocol path normalization + containment (`app://` traversal variants, encoded separators, malformed URLs).
  - Schema parsing and sanitized error mapping.
  - Rate-limit counters, per-sender partitioning, and sliding-window reset behavior.
  - Encryption policy checks (packaged-mode key requirement and weak-key rejection).

- Integration tests
  - IPC attempts from mocked untrusted sender are denied across db/settings/llm/conductor/export.
  - Settings workflow works with key-presence API only (no plaintext retrieval path).
  - LLM/settings model discovery and connection-test calls use header auth only.
  - Legacy encrypted values decrypt correctly after crypto format migration.

- Manual checks
  - DevTools audit confirms no raw API key in renderer state/store snapshots.
  - Network inspection confirms no API key in URLs.
  - Packaged app startup fails with missing/weak `COUNCIL_ENCRYPTION_KEY` and succeeds with strong key.

## Rollout Notes

- Release in guarded waves:
  1. Wave A: Slices 1-2 (trust-boundary and protocol containment).
  2. Wave B: Slices 3-5 (secret handling, header auth, encryption policy hardening).
  3. Wave C: Slices 6-7 (schema validation, throttling, global error-surface hardening).
- Keep a short compatibility window for renderer migration away from `settings:getApiKey`, then remove deprecated route.
- Track regressions on session UX, settings UX, and packaged startup behavior.
- Update bug status with registry CLI per slice (`in-progress` -> `resolved`) to preserve audit trail.

## Migration Log

- Date: 2026-02-11
- Action: Reclassified security remediation tracking items from requirements registry to bug registry (defect/vulnerability remediation semantics).
- Mapping:
  - REQ-041 -> BUG-003
  - REQ-042 -> BUG-004
  - REQ-043 -> BUG-005
  - REQ-044 -> BUG-006
  - REQ-045 -> BUG-007
  - REQ-046 -> BUG-008
- Rationale: These items describe fixing unsafe existing behavior and hardening security boundaries, which aligns with bug lifecycle states (`open`, `in-progress`, `resolved`, `closed`) rather than feature requirement states.
