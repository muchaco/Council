# 021 - Council View Right Panel + Manual Mode Baseline

## Goal

Implement the highest-impact open Council View UX/runtime gaps by delivering:

- Right-panel Briefing + Members baseline (`U9.*`)
- Members-driven manual mode speaker triggering (`U13.*`)
- Main-process enforcement for council-view member mutation rules (`R2.17`, `R2.18`)

## Scope

1. **Main-process rules first**
   - Enforce add-member state guard in council-view saves:
     - allowed only before start, while paused, or in Manual mode.
   - Enforce remove-member history guard in council-view saves:
     - block removing members that already have transcript messages.

2. **Renderer council-view structure**
   - Move discussion content to a two-column layout:
     - left column: transcript + conductor composer
     - right column: briefing + members panel

3. **Briefing + Members UI baseline**
   - Briefing section with TLDR, goal status, and last updated timestamp.
   - Members section with:
     - creation-order list
     - avatar initials
     - editable color chip/select from predefined palette
     - remove with confirmation
     - add-member subpanel (search + add)

4. **Manual-mode one-click flow**
   - Replace select-then-generate with direct member-row action (`Select to speak`) in Manual mode.

5. **Validation and status**
   - Add integration tests for add/remove member state and history constraints.
   - Run lint/typecheck/build and guardrails.
   - Regenerate traceability and update status tracking.

## Out of Scope

- Final right-panel visual polish and custom tooltip primitives.
- New business-decision items blocked by `U16.1`, `U16.2`, `U16.4`.

## Validation Checklist

- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test:integration tests/integration/councils-handlers.integration.spec.ts`
- `bun run check:boundaries`
- `bun run check:coverage-guardrails`
- `bun run check:required-scripts`
- `bun run db:migrate:verify`
- `bun run trace:generate`
- `bun run check:traceability`
