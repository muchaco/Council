# Council - Requirements Document

## Overview

Council is a private, desktop-based command center that transforms solitary brainstorming into a high-level strategic summit by convening a team of autonomous AI agents to debate challenges. It functions as a self-regulating meeting room where users define problems and custom "Personas" discuss them under the guidance of an AI "Orchestrator."

---

## Requirements Legend

- **Status**: `Implemented` | `In Progress` | `Pending`
- **Importance**: `Critical` | `High` | `Medium` | `Low`
- **Complexity**: `Simple` | `Medium` | `Complex` | `Very Complex`

---

## 1. Session Management

### FR-1.1: Create New Session
**Description**: User must be able to create a new Session with a **Title**, **Main Problem Description** (the prompt), and a **Defined Output Goal** (e.g., "A bulleted list of ideas", "A Refactored Code Block").

- **Status**: ✅ Implemented
- **Importance**: Critical
- **Complexity**: Simple
- **Phase**: 1
- **Implementation Notes**: Session creation form exists at `/session/new` with all required fields

### FR-1.2: View Historical Sessions
**Description**: User must be able to view a list of historical sessions.

- **Status**: ✅ Implemented
- **Importance**: Critical
- **Complexity**: Simple
- **Phase**: 1
- **Implementation Notes**: Sessions list page at `/sessions` displays all sessions with metadata

### FR-1.3: Session Lifecycle Management
**Description**: User must be able to resume, pause, or delete past sessions.

- **Status**: ✅ Implemented
- **Importance**: High
- **Complexity**: Simple
- **Phase**: 1
- **Implementation Notes**: Delete with confirmation dialog implemented; resume via session ID

### FR-1.4: Session State Persistence
**Description**: The Session State must persist locally (SQLite), preserving the chat history, current "Blackboard" state, and token usage statistics.

- **Status**: ✅ Implemented
- **Importance**: Critical
- **Complexity**: Medium
- **Phase**: 1
- **Implementation Notes**: SQLite database with sessions, messages, and metadata tables; full persistence across app restarts

### FR-1.5: Session Archiving/Close
**Description**: User must be able to close/archive a session, marking it as completed. Archived sessions are read-only and excluded from active operations.

- **Status**: ✅ Implemented
- **Importance**: High
- **Complexity**: Simple
- **Phase**: 2 (Priority 10)
- **Implementation Notes**: 
  - Added `archived_at` timestamp field to sessions table (migration V5)
  - Archive/Unarchive buttons in session view header and sessions list dropdown
  - Archived sessions show "Archived" badge and archive date
  - Message input disabled for archived sessions with informative message
  - Orchestrator controls disabled when session is archived
  - Export functionality remains available for archived sessions
  - Confirmation dialog shown before archiving to prevent accidental archival

### FR-1.6: Session Tags
**Description**: User must be able to assign free-text tags to sessions for organization and filtering.

- **Status**: ⏳ Pending
- **Importance**: Medium
- **Complexity**: Simple
- **Phase**: 2 (Priority 5)
- **Implementation Notes**: Separate `session_tags` table with many-to-many relationship; tag input in session creation/edit; display tags in session list

### FR-1.7: Session List Filtering
**Description**: The sessions list page must support filtering by:
- Tags (multi-select)
- Personas (sessions containing specific persona)
- Status (active/archived)
- Search by title

- **Status**: ⏳ Pending
- **Importance**: Medium
- **Complexity**: Medium
- **Phase**: 2 (Priority 6)
- **Implementation Notes**: Filter UI in `/sessions` page; composite queries for tag and persona filters

### FR-1.8: Export to Markdown
**Description**: User must be able to export any session (active or archived) as a Markdown file containing:
- Session metadata (title, creation date, tags)
- Problem description and output goal
- Full conversation history with speaker names and timestamps
  - Persona messages: labeled with persona name
  - User messages: labeled as "User"
  - Orchestrator messages (FR-2.3): labeled as "Orchestrator"
- Final blackboard state

- **Status**: ✅ Implemented
- **Importance**: High
- **Complexity**: Simple
- **Phase**: 2 (Priority 1)
- **Implementation Notes**: Export button in session view and sessions list; generates `.md` file with YAML frontmatter containing session metadata, problem description, output goal, session summary, blackboard state, and full conversation history with speaker names and timestamps; handles deleted personas as "Participant N"; save via Electron dialog; uses `metadata.isOrchestratorMessage` field to distinguish user vs orchestrator messages

---

## 2. Persona System

