# Implementation Status and Traceability

## 1) Document Contract

This file always reflects the current implementation status.

Update rules:
- Update this file after every meaningful code or architecture change.
- Keep requirement IDs exact and stable.
- Record concrete implementation pointers (real repository paths only).
- Keep bidirectional requirement <-> test traceability current.
- If a refactor intentionally has no test delta, document why and how behavior equivalence was verified.

Current repository state snapshot:
- Repository now includes a foundation implementation scaffold (`package.json`, `src/`, `scripts/`, `tests/`) plus architecture and validation automation.
- Settings/Providers/Model Catalog slice is implemented end-to-end and now extended by Agents and Councils foundations in main/IPC, with Councils persistence + lifecycle command/query support now available.
- CI workflow files are not implemented yet.

Default status template used below unless overridden:
- What is done: foundation-level scaffolding and guardrails are in place.
- How it is done: Electron main/preload/renderer shell + shared domain/contracts + Bun scripts and tests.
- Known gaps/follow-ups: Council runtime view/orchestration is not implemented yet; Councils list/editor UX is now wired but still needs deeper interaction/accessibility polish.
- Tests covering it: baseline unit/integration suites exist for domain contracts and guardrail scripts.

## 2) Implementation Status by Requirement

### 2.1 Functional requirements (`R*`)

