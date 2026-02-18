# Council — Functional Requirements (Comprehensive)

Confidence scale: **1.00** = fully specified and testable, **0.85** = minor detail still open, **0.70** = notable ambiguity remaining.

---

## 0. Ubiquitous Language

**Agent**: reusable participant definition (formerly Persona).  
**Council**: saved conversation configuration plus transcript (formerly Session).  
**Council View**: runtime screen for a Council (formerly Council Room).  
**Member**: an Agent added to a Council as a participant.  
**Conductor**: built-in fixed-prompt agent that manages Briefing and (in Autopilot) selects the next speaker.  
**Briefing**: running TL;DR summary plus goal status (formerly Blackboard).  
**Topic**: the Council’s base prompt.  
**Goal**: end goal / end condition evaluated by the Conductor.  
**Autopilot Mode**: automatic conducted flow.  
**Manual Mode**: user-driven flow.  
**Model Catalog**: list of models fetched from configured providers and cached per view.  
**Invalid config**: concise warning state shown when required model resolution is unavailable.

---

## 1. Agents

### 1.1 Create and Edit Agents
- **R1.1** User can create a new Agent. **[0.95]**
- **R1.2** User can edit an existing Agent. **[0.95]**
- **R1.3** Agent has attributes:  
  - Name* (unique)  
  - System Prompt*  
  - Verbosity (optional string)  
  - Temperature (optional number)  
  - Tags (0..3)  
  - Model (nullable)  
  **[0.95]**
- **R1.4** System validates required fields (*) are non-empty. **[0.95]**
- **R1.5** Agent Name must be unique across all Agents. **[0.95]**

### 1.2 Verbosity Handling
- **R1.6** Verbosity is a free-form string injected into prompts; system does not validate format. **[0.95]**
- **R1.7** If Verbosity is empty, it is omitted from prompts entirely. **[0.95]**

### 1.3 Agent Model Selection and Validity
- **R1.8** Agent Model defaults to null. Null resolves to the Global Default Model at runtime. **[0.95]**
- **R1.9** If the Agent’s assigned model is unavailable (per current view’s Model Catalog), show concise warning "Invalid config" in the edit form and block saving until fixed. User may cancel edit. **[0.95]**
- **R1.10** Agent list view shows "Invalid config" badge when:  
  - Agent model is unavailable, or  
  - Agent model is null and Global Default Model is unavailable.  
  **[0.95]**
- **R1.11** An Agent with invalid model config may still be added as a Member to a Council; Council usage will be blocked later until fixed. **[0.95]**

### 1.4 Delete Agents
- **R1.12** User can delete an Agent. **[0.95]**
- **R1.13** Deletion requires confirmation. **[0.95]**
- **R1.14** Agent cannot be deleted if referenced by any Council. In that case, show warning and do not open confirmation dialog. **[0.95]**

### 1.5 Tags on Agents
- **R1.15** User can add up to 3 tags to an Agent; can remove tags. **[0.95]**

### 1.6 Search and Sort (Agents)
- **R1.16** User can view list of all Agents. **[0.95]**
- **R1.17** User can filter Agents by tags and free-text search. **[0.95]**
- **R1.18** Free-text search is case-insensitive substring match across: Name, System Prompt. **[0.95]**
- **R1.19** User can sort Agents by creation date and modification date, asc/desc. **[0.95]**

---

## 2. Councils

### 2.1 Council Lifecycle
- **R2.1** User can create a new Council. **[0.95]**
- **R2.2** Council fields:  
  - Title*  
  - Topic*  
  - Members (Agents)*  
  - Mode* (Autopilot / Manual)  
  - Goal (optional)  
  - Member Colors (per Member)  
  - Conductor Model (nullable)  
  - Tags (0..3)  
  **[0.95]**
- **R2.3** System validates required fields (*) are non-empty. **[0.95]**
- **R2.4** Mode cannot be changed after Council creation. **[0.95]**
- **R2.5** Council is not started automatically after creation; user must start it explicitly. **[0.95]**
- **R2.6** User can permanently delete a Council; deletion requires confirmation. **[0.95]**

### 2.2 Archive and Read-Only Semantics
- **R2.7** User can archive a Council. **[0.95]**
- **R2.8** Archived Councils remain visible in the Councils list by default, with a clear Archived indicator. **[0.95]**
- **R2.9** User can filter Councils by archived status: Active only, Archived only, All. **[0.95]**
- **R2.10** Archived Councils are fully read-only:  
  - Cannot start or resume  
  - Cannot send messages  
  - Cannot select next speaker  
  - Cannot modify any Council config (including Member colors, tags, topic, goal, title, conductor model, members)  
  **[0.95]**
- **R2.11** User cannot archive a Council that is in Autopilot Mode and currently running (not paused). **[0.95]**
- **R2.12** User can restore an archived Council, making it active and editable again. **[0.95]**

