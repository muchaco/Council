# Assistant UI Execution Architecture Spike

## 1. Purpose
This spike proposes how to build the assistant-driven UI execution feature without breaking the current Electron, IPC, security, and FCIS boundaries.

It focuses on four questions:
- What context should the assistant receive?
- What tools should it be allowed to call?
- Where should orchestration live?
- How should confirmation, cancellation, and auditability work?

## 2. Design stance
The assistant should be an orchestrator over existing app capabilities, not a second app hidden inside the app.

That means:
- the renderer still owns presentation,
- preload still exposes a narrow typed API,
- main IPC still validates,
- application slices still own mutations and queries,
- domain logic still decides validity,
- services still do IO only,
- secrets still remain in keychain/main only.

The assistant is therefore best modeled as a main-process feature that:
1. receives a safe, structured context envelope from the renderer,
2. asks the default model to interpret intent and select typed tools,
3. executes those tools through existing handlers/contracts,
4. reports stepwise outcomes back to the renderer modal.

## 3. Recommended execution flow

### 3.1 High-level flow
1. Renderer opens the assistant modal.
2. Renderer sends the user request plus a sanitized `AssistantContextEnvelope` through preload.
3. Main assistant orchestrator builds a planning prompt from:
   - user request,
   - current app context,
   - tool catalog,
   - safety policy.
4. The default model returns one of:
   - clarification request,
   - confirmation-needed plan,
   - executable tool plan.
5. Main validates the response shape.
6. If clarification is needed, renderer shows the follow-up question.
7. If confirmation is required, renderer shows a confirmation card and waits for explicit user approval.
8. If execution proceeds, main executes tools sequentially or in validated batches.
9. Each tool result is normalized into a user-safe step result.
10. Renderer shows progress and final outcome.
11. Main persists an audit-safe execution record.

### 3.2 Why main-process orchestration is the right center
- Keeps model access in the same trusted layer as `AiService`.
- Avoids leaking tool internals and validation gaps into the renderer.
- Lets the assistant reuse existing slice handlers rather than fragile UI automation.
- Keeps secrets and raw paths out of assistant-visible context.

## 4. Recommended context model

### 4.1 Principle
Context must be structured, minimal, and task-oriented. Do not send arbitrary component state or DOM snapshots.

### 4.2 Proposed envelope

```ts
type AssistantContextEnvelope = {
  shell: {
    currentScreen:
      | "home-councils"
      | "home-agents"
      | "home-settings"
      | "agent-editor"
      | "council-editor"
      | "council-view";
    canNavigateBack: boolean;
  };
  selection: {
    activeAgentId: string | null;
    activeCouncilId: string | null;
  };
  homeState:
    | {
        kind: "councils" | "agents";
        searchText: string;
        tags: ReadonlyArray<string>;
        archivedFilter: "active" | "archived" | "all";
        sort: string;
      }
    | null;
  editorState:
    | {
        kind: "agent" | "council";
        isDirty: boolean;
        draftSummary: Record<string, unknown>;
      }
    | null;
  runtimeState:
    | {
        councilId: string;
        mode: "Autopilot" | "Manual";
        status: "NotStarted" | "Running" | "Paused" | "Completed";
        isArchived: boolean;
        hasInvalidConfig: boolean;
        memberSummaries: ReadonlyArray<{
          agentId: string;
          name: string;
          hasMessages: boolean;
        }>;
      }
    | null;
};
```

### 4.3 Context rules
- Include identifiers, visible summaries, and state flags.
- Include current draft values only when they are already visible to the user.
- Exclude provider secrets, credential refs, raw filesystem paths, hidden implementation details, and raw prompt payloads.
- Exclude large transcript bodies by default; provide targeted read/query tools instead.
- Exclude arbitrary DOM text and CSS-derived state.

### 4.4 Why not send the full page
- Too noisy for reliable planning.
- Risks accidental leakage of implementation details.
- Encourages brittle prompt dependence on renderer markup.
- Makes the model solve parsing problems that typed context should solve directly.

