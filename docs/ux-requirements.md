# Council — UX Requirements Specification (Comprehensive)

Confidence scale: **1.00** fully specified and testable, **0.85** minor detail open, **0.70** notable ambiguity.

This document defines user-facing UX behavior for Council. It complements the Functional Requirements and Architecture decisions by specifying navigation, layout, interaction patterns, dialogs, states, validation messaging, and keyboard behavior.

---

## 0. UX Principles and Non-Goals

### 0.1 Principles
- **U0.1** Optimize for the primary workflow: **running Councils** (Council View). **[1.00]**
- **U0.2** Spacious and readable layout. Must remain usable at **1024 px width**. **[0.95]**
- **U0.3** Polished consumer app feel. **[1.00]**
- **U0.4** App appearance follows OS theme (light or dark). **[1.00]**
- **U0.5** Inline editing must not interfere with copying text. Editing is never triggered by clicking selectable text. **[1.00]**
- **U0.6** Invalid config is communicated via small **yellow warning badge** on affected items and controls only. No guided fix flow. **[1.00]**
- **U0.7** All changes require explicit Save where applicable. No auto-save. **[1.00]**

### 0.2 Non-goals
- **U0.8** No templates for Agents or Councils. **[1.00]**
- **U0.9** No briefing history UI, only the latest briefing. **[1.00]**
- **U0.10** No streaming tokens. A single thinking placeholder is used. **[1.00]**

---

## 1. Navigation and Shell

### 1.1 Home screen and tabs
- **U1.1** The app opens to a **Home screen** with top tabs: **Councils**, **Agents**, **Settings**. **[1.00]**
- **U1.2** Tabs are presented in a compact, full-width top bar. There is no persistent sidebar. **[1.00]**
- **U1.3** The default active tab on launch is **Councils** list. **[1.00]**
- **U1.4** Switching tabs does not discard data; list state (search text, filters, sort) is preserved per tab in the current app session. **[0.85]**

### 1.2 Full-screen detail views
- **U1.5** Opening a Council, Agent create/edit, Council create replaces Home with a full-screen view. **[1.00]**
- **U1.6** Full-screen views include a top bar with a **Back** button that returns to Home and restores the last active tab. **[1.00]**
- **U1.7** If the user attempts to navigate back with unsaved changes, show a confirmation dialog (see Section 11). **[1.00]**

### 1.3 Window title
- **U1.8** Window title reflects the current view:
  - Home: "Council"
  - Council View: "Council: {Council Title}"
  - Agent Edit: "Agent: {Agent Name}" (or "New Agent")
  - Council Create: "New Council"
  - Settings: "Settings"
  **[0.85]**

---

## 2. Global UI Elements

### 2.1 Badges
- **U2.1** "Invalid config" is shown as a small yellow warning badge with an icon. Tooltip text: "Invalid config". **[1.00]**
- **U2.2** Badges appear only on affected list items and affected controls (Start, Resume, Save). **[1.00]**
- **U2.3** Badges do not force navigation and do not show a "Fix" action. **[1.00]**

### 2.2 Tooltips
- **U2.4** Disabled actions show a tooltip explaining why:
  - "Archived councils are read-only."
  - "This member cannot be removed because they have messages."
  - "Cannot start because model configuration is invalid."
  **[1.00]**

### 2.3 Toasts and inline errors
- **U2.5** Use inline error text for form validation errors. **[1.00]**
- **U2.6** Use toast notifications for completion of non-destructive actions:
  - Export success or failure
  - Model refresh success or failure
  **[0.85]**

### 2.4 Keyboard baseline
- **U2.7** ESC closes dialogs and popovers. If closing would discard changes, prompt per rules in Section 11. **[0.85]**
- **U2.8** Enter activates focused primary button in dialogs. **[0.85]**

---

## 3. Councils List (Home: Councils tab)

### 3.1 Layout and content
- **U3.1** Councils list uses cards in a responsive grid. **[1.00]**
- **U3.2** Each card displays:
  - Title (single line, ellipsized)
  - Topic preview (max 2 lines)
  - Tags (0..3 chips)
  - Mode pill (Autopilot or Manual)
  - Archived indicator (icon + text "Archived")
  - Turn count (if available)
  - Invalid config badge when required (per functional spec)
  - Overflow menu button (`...`) in the card header
  **[1.00]**

