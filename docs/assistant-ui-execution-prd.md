# Assistant UI Execution PRD

## 1. Objective
Introduce an in-app assistant that lets the user state an outcome in natural language and have Council execute the same UI actions the user could perform manually.

Examples:
- "Create a council for launch planning with agents A, B, and C in manual mode."
- "Find all councils tagged `research` and archive the inactive ones."
- "Create a new agent called Critic with this prompt and use the global default model."
- "Open the council I was just editing and resume autopilot with a 12 turn limit."

This is a major product shift from manual operation to intent-driven operation. The feature must feel native to the app, remain context-aware, and preserve all existing safety, validation, and security boundaries.

## 2. Problem
Today the product exposes powerful workflows, but users must know where to navigate, which fields to fill, which commands are blocked by state, and which multi-step sequences are required.

That creates friction for:
- repetitive setup work,
- bulk maintenance tasks,
- discovering product capabilities,
- operating complex workflows across Agents, Councils, runtime, and Settings.

The opportunity is to let the user express intent once and have the app translate that intent into concrete actions using the same app capabilities already available through the UI.

## 3. Product Goals
- Reduce time-to-completion for multi-step workflows.
- Make advanced capabilities discoverable through natural language.
- Keep execution grounded in real app actions, not opaque automation.
- Preserve trust through confirmation, visibility, and strict safety boundaries.
- Create a platform for later proactive workflows, macros, and guided operations.

## 4. Non-goals
- No open-ended desktop or filesystem agent.
- No hidden superuser powers beyond what the user can already do in the app.
- No secret exposure into renderer or assistant-visible transcripts.
- No direct DOM-scraping automation as the primary execution model.
- No autonomous background worker continuing after the user leaves the interaction surface.

## 5. Target Users and Jobs To Be Done

### 5.1 Primary users
- Users managing many Agents and Councils.
- Users frequently creating similar setups with small parameter changes.
- Users who understand the outcome they want but not the exact UI path.

### 5.2 Core jobs
- "Set something up for me."
- "Change existing things in bulk."
- "Take me to the right place and do the next steps."
- "Explain what you need when my request is incomplete."
- "Respect the current page and current object I am looking at."

## 6. Product Principles
- Grounded: every action maps to a real app capability.
- Context-aware: use current page, current entity, current filters, and current draft state.
- Safe by default: require explicit confirmation for destructive or high-impact actions.
- Transparent: show plan, progress, result, and failure details in user language.
- Boundary-preserving: secrets stay in main/keychain, validations stay in existing slices, and renderer remains unprivileged.
- Incremental: ship in phases, starting with clear, bounded capabilities.

## 7. User Experience Concept
- A persistent assistant launcher sits in the top-left of the app shell.
- Activating it opens a modal with a conversation thread, input box, and send action.
- The assistant receives structured app context for the current view.
- The assistant decides whether to ask a follow-up question, present a confirmation, or execute immediately.
- Execution happens through typed tools that correspond to user-visible capabilities such as navigation, form updates, save actions, filtering, exports, archive/restore, start/resume, and deletion.
- The modal stays visible while work is in progress and reports step-by-step status.
- For high-risk actions, the assistant shows a confirmation summary before running them.

## 8. Capability Model

### 8.1 Context the assistant should know
- Active top-level screen or full-screen detail view.
- Active entity identifiers for the current Agent or Council when applicable.
- View-local state such as search query, filters, sort, archived mode, and selected tab.
- Visible form draft values and dirty-state for the current editor, excluding secrets.
- Runtime state for the active Council, including mode, paused/running/archived, invalid-config state, and visible members.

### 8.2 Tool categories
- Navigation tools.
- Query tools for list/search/filter/sort.
- Form tools for setting field values, adding/removing members, and editing tags.
- Commit tools for save, cancel, discard, confirm, archive, restore, delete, export.
- Runtime tools for start, pause, resume, cancel generation, choose speaker, and send conductor messages.
- Settings tools for test/save/disconnect provider and refresh model catalogs.

### 8.3 Execution model constraints
- Tools must call typed preload/main APIs, not mutate renderer state directly.
- Tool execution must preserve the same validation and state-machine behavior as manual usage.
- The assistant may chain tools, but each step should remain inspectable and attributable.

## 9. Functional Requirements
The normative functional requirements live in `docs/requirements.md` under `R9.*`.

