# Plan 054: Assistant UI Execution Implementation Plan

## Objective
Implement the assistant-driven UI execution feature as a bounded, typed, auditable capability that lets users describe outcomes in natural language and have Council execute the same user-visible workflows available through the manual UI, while preserving architecture, security, validation, reconciliation, and cancellation guarantees.

## Scope
- Add the global assistant launcher and assistant modal UX required by `R9.1`, `R9.2`, `U18.1`-`U18.15`.
- Implement assistant execution on the current Global Default Model per `R9.3`.
- Implement a structured `AssistantContextEnvelope` aligned with `R9.4`, `R9.19`, `A1`, `A3`, `D5`, `F2`.
- Implement a typed assistant tool catalog using the contract rules from `docs/assistant-tool-contract-specification.md`.
- Implement the clarify / confirm / execute control flow required by `R9.7`, `R9.13`, `R9.17`, `R9.18`, `U18.7`-`U18.11`.
- Implement renderer/main reconciliation rules from `docs/assistant-ui-reconciliation-matrix.md` so the assistant never reports done before the visible UI reflects the completed action.
- Implement dirty-draft handling, destructive/bulk confirmation policy, cancellation semantics, and no-background-execution behavior per `R9.14`, `R9.16`, `R9.21`, `U18.9`, `U18.13`.
- Persist sanitized local execution/audit records per `R9.20`.
- Add unit, integration, IPC, boundary, coverage, traceability, and Electron diagnostic coverage.

## Non-goals
- No direct DOM automation as the primary execution model.
- No assistant-only privileged mutation path that bypasses existing feature handlers.
- No secret, credential, raw prompt payload, or raw filesystem path exposure in renderer-visible context, tool results, confirmations, audit payloads, or logs.
- No autonomous background assistant work after modal close or after the active Council View lease ends.
- No attempt to expose the full app capability surface in the first implementation slice; the catalog should expand in curated phases.

## Architecture impact assessment
- This feature adds a new vertical slice spanning `src/renderer`, `src/preload`, `src/main/ipc`, `src/main/features`, `src/shared`, and persistence/logging boundaries.
- Boundary compliance is mandatory:
  - `A1`, `A2`, `A3`: renderer remains UI-only, preload remains narrow, main validates all typed assistant payloads, and IPC never exposes secrets or raw paths.
  - `D1`, `D5`: model access and credentials stay in main via `AiService`; the assistant uses the default model through main-process orchestration only.
  - `E1`, `E2`, `E4`: domain/policy logic stays pure where possible, expected failures use typed `Result` / `ResultAsync`, and services stay IO-only.
  - `F2`: raw prompts/provider payloads are not persisted; only sanitized assistant execution summaries and tool outcomes are stored.
- The assistant must be implemented as orchestration over existing app capabilities:
  - planner/orchestrator in main,
  - typed contracts in shared/preload/main IPC,
  - mutation tools routed through the same handlers manual UI already uses,
  - reconciliation treated as part of tool completion, not best-effort glue.
- `docs/assistant-tool-contract-specification.md` is a hard contract constraint:
  - every tool definition must carry `name`, `version`, `category`, `risk`, `requiresConfirmation`, `confirmationPolicy`, schemas, and `reconciliation`.
- `docs/assistant-ui-reconciliation-matrix.md` is a hard completion constraint:
  - mutating steps are complete only when authoritative mutation succeeded and the user can see the resulting state.

## Recommended implementation shape

### Core modules
- Shared pure modules:
  - `src/shared/assistant/assistant-context.ts`
  - `src/shared/assistant/assistant-plan-schema.ts`
  - `src/shared/assistant/assistant-tool-definitions.ts`
  - `src/shared/assistant/assistant-tool-schemas.ts`
  - `src/shared/assistant/assistant-risk-policy.ts`
  - `src/shared/assistant/assistant-reconciliation.ts`
  - `src/shared/assistant/assistant-audit.ts`
