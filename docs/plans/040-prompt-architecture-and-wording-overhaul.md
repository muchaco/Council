# Plan 040 - Prompt Architecture and Wording Overhaul

## Objective

Improve Council runtime prompts so they better match the product's intended usage: reusable Agents should actually contribute their saved instruction sets at runtime, member and conductor prompts should be composed through a cleaner architecture, and prompt wording should be more precise, lower-noise, and more robust across providers.

This plan is intentionally written as a handoff artifact for a fresh agent session. It includes the current-state findings, target architecture, wording rules, implementation steps, required tests, and validation gates.

## Current-state findings

### What is good in the current repo

- `council3` already has the stronger runtime guardrails for Conductor output contracts:
  - strict JSON-only prompt contract in `src/shared/council-runtime-conductor.ts`
  - strict parse-time validation in `parseConductorDecision(...)` and `parseAutopilotOpeningDecision(...)`
- `council3` already has the stronger context-window discipline in `src/shared/council-runtime-context-window.ts`:
  - bounded `last N` selection
  - omitted-message count surfaced into prompts
  - matches `F1` / `F2`
- `council3` already keeps prompt persistence boundaries correct: only outputs are persisted, not raw prompts/provider payloads, matching `F2`.

### What is currently weak in the current repo

- Member runtime generation currently uses a placeholder system message (`"Council runtime generation skeleton."`) and puts the real prompt into a user message in `src/main/features/councils/slice.ts`.
- Member runtime generation currently does not use the selected Agent's saved `systemPrompt` or `verbosity`, even though those fields are core Agent attributes and verbosity is explicitly required to be injected into prompts:
  - `docs/requirements.md`: `R1.3`, `R1.6`, `R1.7`
  - `docs/architecture-plan.md`: prompt composition inputs include member agent system prompt and optional verbosity
- Prompt construction is currently spread across runtime orchestration code in `src/main/features/councils/slice.ts` instead of being centered in a pure prompt builder module.
- Member prompt wording is functional but generic. It does not fully express the intended role of a reusable Agent inside a Council discussion.
- Conductor prompt input currently exposes only eligible agent IDs, not a richer `{ id, name, role }` view, which reduces decision quality.
- `generateTextForCouncil(...)` currently resolves the model from `council.conductorModelRefOrNull ?? globalDefaultModelRef` for all generations, which strongly suggests member turns are not using member-specific model resolution. That should be verified and corrected if confirmed.

### What is better in `../Council`

- Persona/member prompting is architecturally cleaner:
  - stable persona instructions are separated into a real system prompt
  - history is modeled separately
  - the current turn/task is modeled separately
- Persona prompting includes stronger participation context:
  - current speaker identity
  - other participants with roles
  - shared state / blackboard-style context
  - explicit instructions to address named participants and move the conversation forward
- The older implementation also shows useful wording patterns for verbosity handling and role framing, but it includes product concepts that do not map 1:1 to current `council3` requirements.

### What should not be copied directly from `../Council`

- Do not import product-level features that are not in scope for `council3` requirements:
  - hidden agenda
  - hush/muted personas
  - off-topic intervention behavior
  - `WAIT_FOR_USER` selector behavior
  - richer blackboard object beyond current `Briefing` semantics
- Do not copy decorative prompt formatting that adds tokens without improving behavior:
  - emoji-heavy sections
  - large visual separators
  - overly verbose instruction prose
- Do not replace `council3`'s strict Conductor JSON parsing with permissive regex-first extraction. If extra tolerance is needed, keep it minimal and explicit.

## Scope

- Refactor runtime prompt composition into pure prompt-builder helpers aligned with `docs/architecture-plan.md`.
- Upgrade member prompt composition so runtime uses:
  - Agent system prompt
  - optional Agent verbosity
  - Council topic and optional goal
  - latest briefing
  - bounded recent transcript
  - speaker identity and fellow member identities
- Upgrade Conductor prompt composition so runtime uses:
  - a stable built-in system prompt
  - dynamic council/user content separated from the stable system instructions
  - richer eligible speaker metadata (`id`, `name`, `role`)
  - current strict JSON response shape and strict validation
- Review model resolution architecture and correct role-specific model selection if member turns are incorrectly using the Conductor/global model path.
- Improve wording across prompts for clarity, brevity, and behavioral specificity.
- Add/update unit, integration, traceability, and validation artifacts.
- Update `docs/status.md` and generated traceability after implementation.

## Non-goals

