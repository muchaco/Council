# 042 Council Runtime Error Normalization

## Objective

Replace raw provider/runtime error dumps in Council View with short, user-facing generation failure messages, actionable retry guidance, and optional technical details so runtime failures stay understandable without exposing noisy provider payloads.

## Scope

- Normalize Council runtime provider/generation failures into a small set of user-facing categories and messages.
- Update Council View inline error presentation for Autopilot and Manual mode recovery notices.
- Add an optional details affordance for technical/provider diagnostics without showing raw payloads by default.
- Add or update unit, integration, and Electron diagnostic coverage for normalized runtime error UX.
- Refresh `docs/status.md` and regenerate traceability after implementation.

## Non-goals

- Reworking provider request/retry orchestration behavior beyond message shaping and presentation.
- Changing Settings/provider-card validation or connection-test copy.
- Persisting full provider payloads or exposing secrets over IPC.
- Redesigning the broader Council View layout outside the error surfaces.

## Architecture impact assessment

- Boundary compliance must remain intact: provider-specific parsing and normalization belong in main/shared domain-facing helpers, while renderer components consume already-normalized error state via preload/IPC.
- Security posture must stay the same or improve: raw provider payloads, paths, credentials, and internal transport details must not become part of default renderer-visible copy.
- FCIS alignment improves if message classification is extracted into pure shared helpers and the renderer only handles display state.
- Existing runtime state guarantees remain unchanged: cancel-discard, retry-on-refresh, pause-on-error, and manual retry flows continue to use the current orchestration in `src/main/features/councils/slice.ts`.

## Step-by-step implementation plan

1. Audit the current Council runtime error path in `src/main/features/councils/slice.ts`, `src/shared/domain/errors.ts`, `src/shared/council-view-autopilot-recovery.ts`, and `src/renderer/App.tsx` to identify where raw provider text is copied into `userMessage` and then rendered inline/toast.
2. Introduce a pure shared error-normalization helper that maps common provider/runtime failures into stable categories such as quota exceeded, rate limited, auth/config issue, provider unavailable, network/timeout, invalid model/settings, and generic generation failure.
3. Extend the runtime error shape passed to the renderer so it can carry concise user copy plus optional sanitized technical details for disclosure, while keeping default UI copy short and action-oriented.
4. Update Council runtime orchestration to use normalized messages for `ProviderError` and related generation failures, preserving existing retry/pause semantics and keeping internal/dev messages available only for logs or hidden details.
5. Refine Council View inline notices and toasts so Autopilot and Manual mode present a short title/body style message with explicit next actions (`Resume`, choose another member, check provider settings, or try another model) instead of raw payload text.
6. Add an optional details affordance in the runtime error surface that reveals sanitized technical details only on demand, and ensure the default collapsed state stays compact.
7. Add or update unit tests for error classification/wording, integration tests for IPC-visible runtime error payloads, and an Electron scenario covering a representative provider failure rendered in Council View.
8. Update `docs/status.md`, run `bun run trace:generate`, validate traceability, and complete the required repo validation commands.

## Risks and mitigations

- Risk: over-normalizing could hide the one clue users need to fix a provider issue.
  - Mitigation: keep concise primary copy plus an explicit `Show technical details` disclosure with sanitized provider/model context.
- Risk: provider-specific parsing could become brittle as upstream payload wording changes.
  - Mitigation: classify by resilient signals first (status code, stable phrases, known error kinds), then fall back to generic copy when parsing confidence is low.
- Risk: runtime and settings surfaces could drift into inconsistent error wording.
  - Mitigation: centralize normalization/message templates in shared pure helpers and reuse them from both inline notices and toasts where applicable.
- Risk: IPC contracts could accidentally widen to include unsafe raw payload fields.
  - Mitigation: explicitly model the normalized renderer-visible shape and keep raw payloads confined to main-process logs/dev messages.
- Risk: diagnostics become flaky if they depend on live provider quota failures.
  - Mitigation: seed deterministic failure state via test doubles or controlled scenario setup rather than requiring a real provider outage.

## Coverage matrix

| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| `R8.3`, `U12.6`, `U13.4` | `classifies provider quota errors into concise runtime copy` | Verify quota/rate-limit style provider failures produce short retry-oriented user messages instead of raw payload text |
| `R3.24`, `U12.6` | `builds autopilot recovery notice from normalized runtime error` | Verify Autopilot paused-on-error notice stays actionable and compact while preserving Resume guidance |
| `R3.28`, `U13.4` | `builds manual retry notice from normalized runtime error` | Verify Manual mode keeps explicit retry guidance without dumping provider internals |
| `A3`, `C1`, `D5` | `returns sanitized runtime error details over IPC` | Verify renderer-visible runtime error payloads exclude secrets, raw paths, and unsafe provider blobs |
| `U2.6`, `U12.6`, `U13.4` | `council runtime error scenario shows collapsed friendly error with optional details` | Verify Council View shows concise inline/toast failure copy and hides technical details behind an explicit affordance |

## Validation commands to run

- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test:unit`
- `bun run test:integration`
- `bun run trace:generate`
- `bun run check:traceability`
- `bun run diag:electron`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/council-runtime-error-normalization.json`

## Rollback strategy

- Revert the runtime error-normalization helper, Council runtime orchestration updates, renderer error-surface changes, diagnostic scenario, and status/traceability updates if the new copy obscures actionable failures, breaks retry flows, or weakens IPC sanitization guarantees.
