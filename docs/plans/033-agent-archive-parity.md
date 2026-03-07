# Plan 033: Agent Archive Parity With Councils

## Objective
Document the current Council archive semantics and implement the same archive/restore capability for Agents, including list filtering, read-only handling, Council-member state propagation, and an archive action in the Agent card `...` menu.

## Scope
- Add Agent archive persistence, DTO/IPC contracts, validators, and main-slice state transitions.
- Add Agent list archived-status filtering (`Active only`, `Archived only`, `All`) alongside the existing search/tag/sort controls.
- Add Agent archive/restore actions to the Agent card `...` menu and a matching restore/archive affordance in Agent edit view.
- Make archived Agents read-only in Agent edit view and surface a clear archived indicator in the Agents list.
- Define and enforce how archived Agents affect Council create/edit/runtime flows.
- Add or update tests, Electron diagnostics, requirements docs, and status tracking for the new behavior.

## Non-goals
- No change to Council archive semantics beyond any wiring needed to consume archived-Agent metadata.
- No change to Agent delete rules beyond interactions required to coexist with archive state.
- No background migration of archived Agents into a different entity type or list section.

## Architecture impact assessment
- Main-process work spans `src/main/features/agents/slice.ts`, `src/main/features/agents/ipc-handlers.ts`, `src/shared/ipc/dto.ts`, `src/shared/ipc/validators.ts`, `src/shared/ipc/window-api.ts`, `src/preload/index.ts`, and SQLite persistence/migrations under `src/main/services/db/`.
- Renderer work spans `src/renderer/App.tsx` and `src/renderer/styles.css`, preserving the existing preload-only boundary.
- Council integration likely requires widening `CouncilAgentOptionDto` and the `register-ipc` agent-loading path so Council flows can distinguish archived Agents from active ones without leaking direct renderer-to-service access.
- Requirements/UX docs must be extended with new exact Agent archive IDs before implementation so traceability stays policy-compliant.

## Current Council archive behavior to mirror
1. Persistence stores archive state as nullable `archivedAtUtc`, exposed to the renderer as boolean `archived`.
2. Lists keep archived items visible by default, show a clear archived badge, and support `active | archived | all` filtering.
3. Archive/restore is a direct state toggle with no confirmation dialog.
4. Archived items become read-only in their edit/runtime surfaces.
5. Council-specific runtime guard: an Autopilot Council cannot be archived while running and unpaused.
6. Council View keeps export available while archive disables mutation actions, composer usage, runtime progression, and config edits.

## Proposed Agent archive semantics
1. Agents gain the same persisted nullable archive timestamp pattern and boolean DTO flag used by Councils.
2. Archived Agents remain visible in the Agents list by default, with the same tri-state archived filter and a visible archived badge.
3. The Agent card `...` menu gets `Archive agent` / `Restore agent`; Agent edit view gets the same state toggle for parity with Council edit flow.
4. Archived Agents are fully read-only in Agent edit view: fields remain visible, Save is blocked, and the main slice rejects mutation until restored.
5. Archived Agents remain visible for existing Council membership/history, but cannot be newly added to Councils while archived.
6. Council runtime/state handling should treat archived members as unusable runtime participants: start/resume/manual selection must block when a Council still references an archived Agent, with clear remediation messaging to restore or remove that Agent.

## Step-by-step implementation plan
1. Extend `docs/requirements.md`, `docs/ux-requirements.md`, and `docs/status.md` with exact new Agent archive/filter/read-only requirement IDs before code changes.
2. Add agent archive persistence support: migration for `agents.archived_at_utc`, persistence load/save mapping, and any migration verification updates.
3. Widen Agent DTO/contracts/validators with archived state and archived-filter request fields, plus a dedicated `setArchived` command mirroring Councils.
4. Update `src/main/features/agents/slice.ts` to support archived filtering, archive/restore transitions, and save-time read-only enforcement for archived records.
5. Update Agent IPC wiring (`ipc-handlers`, `register-ipc`, preload, window API) to expose the new list filter and archive command.
6. Propagate archived-Agent metadata into Council-facing agent-option loading, then enforce state rules so archived Agents:
   - stay resolvable for existing memberships and transcript naming,
   - are excluded from add-member/create pickers,
   - block start/resume/manual-member actions when still present in a Council.
7. Update renderer state and UI in `src/renderer/App.tsx`:
   - add Agents archived filter control,
   - show archived badge on Agent cards,
   - add archive/restore to the Agent `...` menu,
   - show archived read-only messaging and archive/restore control in Agent edit view,
   - surface archived-member warnings/disabled reasons inside Council flows.
8. Add or update integration, validator, and diagnostic coverage; regenerate traceability; run full required validation.

## Risks and mitigations
- Risk: excluding archived Agents from Council option payloads could break existing Councils that still reference them.
  - Mitigation: keep archived Agents in the payload with explicit metadata, and filter only at the renderer/domain rule level for new selection.
- Risk: archived-Agent runtime blocking may surprise users if legacy Councils already contain those members.
  - Mitigation: provide explicit blocked-state copy in Council View and allow restore/remove remediation paths.
- Risk: adding archive state to Agents could regress delete-name-uniqueness behavior.
  - Mitigation: keep current uniqueness and delete checks intact, and add integration tests that cover active/archived combinations.
- Risk: requirements drift because Agent archive behavior is not currently specified in `/docs`.
  - Mitigation: make docs updates the first implementation step and do not merge code before exact IDs exist.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| TBD - new Agent archive requirement IDs in `docs/requirements.md` and `docs/ux-requirements.md` | `archives and restores agent while preserving list visibility and archived filtering` | Verify archive persistence, default list visibility, and `active/archived/all` query behavior |
| TBD - new Agent archive requirement IDs in `docs/requirements.md` and `docs/ux-requirements.md` | `blocks editing archived agents until restored` | Verify Agent edit/save becomes read-only at both renderer and main-slice levels |
| TBD - new Agent archive requirement IDs plus impacted Council runtime IDs | `prevents selecting archived agents in councils and blocks runtime until restored or removed` | Verify Council create/edit/runtime flows consume archived-Agent metadata safely and enforce the new state rules |
| A3, C1, existing IPC contract IDs plus new Agent archive IDs | `rejects invalid set archived agent payload` | Verify the new IPC boundary validates archive command shape and keeps error sanitization intact |

## Validation commands to run
- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test:unit`
- `bun run test:integration`
- `bun run check:coverage-guardrails`
- `bun run check:boundaries`
- `bun run check:migrations`
- `bun run diag:electron`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/agents-smoke.json`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/ui-inspect.json`
- `bun run trace:generate`
- `bun run check:traceability`

## Rollback strategy
- Revert the Agent archive migration, DTO/IPC/slice changes, renderer updates, and Council archived-member integration together if the new state model proves too disruptive or creates unacceptable Council compatibility issues.