### FR-2.1: Create Reusable Personas
**Description**: User must be able to create reusable Personas with the following attributes:
- Name & Color
- System Prompt (Behavior/Role)
- Model Config (Temperature, Gemini Model)
- Hidden Agenda/Bias (Optional private instructions)
- Verbosity Setting (1-10 scale or string instruction)

- **Status**: ⚠️ Partial
- **Importance**: Critical
- **Complexity**: Medium
- **Phase**: 1
- **Implementation Notes**: Full CRUD at `/personas` with all fields including model selector (populated from active provider), temperature slider (0.0-2.0), color picker with solid colors, and hidden agenda field. Model selector shows only models from the currently active provider (see FR-5.1). **Verbosity field pending.**

### FR-2.1a: Persona Verbosity Setting
**Description**: Each persona must have a verbosity setting that controls response length. Can be either:
- Numeric scale (1-10, where 1 is brief and 10 is verbose)
- Free text instruction (e.g., "Always answer in 2-3 sentences")

The verbosity instruction is appended to the system prompt.

- **Status**: ✅ Implemented
- **Importance**: High
- **Complexity**: Simple
- **Phase**: 2 (Priority 2)
- **Implementation Notes**: Verbosity field added to personas table (migration V4), UI input in persona form, appended to LLM system prompts via enhancedSystemPrompt. Supports both numeric (1-10) and free text instructions.

### FR-2.2: Temporary Personas
**Description**: User must be able to create **Temporary Personas** inside a session setup that are not saved to the global library (with option to promote to global).

- **Status**: ⏳ Pending
- **Importance**: Medium
- **Complexity**: Medium
- **Phase**: 2
- **Implementation Notes**: Not yet implemented; requires session-scoped persona creation

### FR-2.3: Orchestrator Algorithm (REFACTORED)
**Description**: The Orchestrator is an **algorithmic component** (not a persona) that manages session flow. It uses the default LLM configured in settings. The Orchestrator performs:

1. **Next Speaker Selection**: Intelligently chooses which persona should speak next based on conversation context. Optimization: If only one valid speaker exists, skip LLM call and select directly.
2. **Blackboard Summarization**: Maintains and updates the shared state (consensus, conflicts, next steps) after each turn.
3. **Session Completion Detection**: Determines if the output goal has been reached and signals session completion.
4. **Topic Drift Detection**: Monitors if conversation deviates from the main problem (optional LLM call).
5. **Conversation Guidance**: Can send messages into the conversation to steer the discussion toward the output goal when the Orchestrator determines intervention is needed.

**User-Orchestrator Identity**: 
- User messages and Orchestrator-initiated messages share the same identity in the conversation
- Both appear as right-aligned messages (user perspective) with standard user message styling
- **Visual indicators**:
  - User-written messages: Show a `User` icon (e.g., `<User className="w-3 h-3" />`)
  - Orchestrator-auto messages: Show a `Sparkles` or `Bot` icon to indicate automatic generation
- No special color coding - both use standard user message appearance

**User as Conductor Mode**: User can take manual control, in which case the Orchestrator only:
- Prompts user for next speaker selection
- Signals session completion when user indicates
- Does NOT auto-generate guidance messages (only user can write)

- **Status**: ⏳ Pending (Refactor Required)
- **Importance**: Critical
- **Complexity**: Complex
- **Phase**: 2 (Priority 8)
- **Implementation Notes**: Remove `is_orchestrator` from session_personas; create orchestrator service using default model from settings; refactor orchestration prompts to be system-level rather than persona-based; add "User as Conductor" toggle in session settings; add `source` field to messages table ('user' | 'orchestrator'); update message bubble component to show appropriate icon based on source

### FR-2.3a: Persona Deletion Safety
**Description**: Persona removal must be blocked if the persona is participating in any **active** session. For **archived** sessions with deleted personas:
- Display "Unknown" or generic placeholder in persona cards
- Replace persona name in chat with "Participant N" (N = sequential number in conversation)
- Preserve message content for historical reference

- **Status**: ⏳ Pending
- **Importance**: High
- **Complexity**: Medium
- **Phase**: 2 (Priority 11)
- **Implementation Notes**: Check active session participation before DELETE; handle NULL persona_id in archived session views

### FR-2.4: The Hush Button
**Description**: User must be able to temporarily mute a Persona (e.g., "Sleep for 5 turns" or "Quiet until addressed") without removing them.

- **Status**: ⏳ Pending
- **Importance**: Medium
- **Complexity**: Simple
- **Phase**: 4
- **Implementation Notes**: Requires mute status tracking and turn-count logic