### 3.2 Controls
- **U3.3** Controls at the top of the list:
  - Search input (Title, Topic substring match, case-insensitive)
  - Tag filter input (exact match, case-insensitive)
  - Archived filter (Active only, Archived only, All)
  - Sort control (Created asc/desc, Modified asc/desc)
  - Primary CTA: "New Council"
  - No "Refresh models" action in Councils list top controls
  **[1.00]**

### 3.3 Pagination and load more
- **U3.4** List uses constant page size with "Load more" when more results exist. **[1.00]**
- **U3.5** Applying search or filters resets to page 1. **[1.00]**
- **U3.6** While loading more, show card skeletons or a loading spinner below the grid. **[0.85]**

### 3.4 Card actions
- **U3.7** Each card opens Council View from the card surface itself; click/tap anywhere on the card except the overflow menu (`...`). Keyboard users can focus the card and press Enter/Space. **[1.00]**
- **U3.8** Overflow menu items:
  - Export
  - Archive or Restore (depending on state)
  - Delete
  **[1.00]**
- **U3.9** Export opens file dialog (filename + location) before writing. **[1.00]**
- **U3.10** Archive is disabled for a running Autopilot Council that is not paused (per functional spec). Tooltip explains. **[1.00]**

### 3.5 Empty state
- **U3.11** Empty list shows message and primary CTA "New Council". No secondary CTA. **[1.00]**

---

## 4. Agents List (Home: Agents tab)

### 4.1 Layout and content
- **U4.1** Agents list uses cards in a responsive grid. Each card displays:
  - Agent Name
  - Tags chips (0..3)
  - Model label (specific model, or "Global default" if null)
  - Invalid config badge when applicable
  - Overflow menu button (`...`) in the card header
  **[1.00]**

### 4.2 Controls
- **U4.2** Controls at the top:
  - Search input (Name + System Prompt substring match)
  - Tag filter input (exact match, case-insensitive)
  - Archived status filter (Active only, Archived only, All)
  - Sort (Created, Modified asc/desc)
  - Primary CTA: "New Agent"
  - No "Refresh models" action in Agents list top controls
  **[1.00]**

### 4.3 Pagination
- **U4.3** Page size and "Load more" match global list behavior. **[1.00]**

### 4.4 Empty state
- **U4.4** Empty state shows message + primary CTA "Create Agent". No templates. **[1.00]**

### 4.5 Archived behavior
- **U4.5** Archived Agents remain in the list with a visible Archived badge and are not visually dimmed into looking disabled or deleted. **[1.00]**
- **U4.6** Each Agent card opens Agent edit from the card surface itself; click/tap anywhere on the card except the overflow menu (`...`). Keyboard users can focus the card and press Enter/Space. The overflow menu is reserved for Archive/Restore and Delete actions. **[1.00]**

---

## 5. Settings (Home: Settings tab)

### 5.1 Layout
- **U5.1** Settings is a single page organized into collapsible groups:
  1) Providers
  2) General
  Providers is expanded by default; General is collapsed by default.
  **[1.00]**

### 5.2 Providers section
- **U5.2** Provider configurations are shown as cards for supported providers:
  - Gemini
  - Ollama (local)
  - OpenRouter
  **[1.00]**
- **U5.3** Each provider card contains:
  - Endpoint URL field where applicable (Ollama, OpenRouter if needed by implementation)
  - API key field where applicable (Gemini, OpenRouter)
  - Test connection button
  - Save button
  - Configured/not-configured badge
  - Inline status text only when the user has run a meaningful action (for example test/save outcome)
  **[1.00]**
- **U5.4** Save is disabled until the most recent test succeeds (per functional requirement). **[1.00]**
- **U5.5** For Ollama, API key field is hidden or disabled with note "Not required for local Ollama". **[1.00]**
- **U5.6** If OS keychain is unavailable and saving credentials fails, show blocking error message on the provider card. **[0.95]**

### 5.3 Global Default Model
- **U5.7** Global Default Model is selected via a model picker grouped by provider inside the `General` group. A compact icon refresh action is shown adjacent to that picker so the available model list can be refreshed in place. **[1.00]**
- **U5.8** If Global Default is unavailable in the current Model Catalog snapshot, show Invalid config badge and block Council start/resume where relevant. **[1.00]**

### 5.4 Refresh models
- **U5.9** Provide a model-refresh action in Settings adjacent to the Global Default Model picker. **[1.00]**
- **U5.10** Refresh updates model lists in the current Settings view without reload. **[0.90]**
- **U5.11** Show progress indicator while refreshing. On completion, show toast. Do not persist snapshot IDs or long-lived refresh-status text in the visible Settings layout. **[0.85]**
- **U5.12** When a provider already has saved configuration, changing its draft credentials/settings requires an explicit Disconnect action before the user can run a replacement connection test; the Settings card should explain this state clearly and keep draft inputs visible. **[0.95]**