| Requirement IDs | Status | What is done | How it is done | Known gaps / follow-ups | Tests covering it |
| --- | --- | --- | --- | --- | --- |
| R1.1, R1.2, R1.3, R1.4, R1.5, R1.6, R1.7, R1.8, R1.9, R1.10, R1.11, R1.12, R1.13, R1.14, R1.15, R1.16, R1.17, R1.18, R1.19 | In progress | Agents list/create/edit/delete flow is implemented with required-field checks, unique-name checks, model invalid-config save blocking, tag validation, and list filter/search/sort behavior. | Main slice + handlers in `src/main/features/agents/slice.ts` and `src/main/features/agents/ipc-handlers.ts`; IPC wiring in `src/main/ipc/register-ipc.ts`; preload bridge in `src/preload/index.ts`; renderer list + full-screen editor in `src/renderer/App.tsx`. | Delete block on council references (`R1.14`) is pending until Councils persistence exists; council-member compatibility (`R1.11`) remains future council slice work. | `tests/integration/agents-handlers.integration.spec.ts`, `tests/integration/agents-ipc.contract.integration.spec.ts`, `tests/unit/ipc-validator-shapes.spec.ts` |
| R2.1, R2.2, R2.3, R2.4, R2.6, R2.7, R2.8, R2.9, R2.20, R2.21, R2.22, R2.23, R2.24 | In progress | Councils foundation now supports create/edit/delete/archive/restore/list with required-field validation, mode immutability, tag checks, archived filtering, search/sort/pagination, persisted member references, and renderer list/editor flows. | Main slice in `src/main/features/councils/slice.ts`; IPC handlers in `src/main/features/councils/ipc-handlers.ts`; IPC wiring in `src/main/ipc/register-ipc.ts`; renderer list/editor in `src/renderer/App.tsx`; DTO/contracts in `src/shared/ipc/dto.ts` and `src/shared/ipc/validators.ts`; persistence in `src/main/services/db/sqlite-persistence-service.ts` + `src/main/services/db/migrations/0002_councils_foundation.sql`. | Runtime-dependent council rules (`R2.5`, `R2.10`-`R2.19`) remain for upcoming Council View/runtime slices. | `tests/integration/councils-handlers.integration.spec.ts`, `tests/integration/councils-ipc.contract.integration.spec.ts`, `tests/integration/sqlite-persistence.integration.spec.ts`, `scripts/diagnostics/scenarios/councils-ui.json` |
| R3.1, R3.2, R3.3, R3.4, R3.5, R3.6, R3.7, R3.8, R3.9, R3.10, R3.11, R3.12, R3.13, R3.14, R3.15, R3.16, R3.17, R3.18, R3.19, R3.20, R3.21, R3.22, R3.23, R3.24, R3.25, R3.26, R3.27, R3.28, R3.29, R3.30, R3.31, R3.32, R3.33, R3.34 | Not started | No runtime orchestration or council view logic implemented. | No runtime state machine, IPC runtime handlers, or UI runtime views exist yet. | Implement start/pause/resume/cancel/manual/autopilot/briefing/context/export semantics. | None |
| R4.1, R4.2, R4.3, R4.4, R4.5, R4.6, R4.7, R4.8, R4.9, R4.10, R4.11, R4.12, R4.13, R4.14, R4.15, R4.16, R4.17, R4.18, R4.19, R4.20, R4.21 | In progress | Settings slice supports provider cards (Gemini/Ollama/OpenRouter), test-before-save gate, save-triggered catalog refresh, manual refresh gating, grouped model picker, global default selection, invalid-config detection for null/default resolution, webContents-scoped snapshot cleanup hooks, renderer unload prompt when there are unsaved draft changes, dynamic Ollama model discovery from local `/api/tags`, and SQLite-backed persistence for provider/global-default settings. | Shared pure rules in `src/shared/domain/model-ref.ts`; settings slice orchestration in `src/main/features/settings/slice.ts` (including Ollama model fetch dependency + refresh path); strict IPC handlers in `src/main/features/settings/ipc-handlers.ts` + lifecycle wiring in `src/main/ipc/register-ipc.ts` and `src/main/index.ts`; SQLite persistence service in `src/main/services/db/sqlite-persistence-service.ts`; preload bridge in `src/preload/index.ts`; renderer page in `src/renderer/App.tsx`. | Runtime-failure-triggered refresh (`R4.16`) and council/agent invalid-config blocking surfaces (`R4.11`, `R4.20`, `R4.21`) remain for future slices; unsaved-change confirmation currently covers unload and still needs app-internal navigation dialog integration. | `tests/unit/model-resolution.spec.ts`, `tests/unit/ipc-validator-shapes.spec.ts`, `tests/integration/providers-handlers.integration.spec.ts`, `tests/integration/providers-ipc.contract.integration.spec.ts`, `tests/integration/sqlite-persistence.integration.spec.ts` |
| R5.1, R5.2, R5.3, R5.4, R5.5, R5.6, R5.7, R5.8 | In progress | Pure tag value-object baseline exists for length limits, max-per-object, duplicate prevention, and case-insensitive exact filter match. | Implemented in `src/shared/domain/tag.ts`; no feature slice wiring yet. | Integrate tag rules into Agents/Councils commands, persistence, and renderer UX. | `tests/unit/tag-value-object.spec.ts` |
| R6.1, R6.2, R6.3, R6.4, R6.5, R6.6 | In progress | Agents and Councils slices now both implement constant page-size pagination, has-more behavior, and filter/search query semantics in main-process query paths. | Implemented in `src/main/features/agents/slice.ts` and `src/main/features/councils/slice.ts`; Agents behavior is wired in renderer, Councils renderer wiring is still pending. | Councils list UI controls and load-more UX remain pending in renderer. | `tests/integration/agents-handlers.integration.spec.ts`, `tests/integration/councils-handlers.integration.spec.ts` |
| R7.1, R7.2 | In progress | Main-process keychain adapter uses keytar wiring for provider secret writes while preserving secret refs in provider config responses; settings/agents/councils foundations now persist locally in SQLite under userData. | Keychain adapter in `src/main/services/keychain/keytar-keychain-service.ts`; SQLite persistence and migrations in `src/main/services/db/sqlite-persistence-service.ts` + `src/main/services/db/migrations/0001_initial_schema.sql` and `src/main/services/db/migrations/0002_councils_foundation.sql`; wired through `src/main/ipc/register-ipc.ts`, `src/main/features/settings/slice.ts`, `src/main/features/agents/slice.ts`, and `src/main/features/councils/slice.ts`. | Message/runtime entities are not persisted yet; keychain remains required for credential material. | `tests/unit/keytar-keychain-service.spec.ts`, `tests/integration/providers-ipc.contract.integration.spec.ts`, `tests/integration/sqlite-persistence.integration.spec.ts` |
| R8.1, R8.2, R8.3 | Not started | No generation UX/error handling implementation yet. | No generation flow or error UI exists yet. | Implement non-streaming placeholder/cancel/error recovery semantics. | None |

