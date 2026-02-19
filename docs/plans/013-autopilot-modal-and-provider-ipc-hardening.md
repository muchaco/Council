# Plan 013 - Autopilot Modal UX + Provider IPC Credential Hardening

## Objective

Replace baseline browser confirm/prompt turn-limit collection with a dedicated Autopilot Start/Resume modal flow (`U12.1`-`U12.3`), and harden provider credential handling at the IPC contract boundary to prevent non-contract credential fields or sensitive error details from crossing into renderer-visible payloads.

## Scope

- Implement dedicated Start/Resume Autopilot modal UX in Council View with:
  - Limit-turns toggle
  - Conditional numeric input
  - Start/Resume and Cancel actions
  - Inline validation for turn-limit bounds
- Keep Start/Pause/Resume top-bar behavior aligned with existing runtime state transitions.
- Harden provider IPC boundary for settings handlers by:
  - Rejecting unknown provider payload fields (strict contract validation)
  - Redacting internal provider error metadata before returning IPC errors
- Add/update unit + integration IPC-contract tests for these boundaries.
- Update implementation traceability in `docs/status.md`.

## Non-goals

- Implementing thinking-placeholder or cached-next-speaker UX (`U12.4`-`U12.6`).
- Refactoring runtime orchestration in `src/main/features/councils/slice.ts`.
- Broad, cross-slice IPC error redaction changes outside provider/settings boundary.

## Architecture impact assessment

- Preserves `docs/architecture-diagram.mermaid` boundaries: renderer collects modal inputs, main process remains source of runtime orchestration and provider credential persistence.
- Preserves `docs/dependency-boundaries.mermaid` constraints: renderer still calls `window.api.*`; provider secrets remain keychain/main-only and do not appear in IPC responses.
- Tightens IPC handler sanitization + validation without introducing new cross-layer dependencies.

## Step-by-step plan

1. Replace `window.confirm`/`window.prompt` max-turn flow with dedicated modal state + submit/cancel actions in `src/renderer/App.tsx`.
2. Add modal styling in `src/renderer/styles.css` with responsive layout.
3. Enforce strict provider request schema validation in `src/shared/ipc/validators.ts`.
4. Redact settings IPC error internals in `src/main/features/settings/ipc-handlers.ts`.
5. Add/update tests in:
   - `tests/unit/ipc-validator-shapes.spec.ts`
   - `tests/integration/providers-ipc.contract.integration.spec.ts`
6. Update `docs/status.md` requirement traceability + next-step pointer.

## Risks and mitigations

- Risk: modal state could conflict with async start/resume transitions.
  - Mitigation: separate modal confirmation from runtime command execution and preserve existing `isStarting`/`isResuming` flags.
- Risk: strict schema validation could reject previously tolerated extra fields.
  - Mitigation: renderer payloads already match contract shape; add explicit contract tests to lock intended behavior.
- Risk: over-redaction could reduce diagnosability.
  - Mitigation: keep user-facing `userMessage` intact while redacting dev/details only at IPC boundary.

## Coverage matrix

| Requirement IDs | Planned tests | Validation intent |
| --- | --- | --- |
| U12.1, U12.2, U12.3 | `tests/integration/councils-handlers.integration.spec.ts`, manual Council View checks | Confirm Start/Pause/Resume flow remains intact with dedicated Start/Resume modal collection |
| C1, A3, IMPL-005 | `tests/integration/providers-ipc.contract.integration.spec.ts`, `tests/unit/ipc-validator-shapes.spec.ts` | Ensure provider payloads reject unknown credential fields and IPC errors redact sensitive internals |

## Validation commands

- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test:unit`
- `bun run test:integration`
- `bun run test:coverage`
- `bun run check:boundaries`
- `bun run db:migrate:verify`
- `bun run check:coverage-guardrails`

## Rollback strategy

- Revert modal state/UI changes in `src/renderer/App.tsx` and `src/renderer/styles.css`.
- Revert strict provider schema updates in `src/shared/ipc/validators.ts`.
- Revert settings IPC error redaction changes in `src/main/features/settings/ipc-handlers.ts`.
- Revert associated tests and status/plan documentation updates.