---

## 6. Agent Create/Edit (Full-screen)

### 6.1 Form structure
- **U6.1** Agent create and edit share the same full-screen form layout. **[1.00]**
- **U6.2** Fields:
  - Name (required)
  - System Prompt (required, multiline)
  - Verbosity (optional)
  - Temperature (optional numeric)
  - Tags (0..3)
  - Model (nullable, grouped by provider)
  **[1.00]**

### 6.2 Save and Cancel
- **U6.3** Save and Cancel actions in the top bar or sticky footer. **[0.85]**
- **U6.4** Save is enabled only when:
  - Required fields are non-empty
  - Name is unique
  - Model configuration is valid for the current view Model Catalog snapshot
  **[1.00]**
- **U6.5** Cancel returns without saving. If form has unsaved changes, confirm discard. **[1.00]**

### 6.3 Invalid config presentation
- **U6.6** If selected model is unavailable, show "Invalid config" badge near the Model field and block Save. **[1.00]**

### 6.4 Delete agent
- **U6.7** Delete action is available from Agent edit view (not create). **[0.85]**
- **U6.8** If Agent is referenced by any Council, delete is blocked and a warning is shown instead of confirmation dialog. **[1.00]**
- **U6.9** Otherwise, delete requires confirmation dialog. **[1.00]**
- **U6.10** Agent create/edit shows the same compact icon "Refresh models" action adjacent to the Model selector so users can refresh that view's model options in place. **[0.90]**

### 6.5 Archived behavior
- **U6.11** Agent edit view exposes Archive/Restore action for existing Agents without a confirmation dialog. **[1.00]**
- **U6.12** When an Agent is archived, the form remains visible but read-only, and a clear archived message is shown. **[1.00]**
- **U6.13** Restoring an archived Agent re-enables editing immediately in the same view. **[1.00]**

---

## 7. Council Create (Full-screen)

### 7.1 Form structure
- **U7.1** Council create is full-screen form with:
  - Title (required)
  - Mode selection (Autopilot or Manual) required, cannot change after creation
  - Members (required at least 1)
  - Member colors palette selection per Member
  - Tags (0..3)
  - Topic (required at creation)
  - Goal (optional at creation; editable later in Config tab)
  Topic remains editable in Council View Config tab after creation. **[1.00]**

### 7.2 Save and Start
- **U7.2** Create does not auto-start. After saving, user lands in Council View empty state. **[1.00]**

---

## 8. Council View (Runtime) (Full-screen)

### 8.1 Layout
- **U8.1** Two-column layout:
  - Left: Chat transcript + composer area
  - Right: Fixed-width panel with tabs:
    - Tab 1: Briefing & Members
    - Tab 2: Config
  **[1.00]**

### 8.2 Top bar
- **U8.2** Top bar contains:
  - Back
  - Council Title (display, with pencil edit icon on hover)
  - Status strip: Mode, Paused, Archived, Turn count
  - Autopilot control (Pause or Resume) when in Autopilot
  - Export action
  - Optional overflow menu for Archive/Restore/Delete (if not placed in Config)
  **[0.85]**

### 8.3 Chat transcript
- **U8.3** Transcript is scrollable and shows full history. **[1.00]**
- **U8.4** Message rendering:
  - Members on left
  - Conductor on right, identical style to user message bubble
  - Avatar with initials
  - Color accents per sender color
  - Timestamp shown on hover
  **[1.00]**
- **U8.5** Messages cannot be edited or deleted. **[1.00]**

### 8.4 Thinking placeholder and cancel
- **U8.6** When generation is active, show a placeholder bubble at final message position with avatar + "..." in sender color. **[1.00]**
- **U8.7** Cancel appears adjacent to the active thinking placeholder. **[1.00]**
- **U8.8** Cancelling discards partial output and removes placeholder. **[1.00]**

### 8.5 Empty state and Start placement
- **U8.9** If no messages exist:
  - Chat area shows centered empty state panel.
  - In Autopilot: show Start button as primary CTA.
  - In Manual: show guidance text indicating selecting next speaker in Members panel.
  **[1.00]**
- **U8.10** After the first message exists, Start button is not shown in the empty-state panel. Autopilot is controlled via Pause/Resume and the state machine. **[1.00]**