### 2.2 UX requirements (`U*`)

| Requirement IDs | Status | What is done | How it is done | Known gaps / follow-ups | Tests covering it |
| --- | --- | --- | --- | --- | --- |
| U0.1, U0.2, U0.3, U0.4, U0.5, U0.6, U0.7, U0.8, U0.9, U0.10 | Not started | UX baseline not implemented. | No renderer shell/components exist yet. | Implement UX principles and explicit non-goals in initial shell. | None |
| U1.1, U1.2, U1.3, U1.4, U1.5, U1.6, U1.7, U1.8 | In progress | Home shell now provides top tabs (Councils/Agents/Settings), default Councils tab, and full-screen Agent editor view with Back action and unsaved-change confirmation. | Implemented in `src/renderer/App.tsx` with tab state + screen mode transitions and unload/discard prompts. | Window-title parity (`U1.8`) and per-tab state persistence depth (`U1.4`) still need finalization across all future views. | `scripts/diagnostics/scenarios/agents-smoke.json` |
| U2.1, U2.2, U2.3, U2.4, U2.5, U2.6, U2.7, U2.8 | Not started | Shared badges/toasts/tooltips/keyboard behavior not implemented. | No shared UI primitives exist yet. | Implement global UI state/feedback behaviors. | None |
| U3.1, U3.2, U3.3, U3.4, U3.5, U3.6, U3.7, U3.8, U3.9, U3.10, U3.11 | In progress | Councils tab now renders list rows with title/topic/mode/model/tags, archived + invalid-config badges, search/tag/archive/sort controls, pagination/load-more, and New Council CTA with editor navigation. | `src/renderer/App.tsx`, `src/main/features/councils/slice.ts`, `src/main/features/councils/ipc-handlers.ts`. | Row-level overflow action density and final keyboard/a11y behavior still need polish. | `scripts/diagnostics/scenarios/councils-ui.json`, `tests/integration/councils-handlers.integration.spec.ts` |
| U4.1, U4.2, U4.3, U4.4 | In progress | Agents tab now renders rows with name/model/tags/invalid-config badge, search/tag/sort controls, load-more pagination, empty state messaging, refresh-model action, and New Agent CTA. | `src/renderer/App.tsx`, `src/renderer/styles.css`, `src/main/features/agents/slice.ts`. | Keyboard row-focus/open behavior and final visual polish are still pending. | `tests/integration/agents-handlers.integration.spec.ts`, `scripts/diagnostics/scenarios/agents-smoke.json` |
| U5.1, U5.2, U5.3, U5.4, U5.5, U5.6, U5.7, U5.8, U5.9, U5.10, U5.11 | In progress | Settings tab now renders provider cards with test status + save gating, Ollama API-key note with optional field for local/remote endpoints, grouped model picker, invalid-config badge, refresh models action with progress/status feedback, blocking keychain-unavailable save error messaging, fixed light-theme readable text colors, and deduplicated bottom-right info/warning/error toasts for user-notification actions. | `src/renderer/App.tsx`, `src/renderer/styles.css`, `src/preload/index.ts`, `src/shared/ipc/window-api.ts`, `src/main/features/settings/slice.ts`, `src/main/services/keychain/keytar-keychain-service.ts`. | Toasts are currently implemented in Settings slice only; shared cross-view toast primitive for future slices is still pending. | `tests/integration/providers-handlers.integration.spec.ts`, `tests/integration/providers-ipc.contract.integration.spec.ts`, `tests/unit/keytar-keychain-service.spec.ts` |
| U6.1, U6.2, U6.3, U6.4, U6.5, U6.6, U6.7, U6.8, U6.9, U6.10 | In progress | Full-screen Agent create/edit form is implemented with required fields, optional verbosity/temperature, tag input, grouped model picker, refresh-model action, save/cancel, and delete confirmation for existing agents. | `src/renderer/App.tsx` editor flow, `src/main/features/agents/slice.ts` save/delete validation, `src/main/features/agents/ipc-handlers.ts` + preload/IPC wiring. | Council-reference delete blocking (`U6.8`) remains pending until councils data exists. | `tests/integration/agents-handlers.integration.spec.ts`, `tests/integration/agents-ipc.contract.integration.spec.ts`, `scripts/diagnostics/scenarios/agents-smoke.json` |
| U7.1, U7.2 | In progress | Council editor flow now supports create/edit with required title/topic/members fields, mode selection locked after creation, tags, conductor model picker with refresh, archive/restore, and delete actions. | `src/renderer/App.tsx` council editor flow with `window.api.councils.*` integration; validation/immutability in `src/main/features/councils/slice.ts`. | Topic/Goal product decision details and deeper UX guidance (`U16.1`) remain open. | `scripts/diagnostics/scenarios/councils-ui.json`, `tests/integration/councils-handlers.integration.spec.ts` |
| U8.1, U8.2, U8.3, U8.4, U8.5, U8.6, U8.7, U8.8, U8.9, U8.10, U8.11 | Not started | Council view layout/runtime UX not implemented. | No transcript/right-panel runtime UI exists yet. | Implement full runtime layout and archived/read-only behavior. | None |
| U9.1, U9.2, U9.3, U9.4, U9.5, U9.6, U9.7, U9.8 | Not started | Briefing/Members panel UX not implemented. | No right-panel tab content exists yet. | Implement briefing, member actions, and manual speaker selection control. | None |
| U10.1, U10.2, U10.3, U10.4, U10.5, U10.6, U10.7, U10.8, U10.9, U10.10, U10.11, U10.12, U10.13, U10.14 | Not started | Config-tab UX not implemented. | No inline-edit controls in renderer yet. | Implement config tab, pencil-only edit mechanics, and model picker behavior. | None |
| U11.1, U11.2, U11.3, U11.4, U11.5, U11.6, U11.7 | Not started | Confirmation/dialog UX not implemented. | No dialog system wired to runtime/navigation state. | Implement discard/delete/remove/export dialogs and failure toasts. | None |
| U12.1, U12.2, U12.3, U12.4, U12.5, U12.6 | Not started | Autopilot UX controls not implemented. | No autopilot start modal or top-bar run/pause integration exists yet. | Implement start-limit modal and running/paused/error UX behavior. | None |
| U13.1, U13.2, U13.3, U13.4 | Not started | Manual mode UX not implemented. | No manual speaker selection/composer wiring exists yet. | Implement members-driven selection, conductor composer semantics, retry UX. | None |
| U14.1, U14.2, U14.3, U14.4, U14.5 | In progress | Agents list and editor now surface invalid-config badges from current view model snapshots; refresh-model actions are available in list and edit contexts. | Invalid-config derivation in `src/main/features/agents/slice.ts` and renderer indicators in `src/renderer/App.tsx`. | Council-focused invalid-config controls (`U14.2`-`U14.5`) remain pending with council/runtime slices. | `tests/integration/agents-handlers.integration.spec.ts`, `scripts/diagnostics/scenarios/agents-smoke.json` |
| U15.1, U15.2, U15.3, U15.4 | Not started | Accessibility baseline not implemented. | No interactive renderer controls present yet. | Implement focus/keyboard/accessibility labels and identity redundancy. | None |
| U16.1, U16.2, U16.3, U16.4 | Not started | Open product decisions unresolved. | Decision records not yet created in `/docs/plans/`. | Resolve open decisions and reflect final behavior in requirements/tests. | None |

