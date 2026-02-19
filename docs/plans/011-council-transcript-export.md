# Plan 011 - Council Transcript Export End-to-End

## Objective

Implement transcript export flow for Councils end-to-end, covering functional requirements `R3.32`-`R3.34` and UX requirements `U3.8`, `U3.9`, `U11.6`, `U11.7`.

## Scope

- Add typed IPC contract for transcript export from both Councils list and Council View.
- Implement main-process export boundary as a dedicated service (`electron` save dialog + markdown file write).
- Keep renderer free of filesystem APIs and provider secrets.
- Wire export triggers in:
  - Councils list overflow menu (`Export`, `Archive/Restore`, `Delete`),
  - Council View top action row (`Export`).
- Build markdown transcript content from persisted council + message data only.
- Ensure export output includes title/topic/goal and message UI fields except color.
- Add/extend validator, IPC contract, and councils slice integration tests.
- Update traceability in `docs/status.md`.

## Non-goals

- Full redesign of Council View two-column UX.
- Replacing native prompt/confirm interactions with custom dialog components.
- Background export queues or batch multi-council export.

## Architecture and boundary alignment

- Renderer -> preload -> IPC -> councils slice -> export service.
- `ExportService` remains main-only and performs dialog/file IO.
- No raw prompt persistence added; export uses stored council metadata and transcript messages only.
- No new renderer imports from `src/main/*` or direct `electron` usage.

## Implementation steps

1. Extend shared IPC DTO/validators with `exportTranscript` request/response.
2. Add `ExportService` interface contract and Electron-backed implementation.
3. Inject export service into councils slice dependencies.
4. Add councils slice export command and markdown formatter.
5. Wire IPC handler + channel registration + preload bridge + window API surface.
6. Add renderer actions in Councils list overflow and Council View.
7. Add unit/contract/integration tests for validation and export behavior.
8. Update traceability (`docs/status.md`).

## Risks and mitigations

- Risk: invalid file names from user-provided council titles.
  - Mitigation: sanitize suggested filename in main service.
- Risk: export flow errors are silent.
  - Mitigation: explicit error mapping and renderer error toasts.
- Risk: adding IO in wrong layer.
  - Mitigation: keep file dialog + write in dedicated main service; renderer remains IPC-only.

## Validation commands

- `bun run lint`
- `bun run typecheck`
- `bun run test:unit`
- `bun run test:integration`
- `bun run build`

## Gaps after this plan

- Dedicated modal UX for Autopilot start/resume (`U12.4`-`U12.6`) still pending.
- Broader Council View layout/accessibility polish remains open.