### 2.3 Members and Editing Rules
- **R2.13** During creation, user can add/remove Members. **[0.95]**
- **R2.14** Member Colors are set per Member within a Council. **[0.95]**
- **R2.15** Color picker uses a predefined palette; duplicate colors are allowed. **[0.95]**
- **R2.16** After creation, Council configuration is editable in Council View, subject to state rules. **[0.95]**
- **R2.17** Members can be added if:  
  - Council is not started, OR  
  - Council is paused, OR  
  - Council is in Manual Mode.  
  Added Members may speak on the next turn when allowed by the current state. **[0.95]**
- **R2.18** A Member cannot be removed if that Agent has already sent at least one message in that Council. **[0.95]**
- **R2.19** Conductor Model can be edited after creation (unless archived). **[0.95]**

### 2.4 Tags on Councils
- **R2.20** User can add tags to a Council and remove tags; max 3. **[0.95]**

### 2.5 Search and Sort (Councils)
- **R2.21** User can view list of all Councils. **[0.95]**
- **R2.22** Filter Councils by: tags, free-text search (Title, Topic), archived status. **[0.95]**
- **R2.23** Free-text search is case-insensitive substring match across Title and Topic. **[0.95]**
- **R2.24** Sort Councils by creation date and modification date, asc/desc. **[0.95]**

---

## 3. Council View (Runtime)

### 3.1 What Council View Displays
- **R3.1** User can open Council View for a Council. **[0.95]**
- **R3.2** Council View displays:  
  - Members list  
  - Mode (Autopilot / Manual)  
  - Archived status  
  - Paused status (if applicable)  
  - Tags (editable if not archived)  
  - Council configuration (editable if allowed by state)  
  - Briefing (TL;DR and goal status)  
  - Turn count  
  **[0.95]**
- **R3.3** User can view full message history. **[0.95]**
- **R3.4** Each message shows: sender name, timestamp, avatar (initials), and sender color in UI. **[0.95]**
- **R3.5** Messages cannot be edited or deleted. **[0.95]**

### 3.2 Start, Pause, Resume (No Background Execution)
- **R3.6** Council does not auto-start after creation. **[0.95]**
- **R3.7** User can start a Council. **[0.95]**
- **R3.8** In Autopilot Mode, user can pause and resume. **[0.95]**
- **R3.9** No background execution: Autopilot turn progression only occurs while Council View is open and Council is not paused. **[0.95]**
- **R3.10** Pausing cancels any in-flight generation and discards partial output entirely. **[0.95]**
- **R3.11** Cancel generation discards output entirely and does not append any partial message. **[0.95]**
- **R3.12** If user navigates away from Council View while a generation is in progress or Autopilot is running (not paused), system shows confirmation: leaving will pause the Council and cancel generation (discarded). Confirm performs pause+cancel then navigates; cancel keeps user in Council View. **[0.95]**

### 3.3 Briefing and Goal Evaluation (Conductor)
- **R3.13** After each new message (both modes), the Conductor runs an LLM call that produces:  
  - Briefing: meaningful TL;DR of the conversation so far (free-form, no schema)  
  - Goal Reached: boolean decision based on history, Topic, and Goal  
  **[0.95]**
- **R3.14** Goal evaluation is performed only as part of the Briefing update call (single Conductor call for both). **[0.95]**
- **R3.15** When the Conductor determines Goal Reached, it still produces one final Briefing update for that last round. **[0.95]**
- **R3.16** Conductor is an agent with fixed built-in system prompt (not configurable by user). **[0.95]**
- **R3.17** Conductor neutrality requirement is enforced via prompt only (no additional bias checks). **[0.95]**

### 3.4 Autopilot Mode Behavior
- **R3.18** Autopilot start flow: Conductor generates an opening message using a dedicated Conductor prompt and selects first responding Member. **[0.95]**
- **R3.19** Autopilot loop (between turns):  
  1) If Goal Reached, stop.  
  2) Otherwise Conductor selects next speaker (in the same Conductor call that updates Briefing and evaluates Goal).  
  3) Selected Member generates the next message.  
  **[0.95]**
- **R3.20** Speaker selection rule: Conductor must not select the same Member twice consecutively. **[0.95]**
- **R3.21** If only one Member is eligible due to the "no consecutive speaker" rule, the system selects that Member algorithmically. **[0.95]**
- **R3.22** User cannot override next speaker in Autopilot Mode. **[0.95]**
- **R3.23** Autopilot optional limit: On Start or Resume, system asks whether a max turns limit applies. If set and reached, Autopilot stops. **[0.95]**
- **R3.24** If an error occurs during Autopilot generation, Council transitions to Paused state and preserves state. Resume retries. **[0.95]**

### 3.5 Manual Mode Behavior
- **R3.25** In Manual Mode, user selects the next responding Member. **[0.95]**
- **R3.26** User may send messages as the Conductor at any time. **[0.95]**
- **R3.27** In Manual Mode, Conductor only performs Briefing+Goal evaluation; it does not perform speaker selection. **[0.95]**
- **R3.28** If an error occurs in Manual Mode, state is preserved; user may retry by selecting a Member again or selecting a different Member. **[0.95]**

### 3.6 Context Limits
- **R3.29** When history becomes too long, prompts do not include full history. Instead: include current Briefing plus the last N messages (fixed message count). **[0.85]**
- **R3.30** The Conductor Briefing update uses prior Briefing plus last N messages when full history is too long. **[0.95]**
- **R3.31** N is a constant configurable by implementation but not specified yet. **[0.85]**

