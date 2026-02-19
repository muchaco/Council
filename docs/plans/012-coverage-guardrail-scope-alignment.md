# Plan 012 - Coverage Guardrail Scope Alignment

## Objective

Harden coverage guardrails so unit/integration coverage thresholds are measured against architecture-relevant source layers (not only helper scripts), and automate checks that prevent future coverage-scope drift.

## Scope

- Update unit coverage include scope to cover pure shared runtime modules in addition to domain + IPC validators.
- Update integration coverage include scope to cover main-process feature/service/IPC layers plus guardrail scripts.
- Add an automated guardrail script that verifies required coverage include globs remain present in Vitest configs.
- Add an integration test for the new coverage-guardrail verification script.
- Update traceability and status docs.

## Non-goals

- Raising coverage percentage thresholds beyond current policy values.
- Introducing CI workflows in this change.
- Refactoring runtime or settings feature behavior.

## Architecture impact assessment

- Aligns directly with architecture boundaries in `docs/architecture-diagram.mermaid` and `docs/dependency-boundaries.mermaid` by measuring coverage in the pure shared layer and main-process orchestration layers.
- Adds guardrail automation in `scripts/` and verifies it through integration tests, consistent with policy in `agents.md`.
- Does not introduce new cross-layer imports or runtime dependencies.

## Step-by-step plan

1. Expand `vitest.unit.config.ts` coverage include globs for pure runtime helpers.
2. Expand `vitest.integration.config.ts` coverage include globs for main feature/service/IPC layers.
3. Add `scripts/verify-coverage-guardrails.ts` to assert required include globs exist.
4. Add `tests/integration/coverage-guardrails.integration.spec.ts`.
5. Run coverage + integration guardrail validations.
6. Update `docs/status.md` and `agents.md` if new policy clarifications are needed.

## Risks and mitigations

- Risk: expanded integration coverage scope may drop below threshold.
  - Mitigation: target core exercised layers first and validate with `bun run test:coverage:integration`.
- Risk: guardrail script drifts from Vitest config shape.
  - Mitigation: parse exported config object conservatively and assert array-of-string includes only.

## Coverage matrix

| Requirement IDs | Planned tests | Validation intent |
| --- | --- | --- |
| H3, IMPL-006 | `tests/integration/coverage-guardrails.integration.spec.ts` | Ensure coverage enforcement remains architecture-scoped and automation-backed |
| F1, E1 | `bun run test:coverage:unit` | Ensure pure shared runtime helpers are included in unit coverage scope |
| A1, A3, D1, H3 | `bun run test:coverage:integration` | Ensure integration coverage tracks main-process orchestration layers |

## Validation commands

- `bun run test:coverage:unit`
- `bun run test:coverage:integration`
- `bun run test:integration`

## Rollback strategy

- Revert Vitest coverage include updates.
- Remove `scripts/verify-coverage-guardrails.ts` and its integration test.
- Revert status/policy documentation deltas.