- Main slice:
  - `src/main/features/assistant/slice.ts`
  - `src/main/features/assistant/ipc-handlers.ts`
  - `src/main/services/assistant/assistant-audit-service.ts`
- Renderer:
  - `src/renderer/components/assistant/AssistantLauncher.tsx`
  - `src/renderer/components/assistant/AssistantModal.tsx`
  - `src/renderer/components/assistant/assistant-ui-state.ts`
- IPC/preload/shared contracts:
  - extend `src/shared/ipc/dto.ts`
  - extend `src/shared/ipc/validators.ts`
  - extend `src/shared/ipc/window-api.ts`
  - extend `src/preload/index.ts`
  - register handlers in `src/main/ipc/register-ipc.ts`

### UI placement
- Mount the launcher and modal at the top of `src/renderer/App.tsx` so it is global across Home and full-screen views.
- Render the launcher in the active top bar area for:
  - Home via `src/renderer/components/navigation/HomeTopBar.tsx`
  - Council View via `src/renderer/components/council-view/CouncilViewHeader.tsx`
  - Agent/Council editor headers by passing the same launcher trigger down from `App`.
- Keep modal state global so view changes do not orphan the interaction surface.

### Execution model
- Main owns planning and tool execution.
- Renderer sends:
  - user request,
  - sanitized `AssistantContextEnvelope`,
  - assistant session ID,
  - optional clarification/confirmation response.
- Main returns one of:
  - `clarify`
  - `confirm`
  - `execute`
  - `result`
- Main executes approved planned calls step-by-step, with:
  - schema validation,
  - policy validation,
  - tool-level confirmation checks,
  - reconciliation tracking,
  - cancellation via `AbortController`,
  - sanitized audit persistence.

### Draft-edit tool rule
- Draft-edit tools are the one area without an existing main application handler because unsaved drafts live in renderer state.
- To stay aligned with `R9.11` and the tool-contract docs:
  - plan and policy still live in main,
  - draft-edit tools must travel through typed preload contracts,
  - renderer executes only a narrow typed draft-action adapter for current visible draft state,
  - renderer must acknowledge completion back to main with normalized result metadata,
  - persistence remains separate through the normal save handlers.
- Do not implement draft editing as DOM click/input simulation.

## Tool catalog strategy

### Phase 1 catalog
- Read/navigation:
  - `navigateToHomeTab`
  - `openAgentEditor`
  - `openCouncilEditor`
  - `openCouncilView`
  - `listAgents`
  - `listCouncils`
  - `getAgent`
  - `getCouncil`
  - `getCouncilRuntimeState`
- Draft-edit:
  - `setAgentDraftFields`
  - `setCouncilDraftFields`
  - `addCouncilDraftMember`
  - `removeCouncilDraftMember`
  - `setHomeQuery`
  - `resetHomeQuery`

### Phase 2 catalog
- Commit/entity flows:
  - `saveAgentDraft`
  - `saveCouncilDraft`
  - `createAgent`
  - `createCouncil`
  - `updateAgent`
  - `updateCouncilConfig`

### Phase 3 catalog
- Runtime:
  - `startCouncil`
  - `pauseCouncil`
  - `resumeCouncil`
  - `cancelCouncilGeneration`
  - `selectManualSpeaker`
  - `sendConductorMessage`

### Phase 4 catalog
- Destructive/bulk/settings/export:
  - `archiveAgent`
  - `restoreAgent`
  - `deleteAgent`
  - `archiveCouncil`
  - `restoreCouncil`
  - `deleteCouncil`
  - `exportCouncil`
  - `saveProviderConfig`
  - `disconnectProvider`
  - `refreshModelCatalog`
  - `setGlobalDefaultModel`

## Step-by-step implementation plan

### Phase 0: Contracts, safety spine, and planning prompt foundation
1. Add a new implementation status entry in `docs/status.md` marking assistant work as implementation in progress and link this plan.
2. Define shared assistant DTOs/schemas in `src/shared/ipc/dto.ts` and `src/shared/ipc/validators.ts`:
   - session create/submit/cancel/close events,
   - `AssistantContextEnvelope`,
   - `AssistantPlanResult`,
   - `AssistantPlannedToolCall`,
   - `AssistantToolExecutionResult`,
   - `AssistantConfirmationRequest`,
   - normalized assistant error/result state.