### 8.6 Archived behavior
- **U8.11** When archived:
  - Composer disabled (still visible)
  - Members add/remove disabled
  - Config edits disabled
  - Export allowed
  **[1.00]**

---

## 9. Right Panel Tab 1: Briefing & Members

### 9.1 Briefing section
- **U9.1** Briefing is always visible when this tab is active. Shows:
  - TLDR (latest only)
  - Goal status indicator
  - If goal reached: prominent banner or callout within the section
  - Last updated timestamp
  **[1.00]**
- **U9.2** No highlight animation on update. **[1.00]**

### 9.2 Members section
- **U9.3** Members list shown below Briefing. **[1.00]**
- **U9.4** Member row includes:
  - Avatar initials
  - Name
  - Color chip (editable)
  - Remove button visible on hover
  **[1.00]**
- **U9.5** Ordering is creation order in the Council. **[1.00]**
- **U9.6** Remove:
  - If member has messages: remove is disabled, tooltip explains.
  - Otherwise: remove opens confirmation dialog.
  **[1.00]**
- **U9.7** Add Member opens a subpanel (within the right panel) that contains:
  - Search input over Agents
  - Results list with add buttons
  - Ability to assign color on add or after add via chip
  **[0.85]**

### 9.3 Manual mode speaker selection
- **U9.8** In Manual mode, selecting next speaker happens inside Members panel with an explicit per-row button labeled "Select to speak"; row click alone does not trigger speaker selection. No selection via transcript interactions. **[1.00]**

---

## 10. Right Panel Tab 2: Config

### 10.1 Contents
- **U10.1** Config tab contains:
  - Topic (editable)
  - Goal (editable)
  - Tags (editable)
  - Conductor model (editable, nullable)
  - Actions: Export, Archive/Restore, Delete
  **[1.00]**
- **U10.2** These fields are not duplicated elsewhere in Council View except Title in the top bar. **[1.00]**
- **U10.3** Member list is not repeated in Config. **[1.00]**

### 10.2 Inline editing mechanics in Config
- **U10.4** Editing is triggered only via pencil icon on hover, not by clicking text. **[1.00]**
- **U10.5** Inline editors expand to multiline in place. **[1.00]**
- **U10.6** Only one edit session can be active at a time. **[1.00]**
- **U10.7** Key behavior:
  - Enter saves
  - Shift+Enter inserts newline
  - ESC attempts to cancel and triggers discard confirmation if changed
  **[1.00]**
- **U10.8** Clicking outside while editing:
  - If no changes: exits edit mode
  - If changes: opens confirmation dialog:
    - "Discard changes?"
    - Primary: Discard
    - Secondary: Cancel (returns focus to editor)
  **[1.00]**
- **U10.9** When an edit is active, other pencils and editable controls are disabled. **[1.00]**

### 10.3 Tags editor behavior
- **U10.10** Tags are entered as free text, max 3, 1..20 chars each. **[1.00]**
- **U10.11** Tag editing UI:
  - Existing tags shown as chips with remove icons.
  - Add input allows typing then Enter to add.
  - No suggestions dropdown.
  **[1.00]**

### 10.4 Conductor model picker behavior
- **U10.12** Model picker groups models by provider and includes the same compact icon refresh action adjacent to the control. **[1.00]**
- **U10.13** Null selection is allowed and labeled "Global default". **[1.00]**
- **U10.14** If resolved Conductor model is unavailable in the current Model Catalog snapshot, show invalid config badge and block start/resume. **[1.00]**

---

## 11. Confirmations and Dialogs

### 11.1 Unsaved changes (forms)
- **U11.1** Leaving Agent create/edit with unsaved changes prompts:
  - Title: "Discard changes?"
  - Body: "Your changes will be lost."
  - Actions: Discard, Cancel
  **[1.00]**
- **U11.2** Leaving Council View while generation is active or Autopilot is running (not paused) prompts per functional spec:
  - "Leaving will pause the Council and cancel generation."
  - Confirm pauses and cancels, discards partial output, then navigates.
  - Cancel stays in Council View.
  **[1.00]**

### 11.2 Destructive actions
- **U11.3** Delete Council confirmation includes Council title in the dialog. **[1.00]**
- **U11.4** Archive/Restore does not require a confirmation dialog; actions execute immediately and remain consistent across list/editor/view flows. **[1.00]**

### 11.3 Member removal confirmation
- **U11.5** Removing a member requires confirmation:
  - "Remove member?"
  - Explains they can be re-added later if allowed
  - Actions: Remove, Cancel
  **[1.00]**