Key themes:
- launcher and modal availability,
- default-model execution,
- structured context injection,
- natural-language intent interpretation,
- typed tool execution over existing app capabilities,
- follow-up questions for missing information,
- confirmation gates for destructive and bulk actions,
- progress and result reporting,
- cancellation behavior,
- audit-safe execution records,
- parity with existing validation/security rules.

## 10. UX Requirements
The normative UX requirements live in `docs/ux-requirements.md` under `U18.*`.

Key themes:
- launcher placement and visibility,
- responsive modal layout,
- example prompts,
- conversational follow-up behavior,
- explicit execution progress,
- destructive confirmation cards,
- result summaries with deep links into affected entities,
- keyboard and focus behavior,
- close/cancel safeguards.

## 11. Non-functional Requirements

### Safety and security
- **NFR-ASSIST-1** Secrets, credential material, and raw filesystem paths must never be exposed to renderer-visible assistant context, messages, or result payloads.
- **NFR-ASSIST-2** Assistant actions must be authorization-equivalent to manual UI actions and must not bypass current validation or archived/runtime restrictions.
- **NFR-ASSIST-3** Destructive and bulk-destructive actions must be reversible where the underlying product supports reversal, or explicitly confirmed where irreversible.

### Reliability and correctness
- **NFR-ASSIST-4** Tool execution must be deterministic enough that repeated identical commands in identical app state produce equivalent plans or explain why not.
- **NFR-ASSIST-5** Partial failures must be surfaced with step-level status so the user can understand what completed and what did not.
- **NFR-ASSIST-6** Assistant plans and tool results should be logged in a user-safe local audit trail suitable for debugging and support.

### Performance
- **NFR-ASSIST-7** The assistant should feel responsive for ordinary commands: launch should feel immediate, first model response should start within an acceptable interactive latency budget, and local tool steps should stream progress without unexplained stalls.

### Accessibility and usability
- **NFR-ASSIST-8** The launcher, modal, execution states, confirmations, and results must be fully keyboard accessible and screen-reader legible.
- **NFR-ASSIST-9** Assistant copy must be concise, action-oriented, and explicit about scope for destructive operations.

### Maintainability and extensibility
- **NFR-ASSIST-10** Tool definitions, context shaping, and orchestration logic should be modular so new app capabilities can be exposed without rewriting the assistant core.

## 12. Proposed Rollout Phases

### Phase 0: Research and contracts
- Define context contract.
- Define typed tool catalog.
- Define confirmation categories and safety policy.
- Define assistant audit/logging approach.

### Phase 1: Read and navigate
- Open views.
- Search/filter/sort.
- Summarize current page context.
- Ask clarifying questions.

### Phase 2: Single-entity create/edit flows
- Create/edit Agents.
- Create/edit Councils.
- Save/cancel/discard with validation feedback.

### Phase 3: Runtime actions
- Open Council View.
- Start/pause/resume/cancel.
- Manual speaker selection.
- Conductor messages.

### Phase 4: Bulk and higher-risk operations
- Batch archive/restore/delete.
- Multi-entity edits.
- Higher-trust confirmations and richer audit views.

## 13. Research Tracks
- How much structured page context is enough without overloading the model?
- Which tool granularity is best: low-level field actions, high-level domain actions, or both?
- Should the assistant operate over canonical domain commands only, or also over a thin UI-navigation tool layer?
- What is the best format for confirmation summaries and execution plans?
- How should the assistant behave when the user has unsaved draft changes?
- What should be persisted in the audit history, and where should that history be shown?
- How should cancellation behave for multi-step flows that already completed some steps?

## 14. Risks
- Users may over-trust the assistant for destructive bulk requests.
- Poor tool granularity could make the assistant either too brittle or too unconstrained.
- Excess context could harm latency and correctness.
- Direct renderer automation would create fragile behavior and boundary violations.
- Without strong progress UX, the feature could feel opaque and untrustworthy.

## 15. Success Signals
- Users can complete common multi-step setup tasks faster than manual operation.
- Clarification rate is reasonable and concentrated on truly missing inputs.
- Destructive-action confirmation prevents unintended bulk changes.
- Support/debugging can reconstruct assistant behavior from local audit data.
- Follow-up implementation plans can scope delivery into small, testable slices.

## 16. Related architecture documents
- `docs/assistant-ui-execution-architecture-spike.md`
- `docs/assistant-ui-reconciliation-matrix.md`