3. Define shared pure tool contracts exactly per the tool-contract specification:
   - stable `name`,
   - `version`,
   - `category`,
   - `risk`,
   - `requiresConfirmation`,
   - `confirmationPolicy`,
   - input/output schemas,
   - reconciliation metadata.
4. Define shared pure policy helpers:
   - tool lookup and schema validation,
   - confirmation requirement resolution,
   - dirty-draft impact classification,
   - reconciliation success checks,
   - sanitizer utilities for context, errors, and audit payloads.
5. Add `assistant.*` preload/main IPC surface and register the new assistant slice.
6. Implement the main assistant slice skeleton:
   - session lifecycle,
   - default-model resolution via existing settings/model resolution rules,
   - planner prompt builder,
   - structured-response parsing,
   - per-session cancellation controller,
   - no-background-execution guard.
7. Add assistant audit persistence skeleton:
   - start with file logger integration for fast bring-up,
   - plan SQLite table in the same phase if durable queryable history is required immediately.
8. Add unit tests for contracts/policy/sanitization before UI work starts.

### Phase 1: Launcher, modal UX, default-model planning, clarify flow, and low-risk visible tools
1. Implement the global launcher and modal shell in the renderer:
   - top-left launcher placement,
   - context banner,
   - conversation area,
   - multiline input,
   - send/close actions,
   - desktop centered dialog and narrow-width responsive variant,
   - focus trap and focus return.
2. Mount the assistant UI from `src/renderer/App.tsx` so it survives screen switches.
3. Implement renderer-side assistant session state:
   - idle,
   - planning,
   - clarify,
   - confirm,
   - executing,
   - success,
   - partial,
   - failure,
   - cancelled.
4. Implement structured context-envelope builders per active screen:
   - home list query state,
   - agent editor dirty draft summary,
   - council editor dirty draft summary,
   - council runtime summary without transcript body,
   - active entity IDs and shell state.
5. Implement Phase 1 tools:
   - read/navigation tools,
   - low-risk draft-edit tools,
   - list query tools.
6. Implement clarify flow:
   - model can ask one or more concise follow-up questions,
   - prior user request remains visible,
   - response loops back through the same session.
7. Implement cancellation and close behavior for this phase:
   - cancel stops planning/execution,
   - closing during active work prompts the `U18.13` confirmation,
   - completed steps remain completed.
8. Implement audit records for plan/clarify/execute transitions.
9. Add Electron diagnostics for:
   - launcher visibility in Home and full-screen views,
   - modal focus/keyboard behavior,
   - clarify flow,
   - navigation/read responses,
   - draft-edit visible reconciliation.

### Phase 2: Single-entity create/edit/save flows with reconciliation and dirty-draft policy
1. Add commit/entity tools for agent/council create and update flows.
2. Implement explicit dirty-draft policy from the reconciliation matrix:
   - if request targets current dirty draft, patch in place,
   - if request implies saving current dirty draft, route through normal save handlers,
   - if request would replace current dirty draft or navigate away, require confirmation first,
   - assistant must prefer in-place completion over draft displacement.
3. Implement reconciliation strategies per tool:
   - `patch-local` for current draft,
   - `reload-entity` after save/update,
   - `navigate-and-load` after create when object-centric,
   - `refresh-query` when list-centric.
4. Implement validation parity:
   - inline validation errors stay in the editor,
   - assistant reports blockers in user-safe language,
   - save remains blocked by the same invalid-config, archived, uniqueness, and required-field rules as manual UI.
5. Implement result summaries with direct destination hints.
6. Extend audit records with:
   - sanitized planned inputs,
   - completed/skipped/failed steps,
   - reconciliation outcomes.
