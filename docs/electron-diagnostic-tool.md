# Electron Diagnostic Tool

This repository includes a Playwright-powered Electron runner that any agent can use to validate UI behavior by executing scenario steps.

## Commands

- `bun run diag:electron`
  - Runs the default smoke scenario at `scripts/diagnostics/scenarios/settings-smoke.json`.
- `bun run tool:electron -- --scenario <path-to-scenario.json>`
  - Runs a custom scenario file.

Optional flags:

- `--base-url http://localhost:5173`
- `--artifacts-dir artifacts/electron-tool`
- `--startup-timeout-ms 30000`
- `--step-timeout-ms 10000`
- `--skip-build` (skip main/preload build)
- `--skip-renderer` (use an already-running renderer dev server)

## Artifacts

The tool writes output to `artifacts/electron-tool/` by default:

- screenshots requested by scenario steps
- `<scenario-name>.state.json` with values captured via `evaluate` + `saveAs`

## Scenario Format

Scenario files are JSON with:

- `name`: string
- `steps`: array of step objects

Supported `action` values:

- `waitForText` `{ text, timeoutMs? }`
- `waitForSelector` `{ selector, state?, timeoutMs? }`
- `click` `{ selector, timeoutMs? }`
- `fill` `{ selector, value, timeoutMs? }`
- `press` `{ key }`
- `selectOption` `{ selector, value, timeoutMs? }`
- `expectVisible` `{ selector, timeoutMs? }`
- `expectText` `{ selector, text, timeoutMs? }`
- `evaluate` `{ expression, saveAs?, timeoutMs? }`
- `assertSaved` `{ key, equals?, hasPath? }`
- `screenshot` `{ file?, fullPage? }`

`evaluate.expression` must be a JavaScript function string, for example:

```json
{
  "action": "evaluate",
  "saveAs": "ping",
  "expression": "async () => window.api.health.ping({ message: 'diag' })"
}
```
