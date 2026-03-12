# Plan 053: Assistant Tool Contract Specification

## Objective
Define the concrete contract model for assistant tools so implementation can expose a typed, safe, and testable tool surface for the assistant-driven UI execution feature.

## Scope
- Define normative assistant tool contract components.
- Define request/response/result/error/reconciliation shapes.
- Define risk, confirmation, and execution metadata required per tool.
- Define category-level tool expectations and versioning rules.
- Establish a planning-ready baseline for future code implementation.

## Non-goals
- No code implementation of assistant tools.
- No final IPC event protocol.
- No exhaustive final list of every future tool; this defines the contract system and initial catalog shape.

## Architecture impact assessment
- This specification sits between the assistant architecture spike and the eventual implementation.
- It preserves the existing boundary model by making every assistant capability a typed contract rather than implicit orchestration behavior.
- It also incorporates the reconciliation matrix so visible completion becomes part of tool design, not only runtime glue.

## Step-by-step implementation plan
1. Define the required fields for every assistant tool definition.
2. Define the planned tool call, result, error, and reconciliation shapes.
3. Define tool category expectations and initial catalog candidates.
4. Define confirmation/risk policy binding at the tool-contract level.
5. Define versioning and extensibility rules.
6. Update status tracking so the spec is discoverable for implementation planning.

## Risks and mitigations
- Risk: tool contracts become too loose and allow ambiguous execution.
  - Mitigation: require typed inputs/outputs, explicit confirmation metadata, and normalized result/error shapes.
- Risk: visible UI reconciliation stays undocumented per tool.
  - Mitigation: require reconciliation metadata in every mutating tool contract.
- Risk: future tool additions drift in style and safety.
  - Mitigation: define category conventions and versioning rules now.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| R9.8, R9.9, R9.10, R9.11, R9.14, R9.19 | `assistant tool definitions enforce typed safe execution boundaries` | Future implementation should verify that every tool is typed, category-classified, safety-scoped, and routed through approved boundaries |
| R9.13, R9.16, R9.17, R9.18, R9.22, U18.8-U18.13 | `assistant tool execution metadata supports confirm cancel progress and visible completion semantics` | Future implementation should verify that tool contracts carry enough metadata for confirmation, progress UX, cancellation handling, and reconciliation |

## Validation commands to run
- Documentation review only for this specification.

## Rollback strategy
- Revert the documentation-only contract spec and references if product direction changes.