- Adding new user-facing settings for prompt style.
- Adding hidden agendas, hush, intervention messaging, or other product features not currently required.
- Persisting prompts, prompt fragments, or provider payloads.
- Changing renderer UX except where required for diagnostics or exposing existing runtime behavior more clearly.
- Reworking provider adapters beyond what is needed to support cleaner canonical prompt messages.

## Requirement and architecture alignment

### Primary requirement IDs

- `R1.3` Agent has `System Prompt` and optional `Verbosity`
- `R1.6` Verbosity is injected into prompts
- `R1.7` Empty verbosity is omitted
- `R1.8`, `R4.18` null model references resolve to global default
- `R3.13`, `R3.14`, `R3.15` Conductor produces briefing and goal evaluation as one call
- `R3.16`, `R3.17` Conductor has fixed built-in system prompt and neutrality is prompt-enforced
- `R3.18`, `R3.19`, `R3.20`, `R3.21`, `R3.22`, `R3.24` Autopilot opening, speaker planning, no consecutive speaker, algorithmic single-speaker shortcut, no user override, pause on error
- `F1`, `F2` bounded context and outputs-only persistence
- `E1`, `E2`, `E4` pure domain/prompt logic, stable error modeling, services stay IO-only

### Architecture constraints that must remain true

- Prompt composition remains pure and testable.
- Runtime orchestration remains in main process slices/services, not renderer.
- `AiService` stays provider-facing IO only; prompt decision logic must not move into adapters.
- Prompt storage remains transient only.
- Conductor output validation remains strict and domain-owned.

## Target architecture

### 1. Introduce a pure prompt-builder module

Create a pure shared module for Council runtime prompt composition. Recommended location:

- `src/shared/council-runtime-prompts.ts`

Recommended responsibilities:

- `buildMemberTurnPromptInput(...)` helper types
- `buildMemberTurnPromptBundle(...)`
- `buildConductorDecisionPromptBundle(...)`
- `buildAutopilotOpeningPromptBundle(...)`
- small shared helpers for transcript formatting, verbosity normalization, role labeling, and omitted-count language

Recommended output shape:

```ts
type PromptMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type PromptBundle = {
  messages: ReadonlyArray<PromptMessage>;
};
```

Preferred practical split for member turns:

- `system`: stable role/behavior rules derived from Agent system prompt + optional verbosity + stable Council participation rules
- `user`: dynamic Council state for this turn (topic, goal, briefing, fellow members, recent transcript, turn task)

Preferred practical split for Conductor turns:

- `system`: stable built-in Conductor rules and JSON contract
- `user`: dynamic council state (mode, topic, goal, prior briefing, recent transcript, eligible members)

This aligns with `docs/architecture-plan.md:282`-`docs/architecture-plan.md:300`, which explicitly calls for a pure `PromptBuilder` that outputs canonical messages.

### 2. Keep prompt building out of orchestration code

After the refactor, `src/main/features/councils/slice.ts` should:

- gather runtime inputs
- resolve the correct model for the actor being invoked
- call pure prompt builders
- pass canonical messages to `AiService`
- parse/validate outputs where required

It should not hand-build large prompt strings inline except possibly as very small wrapper glue.

### 3. Separate member and conductor model resolution

Verify and fix model resolution behavior.

Desired behavior:

- member generation resolves from the selected member Agent model, falling back to global default when Agent model is null
- conductor generation resolves from Council Conductor model, falling back to global default when Conductor model is null

Recommended implementation:

- replace the current generic `generateTextForCouncil(...)` model selection path with an explicit role-aware resolver, for example:
  - `resolveMemberGenerationModel(...)`
  - `resolveConductorGenerationModel(...)`

This is both a prompt-quality improvement and an architectural correctness fix.

### 4. Keep strict conductor parsing, with only minimal tolerance if needed

Retain the current strong approach in `src/shared/council-runtime-conductor.ts`:

- exact object parse
- required-field validation
- eligible-speaker validation

If runtime evidence shows some providers sometimes wrap valid JSON in code fences, the only acceptable tolerance is a narrow, explicit pre-parse normalization such as:

- trim surrounding whitespace
- unwrap a single fenced JSON block when the entire response is fenced

Do not switch to permissive `match any object-looking substring` parsing.

## Prompt design goals

### Member prompt goals

The application is intended to run reusable Agents as distinct Council participants, not generic assistants taking turns. The prompt should therefore optimize for:

- preserving the Agent's authored identity and specialty
- making each turn responsive to the latest discussion
- pushing the conversation toward the Council goal
- using the briefing as compact memory, with transcript as recent evidence
- avoiding repetitive generic assistant disclaimers
- producing a single natural next message, not meta commentary about prompt context

