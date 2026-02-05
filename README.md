# Council

Council is a private, desktop-based command center that transforms solitary brainstorming into a high-level strategic summit by convening a team of autonomous AI agents to debate your challenges. Rather than a simple chat, it functions as a self-regulating meeting room: you define the problem, and a cast of custom "Personas"—equipped with distinct personalities, specific LLM models, and private document knowledge—discuss it, while an AI "Orchestrator" directs the flow, managing turn-taking and maintaining a live "Blackboard" of consensus to prevent circular arguments. It is a tool for rapid ideation and rigorous critique, allowing you to step back and watch a simulated expert panel dismantle and reconstruct your ideas until a definitive solution is reached.

This PRD outlines the "Council" app, a desktop-based brainstorming tool where a user interacts with AI agents ("Personas") guided by an "Orchestrator."

### **Product Requirement Document (PRD)**

**Project Name:** "Council" (Working Title)
**Target Platform:** Desktop (Electron)
**User:** Single User (Self-Hosted/Local)

---

### **1. Product Vision**

To create a "Council of AI"—a personal, desktop-based brainstorming tool where the user interacts with multiple AI agents (Personas). These agents debate, critique, and iterate on problems under the guidance of an LLM-based Orchestrator. The goal is to facilitate higher-quality decisions, creative idea generation, and overcoming "writer's block" through simulated multi-perspective debate.

---

### **2. Functional Requirements (FR)**

#### **2.1. Session Management**

* **FR-1.1:** User must be able to create a new Session with a **Title**, **Main Problem Description** (the prompt), and a **Defined Output Goal** (e.g., "A bulleted list of ideas", "A Refactored Code Block").
* **FR-1.2:** User must be able to view a list of historical sessions.
* **FR-1.3:** User must be able to resume, pause, or delete past sessions.
* **FR-1.4:** The Session State must persist locally (JSON/SQLite), preserving the chat history, current "Blackboard" state, and token usage statistics.

#### **2.2. Persona System**

* **FR-2.1:** User must be able to create reusable Personas with the following attributes:
* *Name & Avatar/Color*
* *System Prompt* (Behavior/Role)
* *Model Config* (Temperature, Model ID e.g., `gpt-4o` vs `llama-3-local`)
* *Hidden Agenda/Bias* (Optional private instructions)


* **FR-2.2:** User must be able to create **Temporary Personas** inside a session setup that are not saved to the global library (with option to promote to global).
* **FR-2.3:** User must be able to toggle a Persona as the **"Orchestrator"**. This injects moderation logic into their specific voice/prompt.
* **FR-2.4:** **The Hush Button:** User must be able to temporarily mute a Persona (e.g., "Sleep for 5 turns" or "Quiet until addressed") without removing them.
* **FR-2.5:** **The Whisper:** User must be able to send a private system instruction to a single Persona during a live session (e.g., "Be more aggressive about the budget").

#### **2.3. The Orchestration Engine (The Logic)**

* **FR-3.1:** **Smart Turn-Taking:** The system must avoid fixed round-robin order. After a message, the System Agent analyzes context to select the *next best speaker* (or chooses to wait for User input).
* **FR-3.2:** **Topic Drift Detection:** The System Agent monitors if the conversation deviates from the Main Problem and triggers a "Steering Event" (Orchestrator intervention) if necessary.
* **FR-3.3:** **Shared Blackboard:** The UI displays a "State" panel (read-only for User, write-access for System) containing:
* *Current Consensus*
* *Active Conflicts*
* *Next Immediate Step*


* **FR-3.4:** **Rolling Context:** To manage tokens, the system summarizes older messages and feeds agents a condensed history + the "Blackboard" state, rather than the full raw log.

#### **2.4. Knowledge & RAG (Retrieval-Augmented Generation)**

* **FR-4.1:** **Global Attachments:** User can upload files (PDF/TXT/MD) to the Session. All Personas have read access to this context.
* **FR-4.2:** **Local Attachments:** User can upload files to a *specific* Persona. Only that Persona generates embeddings/context from this data (simulating information asymmetry).
* **FR-4.3:** System supports basic text extraction and embedding (local vector store) for these files.

#### **2.5. LLM Integration**

* **FR-5.1:** Support for OpenAI API (via OpenRouter or direct).
* **FR-5.2:** Support for local inference servers (Ollama/LM Studio) via generic API endpoints.
* **FR-5.3:** Granular Model Assignment: User can assign different models to different Personas within the same session.

#### **2.6. UI/UX Elements**

* **FR-6.1:** **Cost/Token Ticker:** Real-time display of estimated cost (API) or Token Count (Local).
* **FR-6.2:** **Visual Separation:** Chat bubbles are clearly color-coded by Persona.
* **FR-6.3:** **Async Rendering:** If the Orchestrator queues multiple agents, they render sequentially in the UI to prevent reading chaos.

---

### **3. Non-Functional Requirements (NFR)**

* **NFR-1 (Performance):** UI must remain responsive (non-blocking) during LLM inference.
* **NFR-2 (Privacy):** All data (chats, personas, keys) stored locally. No external telemetry or syncing.
* **NFR-3 (Extensibility):** Architecture allows swapping LLM provider interfaces without rewriting core logic.
* **NFR-4 (Safety/Cost Control):** The app must have a "Circuit Breaker" to prevent infinite loops (e.g., max 10 auto-replies before forcing a User confirm).

---

### **4. Out of Scope (For MVP)**

* **OOS-1:** "Branching/Forking" conversations (Complexity too high for V1).
* **OOS-2:** Merging separate sessions.
* **OOS-3:** Voice Input/Output.
* **OOS-4:** Multi-user collaboration (Real-time socket connection with other humans).
* **OOS-5:** Complex file types (Images, Excel with macros). Text-based formats only.

---

### **5. Phasing Plan**

#### **Phase 1: The Core Loop (Proof of Concept)**

* Basic Electron Shell setup.
* Settings page for API Keys (OpenRouter/Ollama).
* Creation of "Personas" (Simple JSON storage).
* Simple Chat Interface (User + 2 Agents).
* **Logic:** Simple Sequential turn-taking (User -> A -> B -> User).
* *Goal: Verify LLM connectivity and basic state management.*

#### **Phase 2: The Conductor (The "Brain")**

* Implement "Orchestrator" System Prompt logic.
* Implement "Smart Turn-Taking" algorithm (Selector Agent).
* Implement the "Shared Blackboard" (State summarization).
* *Goal: Verify the debate can self-regulate without constant user input.*

#### **Phase 3: The Context (RAG & Attachments)**

* File upload UI (Global vs Persona).
* Implement local vector store (e.g., `lancedb` or `langchain/vectorstores/memory`).
* Implement "Rolling Context" logic.
* *Goal: Verify agents can read and utilize documents.*

#### **Phase 4: Polish & Controls**

* Add "Hush" and "Whisper" features.
* Add Cost/Token counters.
* UI Polish (Colors, Animations, Markdown rendering).
* *Goal: Make it usable and enjoyable for daily work.*

---

### **6. Technical Stack Recommendations**

* **Frontend:** React (Component-based architecture essential for chat).
* **State Management:** async state manager to handle the complex asynchronous nature of multiple agents thinking.
* **LLM Interface:** Vercel AI SDK (Standardizes calls between Ollama/OpenAI).
* **Database:** `electron-store` (for settings) + Local JSON/SQLite (for chat logs).