### 2.3 Architecture/platform requirements (`A*`..`I*` from architecture decisions)

| Requirement IDs | Status | What is done | How it is done | Known gaps / follow-ups | Tests covering it |
| --- | --- | --- | --- | --- | --- |
| A1, A2, A3 | In progress | Baseline Electron shell with secure BrowserWindow defaults, preload bridge, typed IPC validation, and webContents lifecycle cleanup for view-scoped resources is implemented and now extended with Agents + Councils IPC surfaces. | `src/main/index.ts`, `src/main/windows/main-window-options.ts`, `src/preload/index.ts`, `src/main/ipc/register-ipc.ts`, `src/main/features/settings/slice.ts`, `src/main/features/agents/slice.ts`, `src/main/features/councils/slice.ts`, `src/shared/ipc/validators.ts`. | Expand IPC surface per remaining runtime slices and add additional contract tests for path non-leak conditions. | `tests/unit/main-window-security-defaults.spec.ts`, `tests/unit/ipc-validator-shapes.spec.ts`, `tests/integration/providers-handlers.integration.spec.ts`, `tests/integration/providers-ipc.contract.integration.spec.ts`, `tests/integration/agents-ipc.contract.integration.spec.ts`, `tests/integration/councils-ipc.contract.integration.spec.ts` |
| B1, B2, B3, B4 | In progress | SQLite persistence service is implemented with userData database path wiring, ordered migration application, schema migration tracking, foreign-keys pragma, and persisted councils/member references. | `src/main/services/db/sqlite-persistence-service.ts`, `src/main/services/db/migrations/0001_initial_schema.sql`, `src/main/services/db/migrations/0002_councils_foundation.sql`, `src/main/ipc/register-ipc.ts`, `scripts/verify-migrations.ts`. | Message transcript/runtime-state persistence and advanced council constraints remain future slices. | `tests/integration/migration-verification.integration.spec.ts`, `tests/integration/sqlite-persistence.integration.spec.ts` |
| C1, C2, C3 | In progress | Provider save flow writes credential references and keeps secrets in a main-only keychain service boundary; IPC responses expose only `hasCredential` and never include secret values; keychain-unavailable save path is explicitly blocked with user-safe error. | `src/main/features/settings/slice.ts`, `src/main/features/settings/ipc-handlers.ts`, `src/main/ipc/register-ipc.ts`, `src/main/services/keychain/keytar-keychain-service.ts`, `src/shared/ipc/dto.ts`. | Validate Linux native-module packaging/rebuild reliability in CI and release builds. | `tests/integration/providers-ipc.contract.integration.spec.ts`, `tests/integration/providers-handlers.integration.spec.ts`, `tests/unit/keytar-keychain-service.spec.ts` |
| D1, D2, D3, D4, D5 | In progress | Settings/provider slice keeps provider connectivity logic in main only; renderer uses preload/IPC exclusively and receives secret-safe normalized errors. | `src/main/features/settings/slice.ts`, `src/main/features/settings/ipc-handlers.ts`, `src/preload/index.ts`, `src/renderer/App.tsx`. | Full AI generation adapters with AbortSignal + runtime orchestration remain future runtime slice work. | `tests/integration/providers-ipc.contract.integration.spec.ts`, `tests/integration/providers-handlers.integration.spec.ts` |
| E1, E2, E3, E4 | In progress | FCIS baseline established: pure shared domain modules + `neverthrow` Result usage + service contracts separate from domain logic. | `src/shared/domain/errors.ts`, `src/shared/domain/tag.ts`, `src/shared/domain/model-ref.ts`, `src/main/services/interfaces.ts`. | Add vertical-slice deciders, handler orchestration, and typed domain error mapping across all features. | `tests/unit/domain-errors-shape.spec.ts`, `tests/unit/model-resolution.spec.ts`, `tests/unit/ids.spec.ts`, `tests/unit/tag-value-object.spec.ts` |
| F1, F2 | Not started | Context truncation/storage policy not implemented. | No prompt builder/settings context config yet. | Implement configurable `N`, persist outputs only (not raw prompts/payloads). | None |
| G1, G2, G3 | Not started | Packaging/platform scope not implemented. | No packaging/build pipeline files yet. | Add AppImage packaging flow, migration-on-upgrade behavior, Linux-first scope gates. | None |
| H1, H2, H3 | In progress | Bun project scripts and quality gates are implemented (format/lint/typecheck/build/unit/integration/coverage/boundary/migration verification) and native Electron module rebuild automation now exists for SQLite/keychain modules. | `package.json`, `biome.json`, `tsconfig*.json`, `vite.config.ts`, `vitest.*.config.ts`, scripts under `scripts/`, plus `rebuild:native` script in `package.json`. | Add CI parity workflows and automate native rebuilds in release pipeline. | `tests/integration/scripts-presence.integration.spec.ts`, `tests/integration/boundary-check-script.integration.spec.ts`, `tests/integration/migration-verification.integration.spec.ts`, `tests/integration/sqlite-persistence.integration.spec.ts` |
| I1, I2 | In progress | UUID brand helper types and UTC timestamp formatting baseline exist in shared/domain and IPC health response. | `src/shared/domain/ids.ts`, `src/main/ipc/register-ipc.ts`. | Enforce UUID generation/storage and UTC-to-local rendering consistently in persisted entities. | `tests/unit/ids.spec.ts` |