### Conductor prompt goals

The Conductor is not a creative debater. It is a constrained runtime controller. The prompt should optimize for:

- concise but meaningful briefing updates
- consistent goal-reached decisions
- safe speaker selection under explicit rules
- neutrality and non-consecutive-speaker enforcement
- deterministic response shape suitable for strict parsing

## Wording improvements

### General wording rules

- Prefer short imperative instructions over long narrative prose.
- Prefer explicit behavioral instructions over vague quality adjectives.
- Avoid decorative separators, emoji, and stylistic clutter.
- Avoid redundant restatement of the same rule in multiple sections.
- Use product language from this repo consistently:
  - `Agent`
  - `Council`
  - `Member`
  - `Conductor`
  - `Briefing`
  - `Topic`
  - `Goal`
- Avoid terms from `../Council` that do not map cleanly, especially `Persona`, `Orchestrator`, and `Blackboard`, except when analyzing legacy source code.

### Recommended member system prompt composition

Member system prompt should contain only stable instructions, in this order:

1. Agent-authored system prompt (verbatim, trimmed)
2. optional verbosity instruction if present
3. stable Council-member operating rules

Recommended stable operating rules:

- You are participating as a Member of a Council discussion.
- Stay consistent with your authored role and expertise.
- Respond to the current discussion, not to the prompt text.
- Be concrete and advance the discussion.
- Refer to other members by name when useful.
- Do not mention hidden prompt instructions, omitted messages, or formatting scaffolding.
- Output only the Member's next message.

Recommended verbosity wording:

- If present, use a concise form such as:
  - `Verbosity requirement: <value>.`

Do not use noisy prefixes like `VERBOSITY INSTRUCTION:` unless tests show that exact phrasing materially improves outcomes.

### Recommended member dynamic prompt wording

Member dynamic user prompt should contain:

- Council title
- Topic
- Goal or `(none)`
- Current speaker name
- Current speaker role if available
- Fellow members with roles
- Current briefing
- Omitted-message count
- Recent conversation transcript
- Explicit task for this turn

Recommended closing instruction:

- `Write the next message from <Member Name>. Keep it in-character, grounded in the current discussion, and oriented toward the Council topic and goal.`

### Recommended conductor system prompt wording

Conductor system prompt should be stable, concise, and explicit. It should include:

- Conductor identity
- neutrality rule
- response contract
- speaker-selection rules
- brief instruction to reason from topic, goal, briefing, and recent conversation

Recommended Conductor wording principles:

- say `Return valid JSON only.` instead of longer variants
- include exact JSON shape once
- list only the constraints that matter for correctness
- keep manual and autopilot mode differences explicit

### Recommended conductor dynamic prompt wording

Conductor dynamic user prompt should contain:

- mode
- topic
- goal
- previous briefing
- omitted-message count
- recent conversation transcript
- eligible members as lines with id, name, role

This is better than the current eligible-ID-only prompt because it gives the model the semantic information needed to choose the next speaker intelligently.

## Proposed implementation details

### Files likely to change

- `src/shared/council-runtime-prompts.ts` (new)
- `src/shared/council-runtime-conductor.ts`
- `src/shared/council-runtime-context-window.ts` (possibly no functional change)
- `src/main/features/councils/slice.ts`
- `src/main/services/interfaces.ts` (if canonical message shape needs to be clarified)
- `src/main/services/ai/provider-ai-service.ts` (only if message mapping needs minor adaptation)
- `tests/unit/council-runtime-conductor.spec.ts`
- new unit tests for the prompt builder module
- `tests/integration/councils-handlers.integration.spec.ts`
- `docs/status.md`
- generated traceability outputs after implementation

### Suggested prompt-builder API

This is a recommendation, not a required exact signature.

```ts
type RuntimeMemberPromptInput = {
  councilTitle: string;
  topic: string;
  goal: string | null;
  memberName: string;
  memberRole: string | null;
  memberSystemPrompt: string;
  memberVerbosity: string | null;
  otherMembers: ReadonlyArray<{ id: string; name: string; role: string | null }>;
  briefing: string | null;
  recentMessages: ReadonlyArray<RuntimeConversationMessage>;
  omittedMessageCount: number;
};

type RuntimeConductorPromptInput = {
  mode: "manual" | "autopilot";
  topic: string;
  goal: string | null;
  previousBriefing: string | null;
  recentMessages: ReadonlyArray<RuntimeConversationMessage>;
  omittedMessageCount: number;
  eligibleMembers: ReadonlyArray<{ id: string; name: string; role: string | null }>;
};
```

### Suggested orchestration changes