### FR-2.5: The Whisper
**Description**: User must be able to send a private system instruction to a single Persona during a live session (e.g., "Be more aggressive about the budget").

- **Status**: ⏳ Pending
- **Importance**: Medium
- **Complexity**: Medium
- **Phase**: 4
- **Implementation Notes**: Requires private message injection into persona context

---

## 3. Orchestration Engine

### FR-3.1: Smart Turn-Taking
**Description**: The system must avoid fixed round-robin order. After a message, the System Agent analyzes context to select the *next best speaker* (or chooses to wait for User input).

- **Status**: ✅ Implemented
- **Importance**: Critical
- **Complexity**: Very Complex
- **Phase**: 2
- **Implementation Notes**: Orchestrator AI analyzes conversation context and selects next speaker dynamically; not sequential. **Note:** Current implementation uses persona-based orchestrator; behavior will change with FR-2.3 (Orchestrator Algorithm refactor)



### FR-3.3: Shared Blackboard
**Description**: The UI displays a "State" panel (read-only for User, write-access for System) containing:
- Current Consensus
- Active Conflicts
- Next Immediate Step

- **Status**: ✅ Implemented
- **Importance**: Critical
- **Complexity**: Complex
- **Phase**: 2
- **Implementation Notes**: Right panel displays blackboard state with consensus, conflicts, and next steps; updated by orchestrator

### FR-3.4: Rolling Context
**Description**: To manage tokens, the system summarizes older messages and feeds agents a condensed history + the "Blackboard" state, rather than the full raw log.

- **Status**: ⏳ Pending
- **Importance**: High
- **Complexity**: Complex
- **Phase**: 3
- **Implementation Notes**: Currently sends last 10 messages; needs summarization logic for older context

---

## 4. Knowledge & RAG (Retrieval-Augmented Generation)

### FR-4.1: Global Attachments
**Description**: User can upload files (PDF/TXT/MD) to the Session. All Personas have read access to this context.

- **Status**: ⏳ Pending
- **Importance**: Medium
- **Complexity**: Complex
- **Phase**: 3
- **Implementation Notes**: Requires file upload UI, text extraction, and context injection

### FR-4.2: Local Attachments
**Description**: User can upload files to a *specific* Persona. Only that Persona generates embeddings/context from this data (simulating information asymmetry).

- **Status**: ⏳ Pending
- **Importance**: Low
- **Complexity**: Very Complex
- **Phase**: 3
- **Implementation Notes**: Requires persona-scoped document storage and retrieval

### FR-4.3: Text Extraction & Embeddings
**Description**: System supports basic text extraction and embedding (local vector store) for attached files.

- **Status**: ⏳ Pending
- **Importance**: Medium
- **Complexity**: Very Complex
- **Phase**: 3
- **Implementation Notes**: Requires vector database integration (e.g., LanceDB)

---

## 5. LLM Integration

### FR-5.1: LLM Provider Selection
**Description**: User can select **one active LLM provider** from predefined supported providers. The system supports:
- **Google Gemini** (via official SDK)
- **OpenRouter** (unified API for multiple models)
- **Ollama** (local inference server)

**Active Provider Configuration**:
- Only ONE provider can be active at a time
- Provider-specific configuration (API key, endpoint where applicable)
- Connection test for the selected provider
- Available models fetched dynamically from the active provider

**Settings UI**:
- Provider selector dropdown (single selection)
- Provider-specific configuration form (shown based on selection)
- Connection test button
- Model list auto-populates from active provider

**Model Selection Behavior**:
- All model selectors throughout the app (persona creation, orchestrator settings, etc.) display only models from the currently active provider
- Changing the active provider updates available models in all selectors
- Previously selected models that don't exist in the new provider fall back to the provider's default

- **Status**: ⏳ Pending
- **Importance**: High
- **Complexity**: Complex
- **Phase**: 2 (Priority 9)
- **Implementation Notes**: Create LLM provider abstraction layer; implement adapter pattern for each provider; single active provider state in settings; all model selectors query the active provider's model list

### FR-5.2: Model Assignment per Persona
**Description**: User can assign different models from the active provider to different Personas within the same session. Each persona's model selector displays only the available models from the currently active LLM provider.

- **Status**: ⏳ Pending
- **Importance**: High
- **Complexity**: Medium
- **Phase**: 2 (Priority 9)
- **Implementation Notes**: Persona model field stores model ID; model selector queries active provider's available models; selector updates when active provider changes

---

## 6. UI/UX Elements

### FR-6.1: Cost/Token Ticker
**Description**: Real-time display of estimated cost (API) or Token Count (Local).

