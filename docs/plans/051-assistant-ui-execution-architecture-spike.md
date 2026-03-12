# Plan 051: Assistant UI Execution Architecture Spike

## Objective
Produce an architecture spike for the assistant-driven UI execution initiative, focusing on context shaping, typed tool boundaries, orchestration flow, and safety controls.

## Scope
- Define the recommended execution architecture for the in-app assistant.
- Propose a structured context contract that is safe to expose to the model.
- Propose a typed tool catalog and execution boundary model.
- Define confirmation, cancellation, and audit expectations.
- Break the implementation into research-friendly slices.

## Non-goals
- No runtime implementation.
- No IPC contract/code generation.
- No schema migration or persistence changes yet.
- No final UI design beyond the minimal assistant interaction model already captured in the PRD and UX requirements.

## Architecture impact assessment
- This work touches every major boundary in the app: Renderer, Preload, Main IPC, application handlers, pure shared logic, AI service, and local persistence/audit concerns.
- The spike must preserve the existing dependency direction from `docs/dependency-boundaries.mermaid` and the main-process AI/security rules from `docs/architecture-decision.md`.
- The assistant must orchestrate existing capabilities rather than create a parallel privileged system.

## Step-by-step implementation plan
1. Review the current architecture/security documents plus the new assistant PRD and requirements.
2. Define the recommended assistant execution flow end to end.
3. Define the proposed context envelope, including allowed and forbidden fields.
4. Define the proposed tool taxonomy and execution contracts.
5. Define safety/confirmation/cancellation/audit rules.
6. Define a phased implementation path with smallest useful slices.
7. Update status tracking to point future work at the spike.

## Risks and mitigations
- Risk: the assistant becomes a bypass around domain rules.
  - Mitigation: require all mutations to flow through existing typed commands and handlers.
- Risk: the model receives too much UI noise or sensitive state.
  - Mitigation: define a minimal structured context envelope with explicit exclusions.
- Risk: tool granularity is wrong and creates brittle plans.
  - Mitigation: recommend a hybrid tool set with domain actions first and a small navigation/view layer second.
- Risk: unclear failure handling makes the feature untrustworthy.
  - Mitigation: require plan/step/result visibility and explicit partial-failure semantics.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| R9.4, R9.9, R9.11, R9.14, R9.19 | `assistant context envelope and tool boundary contracts stay safe and typed` | Future implementation should verify that assistant-visible context excludes secrets/raw paths and that execution routes only through typed contracts |
| R9.13, R9.16, R9.20, R9.21, U18.8-U18.15 | `assistant execution control flow handles confirm cancel audit and accessible progress states` | Future implementation should verify confirmation, cancellation, visibility, audit logging, and interaction safety |
| NFR-ASSIST-1-NFR-ASSIST-10 | `assistant architecture slice meets safety reliability and extensibility goals` | Future implementation should verify the spike's recommended boundaries via unit, integration, and Electron diagnostics |

## Validation commands to run
- Documentation review only for this spike.

## Rollback strategy
- Revert the new architecture-spike documents and status references if product direction changes.
