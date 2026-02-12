# Release Checklist

## Electron startup smoke tests

- [ ] Launch packaged build and verify the main window renders from `app://index.html`.
- [ ] Confirm the renderer loads without preload errors while `webPreferences.sandbox = true`.
- [ ] Verify core startup flows: sessions list loads, settings screen opens, and one IPC-backed action succeeds.
- [ ] Confirm unexpected top-level navigations are blocked (for example `file:///tmp/evil.html`).
