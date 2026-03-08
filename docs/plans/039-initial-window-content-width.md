# Plan 039: Initial Window Content Width

## Objective
Make the Electron app open at an initial width that matches the renderer's centered home-shell content width more closely, so first launch feels fitted instead of overly wide.

## Scope
- Update main-window sizing constants/options for the initial BrowserWindow width.
- Add or update automated coverage for the sizing contract.
- Add or update an Electron diagnostic scenario that verifies the initial renderer width matches the intended fitted size on launch.
- Refresh `docs/status.md` and traceability artifacts impacted by the test updates.

## Non-goals
- No responsive-layout redesign in the renderer.
- No change to Home/Council/Agent page structure or spacing tokens.
- No dynamic runtime resizing after launch based on changing page content.

## Architecture impact assessment
- The change stays in the Electron shell boundary under `src/main/windows/`, preserving Renderer -> Preload -> Main layering.
- Renderer layout remains the source for the desired content width; the main process only mirrors the established shell width for initial window creation.
- IPC contracts and preload APIs remain unchanged.

## Step-by-step implementation plan
1. Derive a fitted initial content width from the renderer shell constraints and apply it in `buildMainWindowOptions()` using Electron window options appropriate for content-sized sizing.
2. Extend unit coverage around main window options so the fitted width contract is regression-tested.
3. Add/update an Electron diagnostic scenario that validates the launch viewport width is aligned with the intended initial content width.
4. Refresh `docs/status.md`, regenerate traceability artifacts, and run the required validation commands.

## Risks and mitigations
- Risk: the fitted width could undershoot and make the home layout feel cramped.
  - Mitigation: keep the width aligned with the existing 72rem content shell plus its horizontal padding, which already satisfies the documented 1024px usability baseline.
- Risk: window-frame differences across platforms could make exact outer-width assertions flaky.
  - Mitigation: validate content/viewport width rather than native outer frame width in diagnostics.
- Risk: future renderer shell-width changes could drift from the Electron default.
  - Mitigation: document the sizing constant clearly and cover it with a unit test.

## Coverage matrix
| Requirement IDs | Planned test case names | Validation intent |
| --- | --- | --- |
| U0.2 | `uses a fitted initial content width for the main window` | Verify the Electron shell opens with a content-sized width that matches the renderer shell instead of the previous overly wide default |
| U0.2 | `initial window viewport width matches the fitted shell width` | Verify the launched app viewport width stays aligned with the intended initial fitted width |

## Validation commands to run
- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test:unit`
- `bun run tool:electron -- --scenario scripts/diagnostics/scenarios/initial-window-content-width.json`
- `bun run trace:generate`
- `bun run check:traceability`

## Rollback strategy
- Revert the main-window sizing constants/options, associated unit/diagnostic coverage, and docs updates together if the fitted initial width causes launch regressions or makes the default layout feel too constrained.
