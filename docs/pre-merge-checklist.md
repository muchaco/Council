# Pre-Merge Checklist (Architecture + UX Contracts)

Use this checklist before merging feature work, especially new vertical slices.

## 1) Architecture and boundaries

- [ ] Main-process business flows use `neverthrow` `Result` / `ResultAsync` for expected failures.
- [ ] No exception-driven control flow for validation/not-found/conflict/invalid-config/provider-reachability.
- [ ] Shared error types come from `src/shared/domain/errors.ts` (or equivalent shared domain module).
- [ ] No cross-slice error coupling (for example, Agents/Settings importing Providers-owned errors).
- [ ] Renderer remains UI-only and uses preload `window.api` methods only.
- [ ] IPC handlers validate input DTOs with shared Zod validators.

## 2) Error kind and IPC consistency

- [ ] Error `kind` values are stable and intentional (`ValidationError`, `NotFoundError`, `ConflictError`, `InvalidConfigError`, `StateViolationError`, `ProviderError`, `InternalError`).
- [ ] `InvalidConfigError` is used consistently where model/config availability fails.
- [ ] IPC handlers map typed `Result` failures to `IpcResult` without relying on try/catch as business flow.
- [ ] Renderer-facing messages are user-safe and do not leak secrets/paths.

## 3) Model snapshot and refresh behavior

- [ ] View-scoped model catalog snapshots are cleaned on `webContents` teardown.
- [ ] Refresh actions are gated when requirements say they are conditional (for example provider must exist).
- [ ] Refresh failure paths are visible to users (no silent catches/no-op failure handling).
- [ ] Success/failure completion feedback uses shared toast behavior, not static inline pseudo-toast blocks.

## 4) UX contract checks

- [ ] Save-enabled rules match UX requirements (required fields, uniqueness, model validity, etc.).
- [ ] Invalid-config states are surfaced where required (badges/warnings/blocked actions).
- [ ] Disabled actions have clear explanatory feedback.

## 5) Verification gates

- [ ] `bun run lint`
- [ ] `bun run typecheck`
- [ ] `bun run build`
- [ ] Manual smoke-check of changed flows (success + expected failure paths).

## 6) Documentation hygiene

- [ ] Task plan/status docs updated when scope or interpretation changes.
- [ ] `AGENTS.md` updated if a new non-obvious rule or pitfall was discovered.
- [ ] Any deliberate requirement deviation is documented explicitly in `docs/requirements.md` or `docs/ux-requirements.md` notes.
