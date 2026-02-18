## 1. Architectural approach

### 1.1 Functional Core, Imperative Shell (FCIS)

* **Functional core (pure)**: domain types, invariants, validation, state transitions, effect descriptions.
* **Imperative shell (IO)**: SQLite, keychain, provider networking (Vercel AI SDK), filesystem export, Electron dialogs, clock, UUID, logging.
* **Renderer UI package direction**: use `shadcn/ui` as the standard component package for the project UI.
* **Orchestrators (application layer)**: command handlers that (a) load current state, (b) call pure domain logic, (c) interpret domain effects through services, (d) persist, (e) return view models.

### 1.2 Vertical slices

Implement as “features” end to end, each slice containing:

* Renderer UI state + view
* Preload API call(s)
* Main IPC handler(s) with validation
* Application command/query handler
* Domain decider function(s)
* Feature specific DB queries
* Tests (domain unit + handler tests + DB integration when needed)

Avoid horizontal “service layers” that become shared dumping grounds. Shared code should be limited to:

* domain primitives (IDs, errors, invariants)
* IPC DTO schemas
* small cross cutting utilities (logging, config)

### 1.3 Dependency injection via Reader or Kleisli

Use a single environment record threaded through handlers.

Recommended type (TypeScript/fp-ts style):

* `App<R, E, A> = ReaderTaskEither<R, E, A>`
* Domain stays pure and returns `Either<DomainError, ...>` (or neverthrow `Result`), while application layer uses `ReaderTaskEither` to compose IO and dependency usage.

Environment example:

* `Env = { db; keychain; ai; modelCatalog; clock; uuid; logger }`

This provides “DI without constructor injection” and keeps dependencies explicit and testable.

---

## 2. Process architecture (Electron)

### 2.1 Responsibilities

* **Renderer (React/Vite + shadcn/ui)**: UI only, no secrets, no provider networking.
* **Preload**: exposes a narrow typed API at `window.api.*`.
* **Main**: persistence, migrations, keychain, provider calls, model catalog fetching, runtime orchestration, export, dialogs.

### 2.2 IPC boundary rules

* Renderer calls only preload methods.
* Main IPC handlers validate:

  * types, required fields, length limits
  * tag constraints, prompt length constraints
  * pagination limits and sort keys
* IPC never returns secrets or raw filesystem paths.

---

## 3. Bounded contexts and slices

### 3.1 Contexts

1. **Agents**

* Create/edit/delete, uniqueness, invalid model config detection, tag filtering, list paging and sorting.

2. **Councils**

* Create/edit/delete, archive/restore, member rules, tag filtering, list paging and sorting.

3. **Council Runtime**

* Start, pause, resume, cancel generation, manual speak selection, autopilot loop, briefing updates, goal reached.

4. **Providers and Settings**

* Provider CRUD, connection test gate, model catalog fetch and refresh, global default model, invalid config warnings.

5. **Export**

* Markdown transcript export.

### 3.2 Example vertical slices (representative)

* `agents/createAgent`
* `agents/updateAgent`
* `agents/deleteAgent`
* `agents/listAgents`
* `councils/createCouncil`
* `councils/updateCouncilConfig`
* `councils/archiveCouncil`
* `councils/restoreCouncil`
* `councils/deleteCouncil`
* `councils/listCouncils`
* `runtime/startCouncil`
* `runtime/pauseCouncil`
* `runtime/resumeCouncil`
* `runtime/cancelGeneration`
* `runtime/manualSendMember`
* `runtime/manualSendConductor`
* `runtime/autopilotRunLoop`
* `providers/testAndSaveProvider`
* `providers/refreshModelCatalog`
* `settings/setGlobalDefaultModel`
* `export/exportCouncilMarkdown`

Each slice owns its own main handlers, DB queries, domain operations, and UI state.

---

## 4. Domain model (pure)

### 4.1 Core entities (immutable records)

* **Agent**

  * `id: AgentId (UUID)`
  * `name: string (unique)`
  * `systemPrompt: string`
  * `verbosity?: string`
  * `temperature?: number`
  * `tags: Tag[0..3]`
  * `modelRef?: ModelRef | null` (nullable resolves to global default at runtime)
  * `createdAtUtc`, `updatedAtUtc`