### 3.7 Export
- **R3.32** User can export a Council transcript as Markdown text. **[0.95]**
- **R3.33** Export format includes: Title, Topic, Goal, then messages. **[0.95]**
- **R3.34** Each exported message includes all UI-visible fields except color (includes sender name and timestamp). **[0.95]**

---

## 4. Providers, Models, and Settings

### 4.1 Saving Behavior
- **R4.1** All configuration changes require explicit manual save. **[0.95]**
- **R4.2** No settings are auto-saved. **[0.95]**
- **R4.3** Navigating away with unsaved changes prompts confirmation that changes will be lost. **[0.95]**

### 4.2 Provider Management
- **R4.4** User can configure multiple LLM providers. **[0.95]**
- **R4.5** First supported providers: Gemini, Ollama (local), OpenRouter. **[0.95]**
- **R4.6** User can enter and save provider credentials: API key and or endpoint URL. **[0.95]**
- **R4.7** API key is not required for local Ollama. **[0.95]**
- **R4.8** User must test provider connection before saving; successful test enables Save. **[0.90]**
- **R4.9** After saving a provider, system fetches available models and updates the model list without reload. **[0.90]**
- **R4.10** User can refresh model list manually when at least one provider is configured. **[0.95]**
- **R4.11** Any view that contains a model picker/selector provides a "Refresh models" action next to that control. List views that only show model labels or invalid-config status do not include this action. **[0.95]**
- **R4.12** Model selection UI groups models by provider sections. **[0.95]**

### 4.3 Model Catalog Caching and Availability
- **R4.13** Model Catalog is cached per page view and loaded when that view is opened. Views include: Settings, Agents list, Agent edit, Councils list, Council create/edit, Council View. **[0.95]**
- **R4.14** Availability checks use the current view’s cached Model Catalog snapshot (until refreshed). **[0.95]**
- **R4.15** Unavailable model causes "Invalid config" warnings and blocks usage where applicable, including when null resolves to an unavailable Global Default Model. **[0.95]**
- **R4.16** If a runtime call fails due to provider/model issues, system refreshes the Model Catalog for the active view and updates invalid config warnings. **[0.90]**

### 4.4 Global Default Model
- **R4.17** User can set a Global Default Model from the available Model Catalog. **[0.95]**
- **R4.18** Any null model reference (Agent Model or Conductor Model) resolves to the Global Default Model. **[0.95]**
- **R4.19** If Global Default Model is unavailable in the current Model Catalog, display "Invalid config" in Settings and block starting/resuming Councils that depend on it. **[0.95]**

### 4.5 Conductor Model Rules
- **R4.20** Conductor Model is configured per Council; it can be set explicitly or left null to use Global Default Model. **[0.95]**
- **R4.21** If the resolved Conductor Model is unavailable, show "Invalid config" in Council list and Council View and block starting/resuming. **[0.95]**

---

## 5. Tags (Global Rules)

- **R5.1** Tags are free-text strings stored on Agents and Councils (no tag entities). **[0.95]**
- **R5.2** No global tag registry; system does not suggest existing tags. **[0.95]**
- **R5.3** Tags can be added/removed during create/edit; Council tags are also editable in Council View (unless archived). **[0.95]**
- **R5.4** Tags cannot be edited from list views (Agents list, Councils list). **[0.95]**
- **R5.5** List views display all tags on items. **[0.95]**
- **R5.6** Tag constraints:  
  - Min length: 1  
  - Max length: 20  
  - Max per object: 3  
  **[0.95]**
- **R5.7** Tag filtering uses exact match with case-insensitivity. **[0.95]**
- **R5.8** Tag filter UI accepts typed text; no options dropdown is shown. **[0.95]**

---

## 6. List Views (Agents and Councils)

- **R6.1** List views use a constant page size. **[0.95]**
- **R6.2** Items are loaded in pages with a "Load more" action when more items exist. **[0.95]**
- **R6.3** "Load more" is hidden when there are no more items to fetch. **[0.95]**
- **R6.4** Applying filter/search resets rendered pages to 1. **[0.95]**
- **R6.5** Tags are shown but not editable in list views. **[0.95]**
- **R6.6** Councils list includes archived indicator and supports archived-status filtering. **[0.95]**

---

## 7. Persistence and Security

- **R7.1** All app data is stored locally (Agents, Councils, messages, settings, provider configs). **[0.95]**
- **R7.2** Provider API keys are encrypted at rest. **[0.85]** (encryption mechanism/OS keychain not specified)

---

## 8. Generation UX and Error Handling

- **R8.1** No streaming output. UI shows a "thinking" indicator and renders response when complete. **[0.95]**
- **R8.2** User can cancel in-flight generation; cancelled output is discarded entirely. **[0.95]**
- **R8.3** On generation/provider error:  
  - Show an error message  
  - Preserve last stable state  
  - If in Autopilot Mode, set Council to Paused  
  - Resume retries in Autopilot  
  - In Manual, user may select a Member again or a different Member  
  **[0.95]**
