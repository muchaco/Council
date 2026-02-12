# Diagnostics Workflow

Council now writes structured diagnostics events to a local NDJSON log in the Electron main process.

## Where Logs Live

- Default log folder: `<userData>/logs`
- Active file: `diagnostics.ndjson`
- In development, events are also mirrored to the main-process console with a `[diagnostics]` prefix.

Use **Settings -> Diagnostics** to inspect these paths directly.

## What To Capture For Bug Reports

1. Reproduce the issue.
2. Open **Settings -> Diagnostics**.
3. Click **Copy Summary** and paste into the bug report.
4. Click **Export Bundle** and attach the exported `.txt` file.
5. Include timestamp and the visible session ID from Diagnostics.

## Event Model

Diagnostics follow wide-event logging:

- One canonical event per IPC request completion.
- Structured JSON payload with operation outcome and duration.
- Context fields for business diagnostics (for example session and model identifiers).

All logs remain local. Council does not upload telemetry.
