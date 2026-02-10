# FCIS Architecture Guardrails

Use this checklist while migrating slices to Functional Core, Imperative Shell.

- Keep `lib/core/**` pure: no IO, no global runtime calls, no UI imports.
- Model expected business failures as typed domain errors.
- Return plans from core decisions: state delta + effect descriptions.
- Interpret effects in shell/application using Effect services and layers.
- Parse and validate external data at boundaries before entering core.
