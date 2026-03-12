# Assistant Tool Contract Specification

## 1. Purpose
This document defines the concrete contract model for assistant tools.

It translates the assistant PRD, architecture spike, and reconciliation matrix into a planning-ready specification for:
- how tools are defined,
- what metadata they must carry,
- how they are planned and executed,
- how they report success, failure, and visible completion.

## 2. Design goals
- Every assistant capability is explicit and typed.
- Every tool is safe to expose to the planner model.
- Every mutation has visible-state reconciliation metadata.
- Every result can drive confirmation, progress, and final-result UX.
- Every tool remains compatible with existing Renderer -> Preload -> Main IPC -> Application -> Domain/Services boundaries.

## 3. Normative principles
- Tools must represent user-visible app capabilities, not hidden privileged shortcuts.
- Tools must not expose secrets, raw credential refs, or raw filesystem paths.
- Mutating tools must reuse existing handlers/commands where possible.
- Tool definitions must be stable enough to support tests, auditing, and prompt references.
- Tool outputs must be normalized for orchestration and renderer presentation.

## 4. Tool definition model

### 4.1 Required definition fields
Every assistant tool definition should include at least:

```ts
type AssistantToolDefinition<I, O> = {
  name: string;
  version: number;
  category:
    | "read"
    | "navigation"
    | "draft-edit"
    | "commit"
    | "runtime"
    | "settings";
  risk: "read" | "write" | "destructive" | "bulk-destructive";
  requiresConfirmation: boolean;
  confirmationPolicy:
    | "never"
    | "always"
    | "when-inferred-scope"
    | "when-dirty-draft-would-be-replaced"
    | "when-bulk";
  description: string;
  inputSchema: I;
  outputSchema: O;
  reconciliation: AssistantToolReconciliation | null;
};
```

### 4.2 Field intent
- `name`: stable identifier used by planner, orchestration, tests, and audit records.
- `version`: contract version for additive evolution.
- `category`: high-level behavioral class.
- `risk`: base safety classification.
- `requiresConfirmation`: coarse UX control.
- `confirmationPolicy`: precise confirmation rule.
- `description`: short planner-facing explanation of what the tool does.
- `inputSchema`: typed DTO contract.
- `outputSchema`: typed normalized success DTO.
- `reconciliation`: visible-completion contract for mutating tools.

## 5. Planned tool call model

### 5.1 Planned call shape

```ts
type AssistantPlannedToolCall = {
  callId: string;
  toolName: string;
  rationale: string;
  input: Record<string, unknown>;
};
```

### 5.2 Rules
- `callId` must be unique within a run.
- `toolName` must match a registered tool definition.
- `rationale` must be short and auditable.
- `input` must validate against the tool input schema before execution.

## 6. Tool execution result model

### 6.1 Success shape

```ts
type AssistantToolExecutionSuccess = {
  callId: string;
  toolName: string;
  status: "success";
  output: Record<string, unknown>;
  userSummary: string;
  reconciliationState:
    | "not-needed"
    | "completed"
    | "follow-up-refresh-in-progress";
};
```

### 6.2 Failure shape

```ts
type AssistantToolExecutionFailure = {
  callId: string;
  toolName: string;
  status: "failed" | "cancelled" | "skipped";
  error: AssistantToolExecutionError | null;
  userSummary: string;
};
```

### 6.3 Union

```ts
type AssistantToolExecutionResult =
  | AssistantToolExecutionSuccess
  | AssistantToolExecutionFailure;
```

## 7. Error model

### 7.1 Normalized error shape

```ts
type AssistantToolExecutionError = {
  kind:
    | "ValidationError"
    | "NotFoundError"
    | "ConflictError"
    | "InvalidConfigError"
    | "StateViolationError"
    | "ProviderError"
    | "PolicyError"
    | "UnknownToolError"
    | "SchemaError";
  userMessage: string;
  developerMessage: string;
  retryable: boolean;
  details: Record<string, unknown> | null;
};
```

### 7.2 Error rules
- `userMessage` must be safe for renderer display.
- `developerMessage` may be richer but must still exclude secrets and raw paths.
- `details` must remain sanitized.
- `PolicyError` covers assistant-specific denials such as unsafe inferred scope or forbidden execution mode.

## 8. Reconciliation contract

### 8.1 Required for mutating tools
Every tool with `risk !== "read"` should define reconciliation metadata.

```ts
type AssistantToolReconciliation = {
  visibleTarget:
    | "current-draft"
    | "current-list"
    | "detail-view"
    | "runtime-view"
    | "settings-view";
  strategy:
    | "patch-local"
    | "refresh-query"
    | "reload-entity"
    | "navigate-and-load";
  successCondition: string;
};
```

### 8.2 Rules
- A tool is not execution-complete for user reporting until its reconciliation `successCondition` is satisfied.
- If authoritative mutation succeeds but reconciliation has not yet finished, the orchestration layer must not report plain `done`.
- Read-only tools may set `reconciliation` to `null`.