* **Council**

  * `id: CouncilId`
  * `title: string`
  * `topic: string`
  * `mode: "Autopilot" | "Manual"` (immutable after creation)
  * `goal?: string`
  * `members: Member[]` where `Member = { memberId; agentId; color }`
  * `conductorModelRef?: ModelRef | null`
  * `tags: Tag[0..3]`
  * `archivedAtUtc?: timestamp`
  * `createdAtUtc`, `updatedAtUtc`

* **Message**

  * `id: MessageId`
  * `councilId`
  * `sender: { kind: "Member"; agentId; memberId } | { kind: "Conductor" }`
  * `senderNameSnapshot: string`
  * `timestampUtc`
  * `content: string`
  * `turnIndex: number` (monotonic per council)

* **Briefing**

  * `councilId`
  * `text: string`
  * `goalReached: boolean`
  * `updatedAtUtc`

* **RuntimeState** (persisted minimal)

  * `status: "NotStarted" | "Running" | "Paused" | "Completed"`
  * `pausedReason?: "User" | "Error" | "Navigation"`
  * `lastError?: DomainError`
  * `turnCount: number`
  * `lastSpeakerMemberId?: MemberId`
  * `autopilotMaxTurns?: number | null` (optional, set at start or resume)

### 4.2 Value objects and invariants

* `Tag`: min 1, max 20, max 3 per object, filtering by case-insensitive exact match.
* Name uniqueness (Agent name).
* Council edit rules:

  * mode immutable after create
  * archived councils read-only
  * member removal forbidden if that agent has spoken at least once
  * member add allowed only when not started OR paused OR manual mode
  * cannot archive if autopilot running and not paused

### 4.3 Domain error union (stable `kind`)

* `ValidationError`
* `NotFoundError`
* `ConflictError`
* `InvalidConfigError`
* `StateViolationError`
* `ProviderError`

Each includes:

* `kind`
* `devMessage`
* `userMessage`
* optional `details` (structured, safe to display)

### 4.4 Deciders and effects (key to FCIS)

For runtime features, domain returns **(newState, effects[])**.

Effect examples:

* `GenerateMemberMessage { councilId, memberId, resolvedModel, promptParts, temperature }`
* `GenerateConductorOpening { councilId, resolvedModel, promptParts }`
* `UpdateBriefingAndGoal { councilId, resolvedModel, promptParts, expectsSpeakerSelection: boolean }`
* `PersistMessage { message }` (often handled by orchestrator directly, but can be modeled)
* `SelectNextSpeakerAlgorithmic { eligibleMemberIds }` (pure)

This keeps state transitions testable and lets the application layer interpret effects with services.

---

## 5. Persistence (SQLite in main)

### 5.1 Tables (suggested)

* `agents`

  * `id (pk uuid)`, `name (unique)`, `system_prompt`, `verbosity`, `temperature`, `model_ref`, `tags_json`, `created_at`, `updated_at`
* `councils`

  * `id`, `title`, `topic`, `mode`, `goal`, `conductor_model_ref`, `tags_json`, `archived_at`, `created_at`, `updated_at`
* `council_members`

  * `id (memberId)`, `council_id (fk)`, `agent_id (fk)`, `color`, `created_at`
* `messages`

  * `id`, `council_id (fk)`, `turn_index`, `sender_kind`, `sender_agent_id`, `sender_member_id`, `sender_name_snapshot`, `timestamp_utc`, `content`
  * unique `(council_id, turn_index)`
* `briefings`

  * `council_id (pk fk)`, `text`, `goal_reached`, `updated_at`
* `runtime_state`

  * `council_id (pk fk)`, `status`, `paused_reason`, `turn_count`, `last_speaker_member_id`, `autopilot_max_turns`, `last_error_json`
* `providers`

  * `id`, `type`, `name`, `endpoint_url`, `credential_ref` (keytar lookup key), `created_at`, `updated_at`
* `settings`

  * singleton row: `global_default_model_ref`, `context_last_n`, other config

### 5.2 Constraints and integrity

* Enable `PRAGMA foreign_keys = ON`.
* Prevent deleting an agent referenced by any council member row.
* Prevent removing a member who has messages:

  * enforce in domain + also a DB check query for safety.