7. Add tests and Electron scenarios for:
   - create agent from assistant,
   - update council draft then save,
   - validation blocker reporting,
   - dirty-draft replacement confirmation,
   - visible-state completion before success messaging.

### Phase 3: Council runtime assistant with lease-aware cancellation and visible runtime reconciliation
1. Add runtime tools using the existing council runtime handlers only.
2. Require active Council View context/lease for runtime mutations that depend on the current runtime surface.
3. Implement runtime-specific plan rules:
   - assistant cannot keep running after modal close,
   - assistant cannot continue after leaving the active Council View lease,
   - runtime tools must honor archived/invalid-config/state-machine constraints exactly as manual UI.
4. Reuse existing council runtime cancellation/abort patterns in main so:
   - assistant cancellation stops future tool calls,
   - in-flight runtime generation aborts correctly,
   - partial output is discarded,
   - no hidden background continuation occurs.
5. Reconcile runtime tools only when Council View visibly reflects:
   - paused/running/completed state,
   - updated controls,
   - transcript/briefing changes,
   - inline notices for failures.
6. Add diagnostic scenarios for:
   - open council and resume autopilot,
   - pause/cancel from assistant,
   - manual speaker selection,
   - conductor message send,
   - assistant cancellation during runtime action.
7. Add integration tests for runtime lease loss and modal-close cancellation semantics.

### Phase 4: Destructive, bulk, export, and settings actions with strong confirmation
1. Add destructive and bulk tools gradually; do not add generic bulk mutation before policy is proven on narrow cases.
2. Implement confirmation payload generation from tool contract plus actual scope:
   - summary,
   - affected count,
   - examples,
   - reversible/irreversible note,
   - draft impact.
3. Enforce confirmation for:
   - all deletes,
   - bulk archive/restore/delete,
   - inferred multi-entity scope,
   - draft replacement,
   - provider/settings mutations.
4. Implement list reconciliation rules from the matrix:
   - refresh current list query,
   - preserve or explain filters,
   - explain when an updated item disappears because the active filter no longer includes it.
5. Implement export result UX without exposing raw paths.
6. Implement settings tool handling with strict sanitization and invalid-config refresh.
7. Add destructive/bulk diagnostics for:
   - archive filtered councils,
   - delete single entity from detail view,
   - disconnect provider confirmation,
   - filtered-list disappearance explanation.

### Phase 5: Audit trail hardening, observability, and rollout stabilization
1. Finalize durable assistant execution storage if Phase 0 started with logger-only audit.
2. Add query/read support for local debugging if needed, but keep audit UI out of scope unless separately planned.
3. Add structured logging hooks for:
   - session start/end,
   - plan parse failures,
   - tool execution timing,
   - reconciliation lag,
   - cancellation reason.
4. Add coverage guardrail updates if assistant modules expand covered scope.
5. Update `docs/status.md`, regenerate traceability, and ensure every new externally visible behavior has `itReq([...])` test coverage.
6. Refresh CI/local validation parity and add assistant Electron scenarios to the standard validation story.

## Recommended first implementation slice
Build Phase 1 first, but include the smallest useful draft-edit capability:

- launcher + modal shell,
- default-model planning in main,
- structured context envelope,
- typed tool registry and policy engine,
- clarify flow,
- read/navigation tools,
- one in-place draft-edit path for the current editor (`setAgentDraftFields` and `setCouncilDraftFields`),
- cancellation + close confirmation,
- sanitized audit logging.

Why this is the best first slice:
- It proves the hardest architectural seam early: main-owned planning with renderer-visible reconciliation.
- It validates `R9.1`-`R9.9`, `R9.16`-`R9.19`, `U18.1`-`U18.8`, `U18.12`-`U18.15` without introducing destructive risk.
- It exercises the reconciliation matrix on both navigation and visible draft patching.
- It exercises dirty-draft behavior safely before persistence and bulk mutations.
- It creates the stable tool/session contract all later slices can extend.

## Hardest risks and mitigations
- Risk: current visible draft state lives in renderer, but assistant planning/execution belongs in main.
  - Mitigation: keep planning/policy in main, define typed draft-action tools over preload, require renderer acknowledgement with normalized result metadata, and keep persistence through normal save handlers only.