## 5. Recommended tool architecture

### 5.1 Tooling principle
Prefer domain-capable tools over click-simulation tools.

The assistant should use the highest-level safe primitive available.

Good:
- `createCouncil(draft)`
- `updateAgent(agentId, patch)`
- `archiveCouncils(filter)`
- `resumeCouncil(councilId, options)`

Avoid as primary primitives:
- `clickButton(selector)`
- `setInputValue(domId, value)`
- `openPopover(name)`

### 5.2 Recommended hybrid tool taxonomy

#### A. Navigation and read tools
Use for moving the user and gathering exact current data.

- `navigateToHomeTab`
- `openAgentEditor`
- `openCouncilEditor`
- `openCouncilView`
- `listAgents`
- `listCouncils`
- `getAgent`
- `getCouncil`
- `getCouncilRuntimeState`

#### B. Draft-editing tools
Use where the feature should visibly operate through existing editor state.

- `setAgentDraftFields`
- `setCouncilDraftFields`
- `addCouncilDraftMember`
- `removeCouncilDraftMember`
- `setHomeQuery`
- `resetHomeQuery`

#### C. Commit/action tools
Use for save/archive/delete/export and other deliberate state transitions.

- `saveAgentDraft`
- `saveCouncilDraft`
- `archiveAgent`
- `restoreAgent`
- `deleteAgent`
- `archiveCouncil`
- `restoreCouncil`
- `deleteCouncil`
- `exportCouncil`

#### D. Runtime tools
- `startCouncil`
- `pauseCouncil`
- `resumeCouncil`
- `cancelCouncilGeneration`
- `selectManualSpeaker`
- `sendConductorMessage`

#### E. Settings tools
- `testProviderConnection`
- `saveProviderConfig`
- `disconnectProvider`
- `refreshModelCatalog`
- `setGlobalDefaultModel`

### 5.3 Tool contract shape
Each tool should have:
- stable tool name,
- typed input DTO,
- typed success DTO,
- normalized error DTO,
- risk classification,
- confirmation policy.

Recommended shape:

```ts
type AssistantToolDefinition<I, O> = {
  name: string;
  risk: "read" | "write" | "destructive" | "bulk-destructive";
  requiresConfirmation: boolean;
  inputSchema: I;
  outputSchema: O;
};
```

## 6. Where tools should execute

### 6.1 Boundary recommendation
- Renderer: open modal, render progress, send user replies, render confirmations/results.
- Preload: narrow assistant API only.
- Main IPC: validate assistant request and response events.
- Main application layer: assistant orchestrator plus existing feature handlers.
- Domain/shared pure layer: context shaping helpers, tool metadata, plan validation, risk classification, response parsing.
- Services: AI call, persistence, audit persistence, clock/UUID.

### 6.2 Critical rule
Mutation tools should call the same underlying command handlers manual UI flows already use.

Do not create assistant-only mutation logic unless the capability is inherently assistant-specific, such as plan parsing or audit record persistence.

## 7. Planning model recommendation

### 7.1 Two-stage interaction
Use two conceptual stages:
- `plan`: understand intent, decide whether to clarify/confirm/execute.
- `execute`: run approved tools and report step results.

### 7.2 Response modes
Recommended model response union:

```ts
type AssistantPlanResult =
  | { kind: "clarify"; question: string }
  | { kind: "confirm"; summary: string; steps: ReadonlyArray<string> }
  | { kind: "execute"; steps: ReadonlyArray<AssistantPlannedToolCall> };
```

This keeps the orchestration understandable and easier to validate.

## 8. Confirmation policy

### 8.1 Require explicit confirmation for
- delete operations,
- bulk archive/restore/delete,
- actions affecting multiple entities when the exact scope is inferred,
- replacing user drafts when unsaved changes would be discarded,
- provider settings mutations,
- any request where confidence is low but risk is meaningful.