* On council delete: cascade delete `messages`, `members`, `briefings`, `runtime_state`.

### 5.3 Migrations

* schema version table, ordered transactional migrations, startup blocks on migration failure.

---

## 6. AI layer (main process)

### 6.1 AiService boundary

* `AiService.generateText(req, abortSignal) -> ResultAsync<{ text: string }, ProviderError>`
* Internal mapping from domain prompt parts to Vercel AI SDK message format.
* No streaming. Only final text returned.

### 6.2 Provider adapters

* Provider types: Gemini, Ollama, OpenRouter.
* Adapter responsibilities:

  * list models
  * execute generateText
  * normalize errors into `ProviderError` with user safe messaging

### 6.3 Secrets handling

* API keys stored only in keytar.
* SQLite stores a credential reference key, not the secret.

### 6.4 Prompt composition (pure)

Create a pure `PromptBuilder` module:

* Inputs:

  * Council topic, optional goal
  * Member agent system prompt and optional verbosity
  * Briefing text
  * last N messages
  * mode specific templates (conductor opening, briefing update, speaker select)
* Output:

  * internal canonical message list (system/user/assistant roles) that AiService later maps

Context limit policy:

* include `briefing + last N messages`
* N from settings (`context_last_n`)

---

## 7. Model catalog and invalid config behavior

### 7.1 Catalog caching per view

Implement a **CatalogSnapshot** in main keyed by:

* `webContentsId`
* `viewKind` (settings, agentsList, agentEdit, councilsList, councilEdit, councilView)
* `snapshotId`
* `modelsByProvider`

Renderer requests:

* `getModelCatalog(viewKind) -> { snapshotId, catalog }`
  Refresh:
* `refreshModelCatalog(viewKind) -> new snapshot`

All availability checks in that view use the cached snapshot until refresh.

### 7.2 Resolution rules (pure)

* `resolveModel(modelRefOrNull, globalDefaultModelRef) -> Either<InvalidConfigError, ResolvedModelRef>`
* Invalid when:

  * explicit model not in snapshot
  * null model resolves to missing global default

### 7.3 Runtime failure refresh

If a generation fails due to provider/model issues:

* main refreshes that view’s snapshot
* returns error plus updated snapshot so UI can update “Invalid config” badges

---

## 8. Council runtime orchestration (no background execution)

### 8.1 Main concepts

* **Council runtime lease**: when Council View opens, renderer acquires a lease token.

  * `runtime/openCouncilView(councilId) -> { leaseId }`
  * `runtime/closeCouncilView(leaseId)` triggers pause + cancel if running
* Main tracks active leases by `webContentsId`. If the window is destroyed, main auto pauses and cancels.

### 8.2 In-flight generation registry

Main keeps:

* `inFlightByCouncilId: Map<CouncilId, AbortController>`
* `mutexByCouncilId` to prevent overlapping turns

Cancel semantics:

* `cancelGeneration(councilId)` aborts controller, discards output, does not persist partial content.

### 8.3 Manual mode flow (slice based)

Command: `manualSendMember(councilId, memberId)`

1. Load council + runtime_state + briefing + last N messages
2. Validate state and config (archived, status, model resolution)
3. Create effect `GenerateMemberMessage`
4. Interpret effect via AiService with abort signal
5. Persist message
6. Run Conductor briefing update call (single call per requirements)
7. Persist briefing and goalReached
8. Update runtime_state (turnCount, lastSpeaker)
9. Return updated view model

Command: `manualSendConductor(councilId, text)` persists a conductor message and then runs briefing update.

### 8.4 Autopilot mode flow

Start flow: `startCouncilAutopilot(councilId, maxTurns?)`

1. Validate not archived, status NotStarted or Paused, config valid, lease active
2. Conductor opening generation effect returns opening text and first speaker selection (per requirement)
3. Persist conductor opening message
4. Generate selected member message
5. Persist member message
6. Conductor briefing update call includes:

   * briefing text
   * goalReached boolean
   * next speaker selection (must not repeat consecutive speaker)
7. Persist briefing
8. Loop while:

   * lease active
   * status Running
   * not paused
   * not goalReached
   * maxTurns not reached

The loop must yield control between iterations so pause/cancel can interrupt:

