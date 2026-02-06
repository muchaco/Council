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

---

## 2. Persona System

### FR-2.1: Create Reusable Personas
**Description**: User must be able to create reusable Personas with the following attributes:
- Name & Color
- System Prompt (Behavior/Role)
- Model Config (Temperature, Gemini Model)
- Hidden Agenda/Bias (Optional private instructions)

- **Status**: ✅ Implemented
- **Importance**: Critical
- **Complexity**: Medium
- **Phase**: 1
- **Implementation Notes**: Full CRUD at `/personas` with all fields including Gemini model selector (Flash/Pro), temperature slider (0.0-2.0), color picker with solid colors, and hidden agenda field

### FR-2.2: Temporary Personas
**Description**: User must be able to create **Temporary Personas** inside a session setup that are not saved to the global library (with option to promote to global).

- **Status**: ⏳ Pending
- **Importance**: Medium
- **Complexity**: Medium
- **Phase**: 2
- **Implementation Notes**: Not yet implemented; requires session-scoped persona creation

### FR-2.3: Orchestrator Toggle
**Description**: User must be able to toggle a Persona as the **"Orchestrator"**. This injects moderation logic into their specific voice/prompt.

- **Status**: ✅ Implemented
- **Importance**: Critical
- **Complexity**: Medium
- **Phase**: 2
- **Implementation Notes**: `is_orchestrator` boolean field in session_personas table; orchestrator logic integrated

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
- **Implementation Notes**: Orchestrator AI analyzes conversation context and selects next speaker dynamically; not sequential

### FR-3.2: Topic Drift Detection
**Description**: The System Agent monitors if the conversation deviates from the Main Problem and triggers a "Steering Event" (Orchestrator intervention) if necessary.

- **Status**: ⏳ Pending
- **Importance**: High
- **Complexity**: Complex
- **Phase**: 2
- **Implementation Notes**: Requires semantic analysis of conversation vs. problem description

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

### FR-5.1: OpenAI API Support
**Description**: Support for OpenAI API (via OpenRouter or direct).

- **Status**: ⏳ Pending
- **Importance**: Medium
- **Complexity**: Medium
- **Phase**: Future
- **Implementation Notes**: Currently only Gemini supported; needs provider abstraction layer

### FR-5.2: Local Inference Support
**Description**: Support for local inference servers (Ollama/LM Studio) via generic API endpoints.

- **Status**: ⏳ Pending
- **Importance**: Low
- **Complexity**: Medium
- **Phase**: Future
- **Implementation Notes**: Requires configurable API endpoints and model parameters

### FR-5.3: Granular Model Assignment
**Description**: User can assign different models to different Personas within the same session.

- **Status**: ✅ Implemented
- **Importance**: High
- **Complexity**: Medium
- **Phase**: 1
- **Implementation Notes**: Each persona can have Flash or Pro model assigned; stored in database

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
**Description**: Chat bubbles are clearly color-coded by Persona.

- **Status**: ✅ Implemented
- **Importance**: High
- **Complexity**: Simple
- **Phase**: 1
- **Implementation Notes**: Solid colors used (no gradients); each persona has assigned color displayed in messages

### FR-6.3: Async Rendering
**Description**: If the Orchestrator queues multiple agents, they render sequentially in the UI to prevent reading chaos.

- **Status**: ✅ Implemented
- **Importance**: Medium
- **Complexity**: Medium
- **Phase**: 2
- **Implementation Notes**: Sequential response rendering with thinking indicators

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

### NFR-3: Extensibility
**Description**: Architecture allows swapping LLM provider interfaces without rewriting core logic.

- **Status**: ⚠️ Partial
- **Importance**: High
- **Complexity**: Complex
- **Phase**: 1
- **Implementation Notes**: LLM types/interfaces exist but provider abstraction needs completion for multi-provider support

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
| Phase 2 | The Conductor | ✅ 100% | Orchestrator AI, Smart Turn-Taking, Shared Blackboard, Async Rendering |
| Phase 3 | The Context | 0% | File attachments, RAG, Vector store, Rolling Context |
| Phase 4 | Polish & Controls | 0% | Hush button, Whisper, Cost counters, Circuit breaker |

---

## Statistics

- **Total Requirements**: 24
- **Implemented**: 16 (67%)
- **In Progress**: 0 (0%)
- **Pending**: 7 (29%)
- **Out of Scope**: 5 (21%)
- **Critical Priority**: 9
- **High Priority**: 6
- **Medium Priority**: 7
- **Low Priority**: 2

---

**Last Updated**: 2026-02-05  
**Document Version**: 1.0