## 3) Test-to-Requirement Index (Reverse Mapping)

Current index entries:
- `domain-errors-shape.spec.ts` (`tests/unit/domain-errors-shape.spec.ts`) -> E2, E3
- `tag-value-object.spec.ts` (`tests/unit/tag-value-object.spec.ts`) -> R5.6, R5.7, E1, E2
- `model-resolution.spec.ts` (`tests/unit/model-resolution.spec.ts`) -> E2, R4.12, R4.15, R4.18, R4.19
- `ids.spec.ts` (`tests/unit/ids.spec.ts`) -> I1
- `main-window-security-defaults.spec.ts` (`tests/unit/main-window-security-defaults.spec.ts`) -> A2
- `in-memory-keychain-service.spec.ts` (`tests/unit/in-memory-keychain-service.spec.ts`) -> C1
- `keytar-keychain-service.spec.ts` (`tests/unit/keytar-keychain-service.spec.ts`) -> C1, C2, H2
- `ipc-validator-shapes.spec.ts` (`tests/unit/ipc-validator-shapes.spec.ts`) -> A3, R4.6, R4.8, R4.17, R1.1, R1.2, R2.1, R2.3, R2.7, R6.1
- `scripts-presence.integration.spec.ts` (`tests/integration/scripts-presence.integration.spec.ts`) -> H1, H3, IMPL-001
- `boundary-check-script.integration.spec.ts` (`tests/integration/boundary-check-script.integration.spec.ts`) -> A3, IMPL-005
- `migration-verification.integration.spec.ts` (`tests/integration/migration-verification.integration.spec.ts`) -> B3, H3
- `sqlite-persistence.integration.spec.ts` (`tests/integration/sqlite-persistence.integration.spec.ts`) -> B1, B2, B3, R7.1, R2.1
- `providers-handlers.integration.spec.ts` (`tests/integration/providers-handlers.integration.spec.ts`) -> R4.7, R4.8, R4.9, R4.10, R4.13, R4.18, C2, A3, U5.4, U5.5, U5.6, U5.9, U5.11, IMPL-007
- `providers-ipc.contract.integration.spec.ts` (`tests/integration/providers-ipc.contract.integration.spec.ts`) -> A3, C1, D5, IMPL-005
- `agents-handlers.integration.spec.ts` (`tests/integration/agents-handlers.integration.spec.ts`) -> R1.1, R1.2, R1.4, R1.5, R1.8, R1.9, R1.12, R1.13, R1.14, R1.15, R1.16, R1.17, R1.18, R1.19, R6.1, R6.2, R6.3, R6.4, U4.1, U4.2, U4.3, U4.4, U6.1, U6.2, U6.4, U6.6
- `councils-handlers.integration.spec.ts` (`tests/integration/councils-handlers.integration.spec.ts`) -> R2.1, R2.2, R2.3, R2.4, R2.6, R2.7, R2.8, R2.9, R2.20, R2.21, R2.22, R2.23, R2.24, R6.1, R6.2, R6.3, R6.4, R6.6
- `councils-ipc.contract.integration.spec.ts` (`tests/integration/councils-ipc.contract.integration.spec.ts`) -> A3, R2.1, R2.3
- `agents-ipc.contract.integration.spec.ts` (`tests/integration/agents-ipc.contract.integration.spec.ts`) -> A3, R1.1, R1.2