1. In member generation paths, load the selected Agent record once and pass:
   - name
   - system prompt
   - verbosity
   - model ref
2. Build bounded transcript context via existing `selectLastNContextMessages(...)`.
3. Build canonical prompt messages through pure helper(s).
4. Resolve the member model using the selected Agent model ref or global default.
5. Send canonical messages directly to `AiService`.
6. Keep Conductor parsing/validation separate from prompt building.

### Suggested conductor-input enrichment

Today the Conductor gets eligible IDs. Improve this to pass:

- member id
- member name
- member role

Do not change the output schema yet. Keep:

- `briefing`
- `goalReached`
- `nextSpeakerAgentId`

for regular Conductor decision, and keep the current opening schema for Autopilot start.

## Step-by-step implementation plan

1. Confirm current runtime model-resolution behavior for member vs conductor generation in `src/main/features/councils/slice.ts`; document whether member turns are incorrectly using conductor/global resolution.
2. Add a new pure prompt-builder module in `src/shared/` that returns canonical role-based messages for:
   - member turn generation
   - conductor briefing/speaker decision
   - autopilot opening
3. Move member prompt wording out of `slice.ts` and into the new builder.
4. Change member prompt composition so it includes:
   - agent system prompt
   - optional verbosity
   - speaker role and fellow-member roles
   - briefing + last `N` messages
5. Refactor Conductor prompt composition so stable rules are in a system message and dynamic runtime data is in a user message.
6. Enrich Conductor eligible-speaker input with names and roles while preserving the current JSON response contract and parser behavior.
7. Introduce explicit role-aware model resolution helpers and route member/conductor generations through the correct resolver.
8. Remove the placeholder system message path (`"Council runtime generation skeleton."`) once canonical messages are in use.
9. Add/extend unit tests for prompt composition, wording, and conductor parsing invariants.
10. Add/extend integration tests to verify actual runtime requests now include agent prompt data and correct model resolution.
11. Update `docs/status.md`, regenerate traceability, and run the required validation suite.

## Risks and mitigations

- Risk: richer prompts increase token usage and reduce effective context.
  - Mitigation: keep wording compact, avoid decorative formatting, and continue using briefing + bounded transcript.
- Risk: changing message-role split could alter provider behavior unexpectedly.
  - Mitigation: preserve the same factual inputs initially, add tests that inspect actual outbound prompt content, and validate with both unit/integration coverage plus Electron diagnostics.
- Risk: member model-resolution fix could surface previously hidden invalid-config states.
  - Mitigation: treat this as a correctness improvement, add explicit tests, and ensure user-facing errors remain `InvalidConfigError` or other stable kinds as appropriate.
- Risk: making Conductor prompts richer could reduce JSON compliance.
  - Mitigation: keep system instructions short, keep output schema unchanged, and retain strict parser validation.
- Risk: over-copying `../Council` wording introduces product drift.
  - Mitigation: borrow architecture and wording patterns, not foreign product concepts.

## Coverage matrix

| Requirement IDs | Planned tests | Validation intent |
| --- | --- | --- |
| `R1.3`, `R1.6`, `R1.7` | `tests/unit/council-runtime-prompts.spec.ts`, `tests/integration/councils-handlers.integration.spec.ts` | Verify member runtime prompts include Agent system prompt and optional verbosity, and omit verbosity when empty |
| `F1`, `F2` | `tests/unit/council-runtime-context-window.spec.ts`, `tests/unit/council-runtime-prompts.spec.ts`, `tests/integration/councils-handlers.integration.spec.ts` | Preserve bounded `briefing + last N messages` behavior and no prompt persistence changes |
| `R3.13`, `R3.14`, `R3.15`, `R3.16`, `R3.17` | `tests/unit/council-runtime-conductor.spec.ts`, `tests/unit/council-runtime-prompts.spec.ts`, `tests/integration/councils-handlers.integration.spec.ts` | Verify Conductor retains fixed built-in prompt behavior, strict JSON contract, neutrality wording, and briefing/goal semantics |
| `R3.18`, `R3.19`, `R3.20`, `R3.21`, `R3.22` | `tests/unit/council-runtime-conductor.spec.ts`, `tests/integration/councils-handlers.integration.spec.ts` | Verify opening and next-speaker flows still satisfy speaker-selection rules after prompt refactor |
| `R1.8`, `R4.18`, `R4.15` | `tests/unit/model-resolution.spec.ts`, `tests/integration/councils-handlers.integration.spec.ts` | Verify role-specific runtime model resolution and invalid-config handling remain correct |
| `E1`, `E2`, `E4` | `tests/unit/council-runtime-prompts.spec.ts`, `tests/unit/council-runtime-conductor.spec.ts`, `tests/integration/councils-handlers.integration.spec.ts` | Keep prompt decisions pure, errors stable, and services free of domain logic |