- **Status**: ✅ Implemented
- **Importance**: High
- **Complexity**: Simple
- **Phase**: 1
- **Implementation Notes**: Info panel shows token count and cost estimate; tracked per session

### FR-6.2: Visual Separation
**Description**: Persona avatars are clearly color-coded by Persona color.

- **Status**: ✅ Implemented
- **Importance**: High
- **Complexity**: Simple
- **Phase**: 1
- **Implementation Notes**: Solid colors used (no gradients); each persona has assigned color displayed as avatar background; **Note:** Message bubbles currently use neutral styling (bg-card), accent colors will be added in FR-6.5

### FR-6.3: Async Rendering
**Description**: If the Orchestrator queues multiple agents, they render sequentially in the UI to prevent reading chaos.

- **Status**: ✅ Implemented
- **Importance**: Medium
- **Complexity**: Medium
- **Phase**: 2
- **Implementation Notes**: Sequential response rendering with thinking indicators

### FR-6.4: Input Field LLM Enhancement
**Description**: All text input fields (except Name fields) must display a sparkly star icon/button that opens a popover menu with two actions:

1. **"Enhance Field Value"**: Sends current value to LLM with field-type-specific prompt requesting improvements (clarity, completeness, professionalism, etc.)
2. **"Generate Based on Value"**: Sends current value to LLM with field-type-specific prompt requesting expanded/generated content based on the input

**Field Types & Prompts**:
Each field type has tailored prompts for both actions (e.g., system prompts get different enhancement than problem descriptions).

**UX Flow**:
- User clicks star icon → Popover appears with two options
- Selected action triggers LLM call with field value
- Returned value replaces field content
- **Revert button** appears to restore previous value
- Loading state during LLM call

- **Status**: ⏳ Pending
- **Importance**: High
- **Complexity**: Complex
- **Phase**: 2 (Priority 7)
- **Implementation Notes**: Create reusable `EnhancedInput` component; define prompt templates per field type; integrate with LLM service; manage original value state for revert functionality

### FR-6.5: Message Bubble Color Accents
**Description**: Message bubbles must display a subtle accent color derived programmatically from the persona's assigned color. Currently, message bubbles use neutral `bg-card` styling (FR-6.2). This requirement adds a subtle accent to persona message bubbles (e.g., left border, subtle background tint) while maintaining readability.

**Requirements**:
- Calculate accent color programmatically from base persona color (no hardcoded mappings)
- Use color manipulation (lighten/darken, adjust opacity) to create complementary accent
- Consistent accent style across all persona colors
- Handle edge cases (very light/dark colors)
- Only applies to persona messages (not user/orchestrator messages which remain neutral)

- **Status**: ✅ Implemented
- **Importance**: Medium
- **Complexity**: Simple
- **Phase**: 2 (Priority 3)
- **Implementation Notes**: 
  - Color utilities created in `lib/colors.ts` with HSL manipulation and contrast calculation
  - `MessageBubble` component created at `components/chat/MessageBubble.tsx` with accent support
  - Persona messages display 3px left border in persona color (RGB format)
  - Persona messages display 8% opacity background tint of persona color
  - Edge cases handled: very light colors blended toward gray, very dark colors handled correctly
  - User/orchestrator/intervention messages remain neutral (no accent)
  - Comprehensive test suite: 91 tests passing (57 color utilities + 34 component tests)

### FR-6.6: Improved Color Picker
**Description**: The persona color picker must be redesigned with:
- Smaller color swatches (not large squares)
- Expanded color palette (more options)
- Organized in a grid layout
- Optional: Custom color input for precise selection
- Better visual hierarchy

- **Status**: ⏳ Pending
- **Importance**: Low
- **Complexity**: Simple
- **Phase**: 2 (Priority 4)
- **Implementation Notes**: Redesign ColorPicker component with compact grid layout; expand color palette array; optionally add hex input for custom colors

### FR-6.7: Application Icon
**Description**: The Electron application must have a distinctive, professional icon displayed in:
- OS taskbar/dock
- Window title bar
- Application menu
- OS file associations (if applicable)

**Requirements**:
- Provide multiple sizes (16x16, 32x32, 48x48, 128x128, 256x256, 512x512)
- Support for Windows (.ico), macOS (.icns), and Linux (.png)
- Icon should reflect "Council" theme (collaboration, discussion, wisdom)

- **Status**: ⏳ Pending
- **Importance**: Low
- **Complexity**: Simple
- **Phase**: 2 (Priority 12)
- **Implementation Notes**: Create icon assets in required formats; configure Electron builder with icon paths; test on all target platforms

---