- Risk: the assistant reports success before the UI visibly updates.
  - Mitigation: make reconciliation metadata mandatory for all mutating tools, treat `successCondition` as part of execution completion, and fail to `partial` when authoritative success is not yet visible.
- Risk: model output for tool plans is malformed or policy-unsafe.
  - Mitigation: use a strict response union (`clarify` / `confirm` / `execute`), schema-validate all responses, reject unknown tools, and map denials to `PolicyError`.
- Risk: destructive or inferred-scope actions overreach.
  - Mitigation: derive confirmation payloads from actual planned inputs and resolved affected IDs, require explicit confirm for destructive/bulk/inferred-scope actions, and include counts/examples in the modal.
- Risk: cancellation semantics become ambiguous after partial completion.
  - Mitigation: adopt step-level statuses (`success`, `failed`, `skipped`, `cancelled`), stop only future steps on cancel, and summarize exactly what completed.
- Risk: runtime tools violate the no-background-execution and active-lease rules.
  - Mitigation: bind assistant runtime execution to the same Council View lease/cancellation patterns used by manual runtime flows and stop work on modal close or lease loss.
- Risk: assistant context, results, or audits leak secrets or raw paths.
  - Mitigation: sanitize context at construction time, sanitize tool outputs/errors before renderer exposure, keep credentials in main/keychain, and never persist raw prompts/provider payloads/paths.
- Risk: adding too many tools too quickly creates an untestable surface.
  - Mitigation: grow the catalog in curated phases and require each new tool to land with schemas, tests, reconciliation metadata, confirmation policy, and an Electron scenario when user-visible.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| `R9.1`, `R9.2`, `U18.1`, `U18.2`, `U18.3`, `U18.4`, `U18.14`, `U18.15` | `assistant launcher and modal are available across home and detail views` | Verify global launcher placement, modal rendering, responsive layout, focus trap, escape/close semantics, and focus return |
| `R9.3`, `A1`, `D1`, `D5` | `assistant planning always resolves through the global default model in main` | Verify renderer never chooses a separate assistant model and model/provider access stays inside main |
| `R9.4`, `R9.19`, `A3`, `D5`, `F2` | `assistant context envelope excludes secrets raw paths and raw prompt payloads` | Verify sanitized context construction and renderer-visible safety |
| `R9.5`, `R9.7`, `R9.8`, `R9.9`, `R9.11`, `U18.7` | `assistant planner returns clarify confirm or typed execute plans only` | Verify structured planning, typed tool references, and no DOM-automation plan leakage |
| `R9.14`, `R4.3`, `U10.8`, `U18.13` | `assistant respects dirty draft policy before replacing or leaving current editor state` | Verify in-place draft modification, discard confirmation, and no silent draft loss |
| `R9.14`, `R9.15`, `E1`, `E2`, `E4` | `assistant mutation tools preserve manual validation and state-machine rules` | Verify existing handlers remain authoritative and expected failures return typed safe errors |
| `R9.13`, `R9.12`, `U18.9` | `assistant destructive and bulk actions require explicit scoped confirmation` | Verify summary, counts/examples, reversible note, and confirm/cancel gating before execution |
| `R9.17`, `R9.18`, `R9.22`, `U18.8`, `U18.10`, `U18.11` | `assistant reports progress and final state only after visible reconciliation completes` | Verify planning/executing/success/partial/failure UX and completion-ready semantics |
| `R9.16`, `R9.21`, `R3.10`, `R3.11`, `R8.2`, `D4` | `assistant cancellation stops future steps and discards in-flight runtime output` | Verify cancellation semantics, no silent rollback of completed steps, and no background continuation |
| `R9.20`, `A3`, `D5`, `F2` | `assistant audit records persist sanitized request plan step and outcome metadata` | Verify audit persistence excludes secrets, raw paths, and raw prompt/provider payloads |
| `U18.6`, `U18.7`, `U18.8`, `U18.12` | `assistant modal scenario covers enter send clarification progress and context banner` | Verify interaction flow and contextual visibility in renderer diagnostics |
| `R9.14`, `R9.22`, `docs/assistant-ui-reconciliation-matrix.md` constraints | `assistant tool reconciliation metadata drives visible completion behavior` | Verify mutating tools cannot report plain done until their declared reconciliation strategy succeeds |