## Concrete test additions and assertions

### New unit test file

- `tests/unit/council-runtime-prompts.spec.ts`

Recommended test cases:

- `builds member system message from agent prompt and verbosity`
- `omits verbosity instruction when verbosity is null or blank`
- `includes fellow member names and roles in member dynamic prompt`
- `uses briefing plus last N messages and reports omitted count`
- `builds conductor prompt bundle with stable system instructions and dynamic eligible member metadata`
- `formats eligible members with id name and role`
- `keeps prompt wording free of blackboard/persona legacy terms`

### Integration test updates

Extend `tests/integration/councils-handlers.integration.spec.ts` so test doubles capture full outbound AI requests, then assert:

- member generation receives the selected Agent's `systemPrompt`
- member generation receives verbosity when present
- member generation resolves the selected Agent model before falling back to global default
- conductor generation resolves the Council Conductor model before falling back to global default
- context window slicing still excludes old messages beyond `N`
- Conductor prompts include richer eligible-member metadata without changing output contract expectations

### Existing unit test updates

Update `tests/unit/council-runtime-conductor.spec.ts` to assert:

- system instructions and dynamic user content are split as intended, if API changes expose this directly
- conductor decision prompt includes eligible names/roles in addition to ids
- parser still rejects malformed or semantically invalid selections

## Diagnostics and runtime verification

Even if renderer UI does not materially change, runtime behavior does. Add at least one runtime-focused diagnostic scenario after implementation.

Recommended scenario work:

- add `scripts/diagnostics/scenarios/council-runtime-prompt-smoke.json` (or similar)
- seed a Council with at least two Agents and a Conductor-capable model
- exercise:
  - manual member turn generation
  - Conductor message injection
  - one Autopilot step
- verify the app remains stable and produces messages/briefing updates

If adding a new scenario is too expensive for the first implementation pass, still run:

- `bun run diag:electron`

But the preferred end state is a dedicated reusable scenario for runtime prompt regressions.

## Validation commands

- `bun run lint`
- `bun run typecheck`
- `bun run test:unit`
- `bun run test:integration`
- `bun run build`
- `bun run diag:electron`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/council-runtime-prompt-smoke.json` (if added)
- `bun run trace:generate`
- `bun run check:traceability`

## Documentation updates required during implementation

After code changes are complete, the implementing agent must also update:

- `docs/status.md`
  - describe prompt-builder introduction
  - describe runtime use of Agent system prompt/verbosity
  - describe any model-resolution correction
  - note remaining gaps, if any
- generated traceability artifacts
- `AGENTS.md` only if a new non-obvious prompt/diagnostic pitfall is discovered

## Recommended implementation order for a fresh agent session

1. Read this plan fully.
2. Re-read:
   - `docs/requirements.md`
   - `docs/architecture-plan.md`
   - `docs/architecture-decision.md`
   - `src/main/features/councils/slice.ts`
   - `src/shared/council-runtime-conductor.ts`
   - `src/shared/council-runtime-context-window.ts`
3. Confirm current runtime request shape and current model-resolution behavior with tests before refactoring.
4. Introduce pure prompt-builder module and unit tests first.
5. Refactor member flow next.
6. Refactor conductor/opening flow next.
7. Fix or confirm role-specific model resolution.
8. Update integration tests.
9. Run validation commands.
10. Update `docs/status.md` and traceability.

## Rollback strategy

- Revert the new prompt-builder module and restore prior inline prompt construction in `src/main/features/councils/slice.ts`.
- Preserve any added tests that expose real requirement gaps; only revert assertions that are coupled to the abandoned design.
- If model-resolution fixes reveal regressions that cannot be safely completed in the same change, keep the prompt-builder refactor but gate the model-resolution correction into a follow-up plan only if requirements analysis proves the current behavior is intended. Otherwise treat it as part of this work.

## Implementation notes for the next agent

- Do not copy `../Council` product concepts verbatim. Borrow architectural structure and prompt-writing discipline only.
- Keep prompt wording concise; better prompts here will usually come from cleaner separation and clearer constraints, not from longer text.
- Treat Agent-authored system prompts as first-class runtime inputs; this is the biggest current product gap.
- Treat member-model resolution as a likely correctness issue to investigate early.
- Keep conductor response parsing strict.
- Keep context bounded.
- Do not persist prompts.