## 7. Non-Functional Requirements

### NFR-1: Performance
**Description**: UI must remain responsive (non-blocking) during LLM inference.

- **Status**: ✅ Implemented
- **Importance**: Critical
- **Complexity**: Medium
- **Phase**: 1
- **Implementation Notes**: Async IPC calls with loading states; "thinking..." indicator shown during inference

### NFR-2: Privacy
**Description**: All data (chats, personas, keys) stored locally. No external telemetry or syncing.

- **Status**: ✅ Implemented
- **Importance**: Critical
- **Complexity**: Simple
- **Phase**: 1
- **Implementation Notes**: SQLite local database, encrypted API key storage, no network calls except to Gemini API

### NFR-3: Provider Abstraction
**Description**: All LLM interactions must be provider-agnostic through a dependency injection pattern. The codebase should not contain provider-specific logic scattered throughout components or services.

**Architecture Requirements**:
- **Provider Interface**: Define a common interface that all LLM providers implement
- **Dependency Injection**: Services/components receive the LLM client through injection, not hardcoded instantiation
- **No Provider-Specific Logic**: No conditional checks for "if gemini then..." or "if ollama then..." outside the provider adapters
- **Single Import Rule**: Components import only from the abstraction layer, never directly from provider SDKs

**Implementation Pattern**:
```
Components/Services → LLM Service (abstraction) → Provider Adapter → Provider SDK
```

- **Status**: ⚠️ Partial
- **Importance**: High
- **Complexity**: Complex
- **Phase**: 1
- **Implementation Notes**: Create `LLMProvider` interface with methods like `generate()`, `getModels()`, `validateConfig()`; implement adapter classes for each provider (GeminiAdapter, OpenRouterAdapter, OllamaAdapter); LLM service factory returns the appropriate adapter based on active provider setting; all components use the LLM service abstraction only

### NFR-4: Safety/Cost Control
**Description**: The app must have a "Circuit Breaker" to prevent infinite loops (e.g., max 10 auto-replies before forcing a User confirm).

- **Status**: ⏳ Pending
- **Importance**: High
- **Complexity**: Simple
- **Phase**: 2
- **Implementation Notes**: Requires turn counter and auto-stop mechanism

---

## 8. Out of Scope (Future Considerations)

### OOS-1: Branching/Forking Conversations
**Description**: Ability to branch or fork conversation threads for exploring different paths.

- **Status**: Out of Scope
- **Importance**: Low
- **Complexity**: Very Complex
- **Phase**: Future
- **Notes**: Complexity too high for current versions

### OOS-2: Merging Separate Sessions
**Description**: Combine or merge two different sessions into one.

- **Status**: Out of Scope
- **Importance**: Low
- **Complexity**: Complex
- **Phase**: Future

### OOS-3: Voice Input/Output
**Description**: Support for voice commands and audio responses.

- **Status**: Out of Scope
- **Importance**: Low
- **Complexity**: Complex
- **Phase**: Future

### OOS-4: Multi-User Collaboration
**Description**: Real-time collaboration with other human users.

- **Status**: Out of Scope
- **Importance**: Low
- **Complexity**: Very Complex
- **Phase**: Future

### OOS-5: Complex File Types
**Description**: Support for non-text formats like Images, Excel with macros.

- **Status**: Out of Scope
- **Importance**: Low
- **Complexity**: Complex
- **Phase**: Future
- **Notes**: Text-based formats only for now

---

## Implementation Status Summary

| Phase | Name | Progress | Key Deliverables |
|-------|------|----------|------------------|
| Phase 1 | The Core Loop | ✅ 100% | Electron app, Personas CRUD, Sessions, Chat UI, Sequential turn-taking, Settings, Encryption |
| Phase 2 | The Conductor | 🔄 In Progress | Session archiving ✅, Message bubble color accents ✅, Export to Markdown ✅, Session tags, Multi-provider LLM, Input enhancement, UI polish |
| Phase 3 | The Context | 0% | File attachments, RAG, Vector store, Rolling Context |
| Phase 4 | Polish & Controls | 0% | Hush button, Whisper, Cost counters, Circuit breaker |

---

## Statistics

- **Total Requirements**: 34
- **Implemented**: 19 (56%)
- **In Progress**: 0 (0%)
- **Pending**: 15 (44%)
- **Out of Scope**: 5 (15%)
- **Partial**: 2 (6%)
- **Critical Priority**: 10
- **High Priority**: 11
- **Medium Priority**: 10
- **Low Priority**: 3

---

**Last Updated**: 2026-02-07  
**Document Version**: 2.1