* Each AI call is abortable
* Before each iteration check runtime_state in DB (or cached with mutex)

Consecutive speaker rule:

* Domain computes eligible members excluding `lastSpeakerMemberId`.
* If only one remains, select it algorithmically.
* Otherwise, conductor selection must respect the rule; domain verifies returned selection and fails fast to `StateViolationError` if violated (then pause with error).

### 8.5 Error handling

* On provider error in autopilot: set runtime_state to Paused with pausedReason Error, preserve last stable messages and briefing.
* Resume retries from the last stable state.

### 8.6 Navigation away confirmation

Renderer implements the confirmation UX, then calls:

* `runtime/pauseCouncil(councilId, reason: "Navigation")` and `runtime/cancelGeneration(councilId)` before navigating.

---

## 9. Renderer architecture (per slice)

### 9.1 UI state

Each feature has:

* `useQuery` hooks for list and detail queries (via IPC)
* local draft state for forms with explicit Save
* unsaved changes guard that triggers confirmation on navigation

### 9.2 List pagination

* fixed page size constant
* “Load more” uses `cursor` or `offset` from DB query
* filter or sort reset to first page

### 9.3 Invalid config display

* Agent edit blocks save when invalid model config in the current catalog snapshot
* Agent list shows badge when invalid, but allows adding to council
* Council list and Council View block start/resume when resolved conductor model invalid

---

## 10. IPC API shape (typed, minimal)

Group methods by domain:

* `agents.*`: create, update, delete, list, get
* `councils.*`: create, update config, archive, restore, delete, list, get
* `runtime.*`: openView, closeView, start, pause, resume, cancel, manualSendMember, manualSendConductor
* `providers.*`: testConnection, saveProvider, listProviders, deleteProvider, refreshModels
* `settings.*`: getSettings, setGlobalDefaultModel, setContextLastN
* `export.*`: exportCouncilMarkdown

All IPC payloads are DTOs validated in main. Domain types stay in main; renderer sees DTOs only.

---

## 11. Testing strategy (aligns with FCIS and Reader DI)

### 11.1 Domain tests (fast, pure)

* Validation: tags, required fields, uniqueness checks (as domain rules)
* Council state transitions and edit rules
* Autopilot selection invariants
* Model resolution and invalid config behaviors
* Context window slicing (briefing + last N messages)

### 11.2 Application handler tests (Reader injected)

* Provide fake `Env` with in-memory DB, fake AiService, fake model catalog snapshot
* Assert:

  * correct effects executed in order
  * cancellation discards output
  * errors pause autopilot and preserve stable state

### 11.3 DB integration tests

* migrations apply cleanly
* foreign keys enforced
* cascade rules correct
* pagination queries stable and indexed

### 11.4 IPC contract tests

* validate input constraints (lengths, required fields)
* ensure secrets never cross boundary
* ensure export does not leak file paths

---

## 12. Recommended repository layout

One repo, feature mirrored across renderer and main, with shared domain primitives.

```
src/
  shared/
    domain/
      ids.ts
      errors.ts
      tag.ts
      modelRef.ts
    ipc/
      dto.ts
      validators.ts
  main/
    appEnv.ts
    services/
      db/
      keychain/
      ai/
      modelCatalog/
    features/
      agents/
      councils/
      runtime/
      providers/
      settings/
      export/
    ipc/
      handlers/
  preload/
    index.ts (window.api)
  renderer/
    features/
      agents/
      councils/
      councilView/
      providers/
      settings/
      export/
    appShell/
```

Each `features/<name>` in main contains:

* `domain.ts` (pure deciders specific to the feature, or imports from shared domain)
* `handlers.ts` (ReaderTaskEither command/query handlers)
* `db.ts` (feature specific SQL)
* `ipc.ts` (mapping DTO <-> domain, registration)

---

## 13. Key implementation decisions that remove ambiguity

* Persist **runtime_state** so pause/resume survives app restarts. On app startup, any `Running` council is forced to `Paused` (because no background execution).
* Keep **model catalog snapshots** in main keyed to view leases, so “cached per view” is enforced consistently.
* Use **effect returning domain deciders** for runtime to keep orchestration logic testable without IO.
* Enforce **single in-flight generation per council** via mutex and abort registry.
