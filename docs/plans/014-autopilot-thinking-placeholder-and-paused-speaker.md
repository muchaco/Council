# Plan 014 - Autopilot Thinking Placeholder + Paused Next-Speaker Indicator

## Objective

Implement the next Autopilot UX increment for Council View by exposing and rendering runtime speaker intent/state so users see immediate in-transcript thinking feedback while a turn is generating (`U12.4`) and a paused-state cached next-speaker hint when known (`U12.5`), while keeping existing pause-on-error + retry behavior (`U12.6`) intact.

## Scope

- Extend runtime generation DTO state with cached planned next-speaker identity.
- Preserve planned next-speaker cache across manual pause transitions.
- Render paused next-speaker hint in Council View when paused and known.
- Render in-transcript thinking placeholder row for the active Autopilot member while generation is running.
- Add/update integration coverage for running-generation speaker state and paused cached speaker visibility.
- Update status traceability.

## Non-goals

- Full two-column transcript/composer/panel layout redesign.
- New background runtime scheduler behavior.
- Changes to provider orchestration or cancellation semantics.

## Architecture impact assessment

- Keeps renderer/main boundaries intact per `docs/architecture-diagram.mermaid` and `docs/dependency-boundaries.mermaid`.
- Data remains DTO-driven over typed IPC; no renderer-side provider/domain logic added.
- Uses existing in-memory planning state in councils slice; no new service dependencies.

## Step-by-step plan

1. Extend `CouncilGenerationStateDto` with `plannedNextSpeakerAgentId`.
2. Populate field in councils slice `toGenerationStateDto` from planned speaker cache.
3. Preserve planned speaker on manual pause (`pauseCouncilAutopilot`).
4. Update Council View render to show:
   - thinking placeholder transcript row for running autopilot speaker
   - paused next-speaker hint when available.
5. Add integration tests in councils handlers/IPC contract suites.
6. Update `docs/status.md` traceability + next-step pointer.

## Validation commands

- `bun run lint`
- `bun run typecheck`
- `bun run test:integration`

## Rollback strategy

- Revert DTO extension and councils slice generation-state changes.
- Revert Council View transcript/status rendering changes.
- Revert added integration assertions and status updates.
