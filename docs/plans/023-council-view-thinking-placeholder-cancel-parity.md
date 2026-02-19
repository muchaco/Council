# 023 - Council View Thinking Placeholder and Inline Cancel Parity

## Objective

Finish the highest-value remaining Council View runtime transcript parity by ensuring thinking placeholders cover active member generation in both autopilot and manual flows, with cancel action colocated next to the active placeholder and explicit manual retry guidance copy.

## Scope

1. **Thinking placeholder parity (`U8.6`, `U8.8`)**
   - Derive the active thinking speaker from runtime generation state and pending manual turn requests.
   - Keep placeholder rendering as the final transcript row with avatar, sender accent, and ellipsis.

2. **Inline cancel affordance (`U8.7`)**
   - Render cancel action adjacent to the visible thinking placeholder.
   - Keep top-bar cancel as a fallback only when generation has no placeholder speaker context.

3. **Manual retry guidance copy (`U13.4`)**
   - Provide explicit in-view retry guidance after manual member generation errors.
   - Keep manual mode interaction model unchanged (member-driven selection in Members panel).

4. **Status and traceability updates**
   - Update `docs/status.md` requirement rows and ongoing work text.
   - Regenerate traceability artifacts after test changes.

## Non-goals

- Start-button placement nuances (`U8.10`) and broader empty-state redesign.
- Product-decision-blocked items (`U16.1`, `U16.2`, `U16.4`).
- Main-process runtime orchestration changes or IPC schema updates.

## Architecture impact assessment

- **Boundary compliance:** renderer and shared pure helper changes only (`src/renderer/*`, `src/shared/*`), preserving Renderer -> Preload -> Main IPC boundaries.
- **FCIS alignment:** derivation and copy logic remain pure helper functions; no new IO in shared modules.
- **IPC stability:** existing DTO contracts remain unchanged.
- **Security posture:** no secrets/path handling changes and no new IPC surface.

## Step-by-step implementation plan

1. Add shared pure helper logic for thinking-speaker derivation and inline-cancel visibility.
2. Extend Council View ready state to track pending manual speaker while manual generation request is in flight.
3. Update transcript rendering to show inline cancel beside placeholder when applicable.
4. Add manual retry guidance notice helper and wire it into manual error presentation.
5. Add/extend unit tests with requirement-tagged cases for `U8.6`, `U8.7`, `U8.8`, `U13.4`.
6. Run lint/type/unit + transcript diagnostics scenario validation.
7. Update status docs and regenerate requirement traceability outputs.

## Scope validations

- ✅ No domain or service coupling introduced into renderer helpers.
- ✅ No DTO/schema or IPC handler changes required.
- ✅ Placeholder semantics remain non-streaming and cancel-discard compatible.
- ✅ Product-decision-blocked UX areas remain unchanged and explicitly tracked.

## Risks and mitigations

- **Risk:** duplicate cancel controls create UI clutter.
  - **Mitigation:** show top-bar cancel only when no inline thinking placeholder exists.
- **Risk:** manual pending generation state drifts from server snapshot state.
  - **Mitigation:** use pending manual speaker only as a temporary UI fallback and reset on refresh/error.
- **Risk:** retry guidance appears in non-generation error contexts.
  - **Mitigation:** source guidance from manual-turn error path only.

## Coverage matrix

| Requirement IDs | Planned validation | Intent |
| --- | --- | --- |
| U8.6, U8.8 | `tests/unit/council-view-transcript.spec.ts` | Verify thinking-speaker resolution for running generation and pending manual-turn states |
| U8.7 | `tests/unit/council-view-transcript.spec.ts` | Verify inline cancel visibility is coupled to visible thinking placeholder state |
| U13.4 | `tests/unit/council-view-autopilot-recovery.spec.ts` | Verify explicit manual retry guidance copy and guard conditions |
| U8.3, U8.5 (regression) | `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/council-view-transcript.json` | Ensure transcript shell behavior remains stable after placeholder/cancel changes |

## Validation commands

- `bun run test:unit -- council-view-transcript council-view-autopilot-recovery`
- `bun run typecheck`
- `bun run lint`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/council-view-transcript.json`

## Rollback strategy

- Revert this slice's renderer/shared helper/test/status updates only.
- Keep prior transcript placeholder and cancellation behavior from plan `022` baseline while reassessing runtime UX parity.
