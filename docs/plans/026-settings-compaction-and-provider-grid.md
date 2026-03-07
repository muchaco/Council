# Plan 026: Settings Compaction and Provider Grid

## Objective
Redesign the Settings screen so it feels like a compact control surface instead of a long stacked form, while preserving existing test/save gating and toast-based feedback.

## Scope
- Remove low-value provider metadata from the default view (`Last saved`, idle `Status: Not tested`).
- Keep provider status badges and meaningful inline feedback when actions occur.
- Right-align provider action buttons.
- Present providers in a responsive card grid that scales better as more providers are added.
- Redesign `Global Default Model`, `Context Window`, and `Model Catalog` into compact cards.

## Non-goals
- No IPC or persistence changes.
- No changes to provider test/save business rules.
- No new settings features.

## Architecture impact assessment
- Changes are renderer-only: `src/renderer/App.tsx` and `src/renderer/styles.css`.
- Existing preload/main-process boundaries remain unchanged.
- Requirement coverage remains in the same Settings UX slice; behavior changes are presentational.

## Step-by-step implementation plan
1. Refactor provider cards to remove noisy default metadata and only show useful status messaging.
2. Rework provider cards into a responsive grid with more compact internal spacing and right-aligned actions.
3. Convert lower settings sections into compact cards with consistent label/helper/action layout.
4. Update status documentation to reflect the redesigned Settings presentation.
5. Run lint, typecheck, build, and traceability checks.

## Risks and mitigations
- Risk: removing inline status text hides needed feedback.
  - Mitigation: preserve inline messages for active/meaningful states and keep existing toasts.
- Risk: grid layout feels cramped for long provider notes.
  - Mitigation: keep provider-specific notes minimal and allow cards to grow vertically when needed.
- Risk: styling drift between Settings and Home toolbars.
  - Mitigation: reuse the same spacing, card, and control language already used elsewhere.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| U5.1, U5.2, U5.3 | `renders compact provider settings cards` | Verify Settings remains card-based and provider fields/actions are present |
| U5.4, U5.6, U5.9, U5.11 | `preserves provider save-test gating and feedback` | Keep action gating and user feedback unchanged while redesigning layout |
| U2.1, U2.3, U2.6 | `surfaces meaningful settings feedback without idle noise` | Preserve badges and action-completion feedback while removing redundant idle copy |

## Validation commands to run
- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run trace:generate`
- `bun run check:traceability`

## Rollback strategy
- Revert the renderer-only layout changes in `src/renderer/App.tsx` and `src/renderer/styles.css`.
- Revert the matching `docs/status.md` update if the design direction changes.