### 8.2 Confirmation payload should include
- plain-language intent summary,
- affected object counts when known,
- named examples when useful,
- irreversible vs reversible note,
- what will happen to unsaved local draft state if relevant.

## 9. Unsaved changes policy
Assistant behavior should treat visible draft state as first-class.

Recommended rules:
- If the current editor is dirty and the assistant wants to modify that same draft, it may continue in-place and say so.
- If the current editor is dirty and the assistant wants to navigate away or replace the draft, it must confirm first.
- If the assistant can satisfy the request by using the existing draft rather than discarding it, prefer that path.

## 10. Cancellation and partial failure semantics

### 10.1 Cancellation
- Cancel stops future planned tool calls.
- Completed calls remain completed.
- The final result should clearly state where execution stopped.

### 10.2 Partial failure
- Each step returns `success`, `failed`, `skipped`, or `cancelled`.
- The final message summarizes both completed and incomplete work.
- The assistant may suggest the next safe manual or assistant follow-up.

## 11. Audit model recommendation

### 11.1 What to persist
- request ID,
- timestamp range,
- sanitized user request,
- context summary,
- confirmation decision,
- executed tool calls with sanitized inputs,
- step outcomes,
- final status.

### 11.2 What not to persist
- provider secrets,
- raw credential refs,
- raw filesystem paths,
- raw prompt payloads unless a future security review explicitly approves a redacted format.

## 12. Recommended new modules

### 12.1 Shared pure modules
- `src/shared/assistant/assistant-context.ts`
- `src/shared/assistant/assistant-tool-definitions.ts`
- `src/shared/assistant/assistant-plan-schema.ts`
- `src/shared/assistant/assistant-risk-policy.ts`
- `src/shared/assistant/assistant-audit.ts`

### 12.2 Main-process modules
- `src/main/features/assistant/slice.ts`
- `src/main/features/assistant/ipc-handlers.ts`
- `src/main/services/assistant/assistant-audit-service.ts`

### 12.3 Renderer modules
- `src/renderer/components/assistant/AssistantLauncher.tsx`
- `src/renderer/components/assistant/AssistantModal.tsx`
- `src/renderer/components/assistant/assistant-ui-state.ts`

## 13. Smallest useful implementation slices

### Slice 1: Read-only assistant
- Open modal.
- Provide context banner.
- Answer "where am I" and "what can I do here".
- Read/list/navigate only.

### Slice 2: Single-entity draft assist
- Fill current Agent or Council draft.
- Summarize validation blockers.
- Save on explicit instruction.

### Slice 3: Runtime assist
- Open council.
- Start/pause/resume.
- Select manual speaker.
- Send conductor message.

### Slice 4: Bulk operations
- Archive/restore/delete by filters.
- Require stronger confirmation and audit UI.

## 14. Open decisions still requiring research
- Should planning and execution use one model call or two different structured prompts?
- Should bulk tools be generic (`bulkUpdateCouncils`) or specific (`archiveCouncilsByTag`)?
- How much transcript/runtime history should be available via context vs on-demand tools?
- Where should users inspect past assistant runs, if anywhere in the product UI?
- Should assistant results deep-link by navigation only, or also highlight affected controls/entities?

## 15. Recommended decision summary
- Put assistant orchestration in main.
- Keep renderer context structured and minimal.
- Prefer typed domain-level tools, with a small navigation/view layer.
- Reuse existing slice handlers for all mutations.
- Use a clarify/confirm/execute response model.
- Require explicit confirmation for destructive, bulk, and draft-discarding actions.
- Persist a sanitized local audit trail.

## 16. Related follow-up documents
- `docs/assistant-ui-execution-prd.md`
- `docs/assistant-ui-reconciliation-matrix.md`
- `docs/assistant-tool-contract-specification.md`

This architecture keeps the assistant powerful without weakening the app's current trust boundaries.