## 9. Confirmation metadata

### 9.1 Policy binding
Confirmation should be derivable from both the tool contract and the concrete planned input.

Recommended runtime decision inputs:
- tool risk,
- confirmation policy,
- affected object count,
- inferred vs explicit scope,
- dirty-draft displacement,
- provider/settings impact.

### 9.2 Confirmation payload shape

```ts
type AssistantConfirmationRequest = {
  summary: string;
  scopeDescription: string;
  affectedCount: number | null;
  examples: ReadonlyArray<string>;
  reversible: boolean;
  draftImpact: "none" | "modify-current-draft" | "replace-current-draft";
};
```

## 10. Category conventions

### 10.1 Read tools
- No side effects.
- No reconciliation metadata required.
- Must be safe to call without confirmation.

Examples:
- `listAgents`
- `listCouncils`
- `getAgent`
- `getCouncilRuntimeState`

### 10.2 Navigation tools
- May change visible route/view state.
- Completion requires destination data readiness.
- Should return destination summary metadata.

Examples:
- `navigateToHomeTab`
- `openAgentEditor`
- `openCouncilView`

### 10.3 Draft-edit tools
- Operate on visible renderer draft state.
- Must not silently persist.
- Must preserve manual validation semantics.

Examples:
- `setAgentDraftFields`
- `setCouncilDraftFields`
- `addCouncilDraftMember`

### 10.4 Commit tools
- Persist or otherwise commit a state transition.
- Must reconcile visible state before completion.
- Often need confirmation when destructive or draft-displacing.

Examples:
- `saveCouncilDraft`
- `archiveAgent`
- `deleteCouncil`
- `createAgent`

### 10.5 Runtime tools
- Must respect runtime state-machine constraints.
- Completion requires visible runtime status alignment.
- Cancellation behavior must be explicit.

Examples:
- `startCouncil`
- `resumeCouncil`
- `cancelCouncilGeneration`

### 10.6 Settings tools
- Must preserve secret/path restrictions.
- Often high trust and confirmation-sensitive.
- Must refresh dependent model/default/invalid-config UI.

Examples:
- `saveProviderConfig`
- `disconnectProvider`
- `setGlobalDefaultModel`

## 11. Initial catalog candidates

### 11.1 Read/navigation
- `navigateToHomeTab`
- `openAgentEditor`
- `openCouncilEditor`
- `openCouncilView`
- `listAgents`
- `listCouncils`
- `getAgent`
- `getCouncil`
- `getCouncilRuntimeState`

### 11.2 Draft-edit
- `setAgentDraftFields`
- `setCouncilDraftFields`
- `addCouncilDraftMember`
- `removeCouncilDraftMember`
- `setHomeQuery`
- `resetHomeQuery`

### 11.3 Commit/runtime/settings
- `saveAgentDraft`
- `saveCouncilDraft`
- `createAgent`
- `createCouncil`
- `updateAgent`
- `updateCouncilConfig`
- `archiveAgent`
- `restoreAgent`
- `deleteAgent`
- `archiveCouncil`
- `restoreCouncil`
- `deleteCouncil`
- `startCouncil`
- `pauseCouncil`
- `resumeCouncil`
- `cancelCouncilGeneration`
- `selectManualSpeaker`
- `sendConductorMessage`
- `exportCouncil`
- `saveProviderConfig`
- `disconnectProvider`
- `refreshModelCatalog`
- `setGlobalDefaultModel`

## 12. Versioning and evolution rules
- New optional output fields may be added in a minor-compatible tool version if orchestration tolerates them.
- Input breaking changes require a version bump.
- Renaming a tool should be treated as a new tool plus deprecation path, not an in-place mutation.
- Audit logs should record both `toolName` and `version`.

## 13. Recommended implementation modules
- `src/shared/assistant/assistant-tool-definitions.ts`
- `src/shared/assistant/assistant-tool-schemas.ts`
- `src/shared/assistant/assistant-tool-results.ts`
- `src/shared/assistant/assistant-confirmation.ts`
- `src/shared/assistant/assistant-reconciliation.ts`

## 14. Open decisions
- Whether input/output schemas should be represented with existing validation utilities or a new assistant-local schema layer.
- Whether bulk tools should be explicit named tools or parameterized variants of base tools.
- Whether draft-edit tools should remain renderer-first only or have mirrored main-aware orchestration wrappers.

## 15. Recommended decision summary
- Make tool contracts first-class typed artifacts.
- Require reconciliation metadata for all mutating tools.
- Normalize result and error shapes for orchestration.
- Keep confirmation policy embedded in tool definitions.
- Start with a curated initial catalog, not an aspirational "everything" surface.

This specification is the contract layer needed before safe implementation can begin.