### 11.4 Export dialog
- **U11.6** Export always opens a dialog that collects:
  - Filename (default derived from Council title)
  - Location chooser
  - Confirm button: Export
  **[1.00]**
- **U11.7** Export failure shows error toast with reason if available. **[0.85]**

---

## 12. Autopilot UX

### 12.1 Start flow
- **U12.1** Autopilot Start from empty state opens a modal for optional max turns. **[1.00]**
- **U12.2** Modal contains:
  - Toggle: "Limit turns"
  - Numeric input: max turns (enabled when toggle on)
  - Start button
  - Cancel button
  **[0.85]**
  **Open:** minimum and maximum value constraints for max turns are not specified.

### 12.2 Running and paused
- **U12.3** When running, show Pause button in top bar. When paused, show Resume. **[1.00]**
- **U12.4** When conductor selects next speaker, the UI immediately shows the thinking placeholder bubble for that speaker. There is no separate "Next speaker" pre-state. **[1.00]**
- **U12.5** When paused, if the next speaker is known from the last Conductor result, the UI may show the cached next speaker indicator in members panel or status strip. **[0.85]**
  **Note:** You requested caching, but exact presentation is still flexible.

### 12.3 Errors
- **U12.6** On generation/provider error in Autopilot:
  - Show error inline near transcript or as toast
  - Council transitions to Paused
  - Resume retries
  **[1.00]**

---

## 13. Manual Mode UX

- **U13.1** Manual mode uses Members panel for selecting the next responding Member via explicit per-member action controls. **[1.00]**
- **U13.2** User can always type messages in the composer. These are treated as Conductor messages. **[1.00]**
- **U13.3** Conductor does not have a separate UI identity. **[1.00]**
- **U13.4** On generation/provider error:
  - Preserve state
  - User can retry selecting the same member or a different member
  **[1.00]**

---

## 14. Invalid Config UX

### 14.1 Lists
- **U14.1** Agents list: invalid config badge on row. **[1.00]**
- **U14.2** Councils list: invalid config badge on row when Conductor model invalid or default invalid. **[1.00]**

### 14.2 Council View
- **U14.3** If invalid config prevents start/resume:
  - Disable Start or Resume controls
  - Show invalid config badge near the control
  - Tooltip explains the model is unavailable in current Model Catalog snapshot
  **[1.00]**
- **U14.4** Viewing transcript and exporting remain allowed. **[1.00]**

### 14.3 Runtime failure recovery
- **U14.5** If a runtime call fails due to provider/model, the view refreshes model catalog and updates badges. UI should show a brief loading state. **[0.90]**

---

## 15. Accessibility and Usability

- **U15.1** All interactive controls have visible hover and focus states. **[0.95]**
- **U15.2** Keyboard navigation is supported for:
  - Tab switching on Home
  - List row focus and open
  - Dialog confirm and cancel
  - Inline edit save and cancel
  **[0.85]**
- **U15.3** Tooltips and badges have accessible labels. **[0.85]**
- **U15.4** Color chips are not the only indicator of identity; initials and names are always present. **[1.00]**

---

## 16. Open Items and Required Product Decisions

These are the remaining places where UX decisions conflict slightly with the functional requirements or lack numeric constraints.

- **U16.1** Resolved: Topic is required during Council creation and remains editable later in Council View Config. **[1.00]**
- **U16.2** Resolved: Manual speaker selection uses explicit per-member action buttons in Members panel (no row-click speaker trigger). **[1.00]**
- **U16.3** Turn limit modal numeric constraints (min, max, validation) unspecified. **[0.85]**
- **U16.4** Resolved: Archive/Restore uses no confirmation dialog, consistently across list/editor/view flows. **[1.00]**

---

## 17. Acceptance Checklist (High-level)

A build satisfies this UX spec if:
- Home uses tabs, not a sidebar, and Council View is full-screen with Back.
- Council View uses right panel tabs: Briefing & Members, Config.
- Config contains Topic, Goal, Tags, Conductor model, and actions.
- Inline editing is pencil-only, multiline, single active editor, Enter saves, Shift+Enter newline, click-out prompts discard confirmation.
- Member color is editable in Members list; remove is hover-only with confirmation; blocked removals show disabled button + tooltip.
- Thinking placeholder appears as the final message bubble; cancel is adjacent; no partial output persists.
- Invalid config is badge-only with tooltips and disables Start/Resume without a guided fix flow.
- Export opens file dialog from Council View top bar and Councils list overflow.