## 4) Coverage Targets and Current State

Coverage targets (policy):
- Unit tests: 90%.
- Integration tests: 50%.
- Contract/guardrail checks: 100% pass rate (gate checks, not line coverage).
- E2E tests: not planned.

Current enforcement state:
- Coverage measurement tooling: implemented via Vitest + `@vitest/coverage-v8`.
- Coverage thresholds in test config: implemented (`vitest.unit.config.ts` and `vitest.integration.config.ts`).
- CI coverage gate: not implemented yet.

To be implemented (linked to planning requirement):
- Add CI workflow that enforces coverage and quality gates with local-command parity.
- Expand coverage scope from foundation modules to full feature slices as implementation grows.
- Add explicit contract tests for IPC secret/path non-leak and runtime cancellation semantics.

## 5) Implied Requirements (Not Explicitly Numbered in `/docs`)

### Business decisions

| ID | Rationale | Affects | Validation | Related explicit requirements |
| --- | --- | --- | --- | --- |
| IMPL-001 | `/docs/pre-merge-checklist.md` and architecture docs require merge gates. Baseline script names are now defined, but CI parity is still missing. | Build/test script contract and CI gate completeness. | Script presence checks + CI run of all required gates. | H1, H3, R8.3, U17 acceptance checklist |
| IMPL-002 | UX/functional conflict exists for topic collection during council creation (`U16.1` vs `R2.2`). | Council create flow and start gating. | Requirement decision record + tests covering chosen flow. | R2.2, U7.1, U16.1 |

