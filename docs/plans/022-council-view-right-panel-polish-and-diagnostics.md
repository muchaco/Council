# 022 - Council View Right-Panel Polish and Diagnostics Coverage

## Objective

Close the highest-value remaining Council View right-panel UX gaps by improving Briefing goal-reached treatment and Members disabled-reason affordances, then add deterministic diagnostics coverage for right-panel add/remove/color/manual interaction paths.

## Scope

1. **Briefing goal-reached callout polish (`U9.1`)**
   - Replace the baseline goal-reached status line with a stronger in-panel callout treatment.
   - Preserve existing data contract (`briefing`, `goalReached`, `updatedAtUtc`) and no animation behavior (`U9.2`).

2. **Members disabled-reason affordances (`U9.4`, `U9.6`)**
   - Compute explicit remove-disabled reasons in renderer state derivation.
   - Surface reasons in the row UI as accessible hint text instead of relying only on native `title` tooltips.
   - Keep remove confirmation path unchanged when removal is allowed.

3. **Diagnostics scenario coverage expansion**
   - Extend right-panel scenario to validate add-member panel interaction, member color updates, member removal confirmation path, and manual-mode member action visibility.
   - Keep scenario deterministic with seeded council data created via `window.api.*` calls.

## Non-goals

- Transcript bubble layout-depth work (`U8.3`-`U8.5`) beyond what already exists.
- Product-decision-blocked interaction changes (`U16.1`, `U16.2`, `U16.4`).
- Main-process runtime rule changes (already covered under `R2.17`, `R2.18`).

## Architecture impact assessment

- **Boundary compliance:** renderer-only UX adjustments in `src/renderer/*`; no direct provider, DB, or keychain access added.
- **FCIS alignment:** no domain rule moved into UI; renderer only formats/communicates reasons derived from already-exposed runtime data.
- **IPC contract stability:** no DTO schema changes required.
- **Diagnostics alignment:** scenario uses preload-exposed API and UI interactions, matching existing tool architecture.

## Step-by-step implementation plan

1. Add renderer helper for member remove disabled-reason resolution.
2. Update Members row rendering to show explicit disabled reason hint text with accessible linkage.
3. Upgrade Briefing goal-reached rendering to a richer callout block.
4. Add CSS classes for callout and disabled-reason affordances with mobile-safe behavior.
5. Expand `scripts/diagnostics/scenarios/council-view-right-panel.json` to cover add/remove/color/manual flows.
6. Update status tracking docs (`docs/status.md`; `agents.md` only if policy/process changes are introduced).
7. Run validation commands and adjust implementation if failures appear.

## Risks and mitigations

- **Risk:** scenario flakiness from environment-specific seeded data.
  - **Mitigation:** seed deterministic council/agents in scenario via `evaluate` and assert concrete saved values.
- **Risk:** UX change creates noisy row layout on small screens.
  - **Mitigation:** keep hint text concise and style with subdued typography; verify responsive CSS behavior.
- **Risk:** accidental behavior drift in member removal gating.
  - **Mitigation:** keep disable boolean source-of-truth tied to existing conditions and validate with diagnostics + integration suite.

## Coverage matrix

| Requirement IDs | Planned validation | Intent |
| --- | --- | --- |
| U9.1, U9.2 | Updated right-panel diagnostics scenario + manual Council View check | Verify richer goal-reached callout presence without update animation behavior changes |
| U9.4, U9.6 | Updated right-panel diagnostics scenario | Verify member-row controls and explicit disabled-reason affordances for remove action |
| U9.7, U9.8 | Updated right-panel diagnostics scenario | Verify add-member subpanel and manual speaker action visibility in Members panel |

## Validation commands

- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/council-view-right-panel.json`

## Rollback strategy

- Revert renderer/style and scenario deltas for this slice only.
- Keep prior right-panel baseline (`021`) intact while reassessing affordance design.