## Tests and diagnostics strategy

### Unit tests
- Shared pure assistant policy modules:
  - tool registry lookup/versioning
  - confirmation decision rules
  - dirty-draft impact classification
  - context-envelope sanitization
  - plan response parsing/validation
  - reconciliation state evaluation
  - audit sanitization
- Use `itReq([...])` for every assistant unit spec.

### Integration tests
- Assistant main slice orchestration with controlled fakes for `AiService`, logger, clock, UUID, and persistence.
- IPC contract tests:
  - schema validation
  - unknown-tool rejection
  - safe error mapping
  - no secret/path leaks
- Feature integration:
  - create/update flows routed through existing handlers
  - runtime cancellation/lease loss
  - audit persistence
  - list/detail/runtime reconciliation outcomes

### Electron diagnostics
Create reusable scenarios under `scripts/diagnostics/scenarios/`:
- `assistant-launcher-modal-smoke.json`
- `assistant-clarify-read-navigation.json`
- `assistant-current-draft-assist.json`
- `assistant-create-agent-flow.json`
- `assistant-council-runtime-actions.json`
- `assistant-destructive-confirmation.json`

Diagnostic rules:
- seed deterministic preconditions through typed app APIs where possible,
- validate success and expected blocking paths,
- inspect visible completion, not only hidden state,
- treat failures as blocking.

### Coverage and guardrails
- Keep unit coverage on shared assistant policy modules and validators.
- Keep integration coverage on `src/main/features/assistant`, assistant IPC handlers, and audit/persistence adapters.
- Ensure boundary checks fail if renderer imports main-only assistant logic or if assistant logic bypasses existing feature handlers for normal mutations.

## Validation commands to run
- `bun run format:check`
- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test:unit`
- `bun run test:integration`
- `bun run test:coverage`
- `bun run check:coverage-guardrails`
- `bun run check:boundaries`
- `bun run check:migrations`
- `bun run check:required-scripts`
- `bun run trace:generate`
- `bun run check:traceability`
- `bun run diag:electron`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/assistant-launcher-modal-smoke.json`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/assistant-clarify-read-navigation.json`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/assistant-current-draft-assist.json`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/assistant-create-agent-flow.json`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/assistant-council-runtime-actions.json`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/assistant-destructive-confirmation.json`

## Traceability and documentation updates
- Update `docs/status.md` after each meaningful assistant slice with:
  - implemented behavior,
  - concrete code locations,
  - remaining gaps,
  - assistant-specific diagnostics added,
  - any temporary limitations or suppressions.
- Regenerate traceability with `bun run trace:generate`.
- Validate traceability with `bun run check:traceability`.
- Ensure all assistant tests use exact requirement IDs, especially `R9.*`, `U18.*`, and relevant architecture/security IDs including `A1`, `A2`, `A3`, `D1`, `D5`, `E1`, `E2`, `E4`, `F2`.

## Rollback strategy
- Roll back per phase, not as one giant feature revert.
- Phase 1 rollback:
  - remove launcher/modal/session UI and assistant IPC without touching existing screens.
- Phase 2 rollback:
  - remove create/update/save assistant tools while leaving read-only assistant shell intact.
- Phase 3 rollback:
  - disable runtime assistant tools while preserving assistant navigation/read/edit flows.
- Phase 4 rollback:
  - remove destructive/bulk/settings tools first if trust or policy issues appear.
- Keep tool registration modular so risky tools can be disabled without deleting the whole assistant slice.
- If audit persistence causes schema or performance issues, fall back temporarily to sanitized structured logging only while preserving the user-facing assistant flow.
