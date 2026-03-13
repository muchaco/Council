## Objective

Close the remaining Slice 6 blocker by removing renderer-minted runtime lease trust and enforcing main-issued lease authenticity for assistant runtime mutation tools.

## Scope

- Issue assistant runtime lease IDs from main-owned councils runtime state.
- Return the lease ID in council view payloads consumed by renderer assistant context.
- Validate lease authenticity in assistant runtime mutation scope checks.
- Add focused integration coverage for forged/unknown lease rejection and valid lease acceptance.

## Non-goals

- Changing council runtime domain rules, planner behavior, or tool output shape.
- Adding new assistant tools or widening IPC surfaces beyond lease authenticity support.

## Architecture impact assessment

- Preserves dependency direction: renderer consumes lease from `getCouncilView`; main validates in assistant slice through councils slice authority.
- Keeps secrets and lease authority in main process state.
- Does not move domain logic into services; lease issuance/validation remains in main feature slices.

## Step-by-step implementation plan

1. Extend `GetCouncilViewResponse` with an `assistantRuntimeLeaseId` issued by main.
2. Add main-owned lease state in councils slice keyed by `webContentsId` + `councilId` with issuance and release APIs.
3. Wire renderer council view assistant context to consume the main-issued lease (remove renderer UUID minting).
4. Add assistant slice lease validation using councils slice authority before runtime mutation tools execute.
5. Add/update integration tests for:
   - valid main-issued lease acceptance,
   - forged/unknown lease rejection.
6. Run focused typecheck and integration suites.

## Risks and mitigations

- Risk: stale lease map growth per window lifecycle.
  - Mitigation: release lease map entries via IPC teardown (`releaseWebContentsResources`).
- Risk: regression in runtime mutation gating.
  - Mitigation: keep existing council scope checks and add forged-lease test.

## Coverage matrix

- `R9.11`, `R9.21`, `R9.22`, `A1`, `A3` -> `rejects runtime mutation tools when the council view lease token is forged` -> verifies forged lease rejection.
- `R9.11`, `R9.17`, `R9.18`, `R9.21`, `R9.22`, `U18.10`, `A1`, `A3` -> `executes runtime mutation tools only from the active council view lease and waits for reconciliation` -> verifies valid lease acceptance remains intact.

## Validation commands to run

- `bun run typecheck`
- `bun test tests/integration/assistant-ipc.contract.integration.spec.ts`
- `bun test tests/integration/councils-handlers.integration.spec.ts`

## Rollback strategy

- Revert lease issuance/validation additions in assistant + councils slices and restore prior renderer runtime lease behavior if regressions are found.