### UX decisions

| ID | Rationale | Affects | Validation | Related explicit requirements |
| --- | --- | --- | --- | --- |
| IMPL-003 | Manual mode speaker selection control detail remains open (row click vs explicit button). | Members panel interaction and accessibility behavior. | Interaction/unit/component tests + keyboard navigation checks. | R3.25, U9.8, U13.1, U16.2 |
| IMPL-004 | Autopilot max-turn numeric constraints are unspecified. | Start/resume modal validation and error messaging. | Validation tests for boundaries and invalid input behavior. | R3.23, U12.2, U16.3 |
| IMPL-007 | Ollama model catalog must mirror locally available models instead of static placeholders, and remote Ollama endpoints may require API keys even though local defaults do not. | Settings provider test/save/refresh model catalog behavior and Ollama credentials handling. | Integration tests with injected Ollama model fetcher and manual validation against local `ollama list`. | R4.7, R4.8, R4.10, U5.4, U5.9 |
| IMPL-008 | Renderer text contrast must remain readable regardless of OS dark/light preference to avoid white-on-light unreadable UI. | Renderer base theme variables and text/input colors. | Renderer CSS assertions + manual visual verification in Electron window on Linux. | U5.1, U5.2, U15.1 |
| IMPL-009 | User-facing success/warning/error events need explicit toast notifications; inline status text alone is insufficient for clear feedback. | Settings interaction feedback for connection test, save, refresh, and global-default operations. | Renderer interaction checks plus scenario-based Electron diagnostics (`tool:electron`). | U2.1, U2.3, U5.11 |

### Security decisions

| ID | Rationale | Affects | Validation | Related explicit requirements |
| --- | --- | --- | --- | --- |
| IMPL-005 | Architecture requires strict secret/path boundary enforcement across IPC. Static boundary script now exists; deeper IPC payload leak checks are still pending. | IPC contract and error payload sanitization. | IPC contract tests + static boundary checks in CI. | A3, C1, D5, U2.5 |
| IMPL-006 | Warning-as-error policy needs consistent automation across lint/type/build/test to avoid silent regressions. | All quality gates and CI parity. | CI configuration asserting warning-to-error flags where supported. | Zero-error policy, H3, pre-merge checklist section 5 |

## 6) Ongoing Work

- Current in-progress items:
  - Councils foundation is now implemented in main/IPC/persistence plus baseline renderer list/editor flows.
  - Agents delete flow now enforces council-reference blocking (`R1.14`) via cross-slice guard.
  - Open decisions remain: `U16.1`, `U16.2`, `U16.3`, `U16.4`.
- Plan files under `/docs/plans/`:
  - `docs/plans/001-foundation-bootstrap.md`.
  - `docs/plans/002-settings-slice.md`.
  - `docs/plans/003-agents-slice.md`.
  - `docs/plans/004-sqlite-persistence-foundation.md`.
  - `docs/plans/005-councils-slice-foundation.md`.
- Next implementation step:
  - Implement Council View runtime orchestration (`R3.*`, `U8.*`, `U9.*`, `U12.*`, `U13.*`) on top of the new Councils foundation.
