# Plan 008 - Context Window Runtime Prompts

## Objective

Implement bounded runtime prompt context handling so Council generation uses briefing plus the last `N` messages, aligning runtime behavior with architecture decision requirements for context windows.

## Scope

- Add pure shared helpers to normalize/select context window message slices.
- Use bounded context windows in council runtime prompt composition for:
  - member turn generation prompts,
  - conductor briefing/next-speaker decision prompts.
- Wire configurable `N` from main-process app config (`COUNCIL_CONTEXT_LAST_N`) into councils slice dependencies.
- Add unit/integration tests to verify normalization and message omission behavior.
- Update `docs/status.md` traceability for `F1`/`F2` progress.

## Non-goals

- Adding renderer/settings UX for editing context window size.
- Persisting context-window config in SQLite.
- Changing provider request/response schemas.

## Architecture impact assessment

- Preserves dependency direction (`renderer -> preload -> IPC -> slice -> services`).
- Keeps prompt-selection logic pure in shared modules (`src/shared/*`).
- Maintains `AiService` abstraction; no provider-specific logic enters domain/slice prompt decisions.
- Keeps persistence boundary unchanged: only generated messages/briefing are stored.

## Step-by-step implementation plan

1. Add a shared pure context-window helper module with normalization + selection functions.
2. Extend conductor prompt builder to include omitted-message metadata for deterministic behavior/testing.
3. Update councils slice prompt composition to use briefing + last `N` messages for member/conductor calls.
4. Inject `contextLastN` from main config in IPC registration.
5. Add unit tests for context-window helper and extend integration tests for bounded prompt usage.
6. Update status traceability and ongoing-work notes.

## Risks and mitigations

- Risk: changing prompt shape may destabilize fake/test conductor parsing.
  - Mitigation: keep strict conductor JSON contract unchanged; only add contextual metadata lines.
- Risk: invalid `N` config causing runtime failures.
  - Mitigation: clamp/normalize values with defaults and bounds.
- Risk: hidden regression in transcript persistence.
  - Mitigation: run unit/integration suites including sqlite persistence checks.

## Coverage matrix

| Requirement IDs | Planned tests | Validation intent |
| --- | --- | --- |
| F1 | `tests/unit/council-runtime-context-window.spec.ts`, `tests/integration/councils-handlers.integration.spec.ts` | Validate context `N` normalization and prompt slicing to briefing + last `N` messages |
| F2 | `tests/integration/sqlite-persistence.integration.spec.ts`, `tests/integration/councils-handlers.integration.spec.ts` | Ensure persisted data remains outputs only (messages/briefing) while prompts remain transient |
| E1, E2 | `tests/unit/council-runtime-context-window.spec.ts` | Keep prompt context selection pure and deterministic |

## Validation commands

- `bun run lint`
- `bun run typecheck`
- `bun run test:unit`
- `bun run test:integration`
- `bun run build`

## Rollback strategy

- Revert shared context-window helper usage from councils runtime prompt paths.
- Keep existing transcript/briefing persistence untouched.
- Fall back to prior unbounded prompt history behavior until settings-backed context config is implemented.
