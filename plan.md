# Council - Implementation Roadmap

## Overview

Council is a desktop-based AI brainstorming tool with multi-agent debate capabilities. This document tracks the implementation roadmap and remaining work.

**Current Status**: Phases 1 & 2 Complete (Core Loop + Orchestrator)

For detailed requirements, see [requirements.md](./requirements.md).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ELECTRON APP                            │
│  ┌─────────────┐    IPC    ┌──────────────┐    HTTP    ┌─────┐  │
│  │   Renderer  │◄─────────►│ Main Process │◄──────────►│Gemini│ │
│  │ (Vite SPA)  │           │              │            │ API │  │
│  │             │           │ - API calls  │            └─────┘  │
│  │ - Zustand   │           │ - Encryption │                     │
│  │ - UI        │           │ - IPC handlers                   │  │
│  └─────────────┘           └──────┬───────┘                     │
│         │                         │                              │
│         │                    ┌────┴────┐                        │
│         │                    │ SQLite  │                        │
│         └────────────────────►  (Pure  │                        │
│                              │   JS)   │                        │
│                              └─────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Component | Package | Purpose |
|-----------|---------|---------|
| Desktop Framework | `electron` + `@electron-forge` | Cross-platform desktop shell |
| Frontend | `vite` + `react-router-dom` | SPA renderer |
| State Management | `zustand` | Global state management |
| Database | `sqlite3` (pure JS) | Local data persistence |
| Settings | `electron-store` | Encrypted configuration |
| LLM SDK | `@google/generative-ai` | Gemini API integration |
| UI Components | `@radix-ui/*` | Headless UI primitives |
| Styling | `tailwindcss` | Utility-first CSS |
| Icons | `lucide-react` | Icon library |
| Notifications | `sonner` | Toast notifications |

---

## Database Schema

### personas
```sql
CREATE TABLE personas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  gemini_model TEXT NOT NULL DEFAULT 'gemini-1.5-flash',
  temperature REAL NOT NULL DEFAULT 0.7,
  color TEXT NOT NULL,
  hidden_agenda TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### sessions
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  problem_description TEXT NOT NULL,
  output_goal TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  token_count INTEGER DEFAULT 0,
  cost_estimate REAL DEFAULT 0.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### session_personas
```sql
CREATE TABLE session_personas (
  session_id TEXT NOT NULL,
  persona_id TEXT NOT NULL,
  is_orchestrator BOOLEAN DEFAULT 0,
  PRIMARY KEY (session_id, persona_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
);
```

### messages
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  persona_id TEXT, -- NULL for user messages
  content TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  token_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE SET NULL
);
```

---

## Color Palette

All UI uses solid colors (no gradients):

| Name | Hex | Usage |
|------|-----|-------|
| Blue | #3B82F6 | Strategic/Analytical |
| Emerald | #10B981 | Financial/Growth |
| Red | #EF4444 | Devil's Advocate/Danger |
| Purple | #8B5CF6 | Creative/Innovation |
| Orange | #F97316 | Energetic/Urgent |
| Pink | #EC4899 | Unique/Different |
| Cyan | #06B6D4 | Technical/Logic |
| Amber | #F59E0B | Warning/Caution |
| Gray | #6B7280 | User messages |

---

## Phase Summary

### ✅ Phase 1: The Core Loop (COMPLETE)

**Goal**: Verify LLM connectivity and basic state management

- [x] Basic Electron Shell setup
- [x] Settings page for API Keys (Gemini)
- [x] Creation of "Personas" (SQLite storage)
- [x] Simple Chat Interface (User + 2 Agents)
- [x] Sequential turn-taking (User -> A -> B -> User)
- [x] Session management (create, view, delete)
- [x] Encrypted API key storage
- [x] Token/cost tracking
- [x] Solid color UI (no gradients)

### ✅ Phase 2: The Conductor (COMPLETE)

**Goal**: Verify the debate can self-regulate without constant user input

- [x] Implement "Orchestrator" System Prompt logic
- [x] Implement "Smart Turn-Taking" algorithm (Selector Agent)
- [x] Implement the "Shared Blackboard" (State summarization)
- [x] Async sequential rendering for multiple agents
- [x] Orchestrator toggle for personas

### ⏳ Phase 3: The Context (PLANNED)

**Goal**: Verify agents can read and utilize documents

- [ ] File upload UI (Global vs Persona)
- [ ] Implement local vector store (e.g., `lancedb` or `langchain/vectorstores/memory`)
- [ ] Implement "Rolling Context" logic with summarization
- [ ] Text extraction from PDF/TXT/MD files
- [ ] Persona-scoped document access

### ⏳ Phase 4: Polish & Controls (PLANNED)

**Goal**: Make it usable and enjoyable for daily work

- [ ] Add "Hush" button (mute persona for N turns)
- [ ] Add "Whisper" feature (private system instructions)
- [ ] Circuit breaker (max auto-replies before user confirm)
- [ ] Topic drift detection
- [ ] UI Polish (Animations, Markdown rendering improvements)
- [ ] Temporary personas (session-scoped)

---

## Development Commands

```bash
# Development
npm run electron:dev          # Start Electron with Vite dev server

# Building
npm run build                 # Build Vite SPA for production
npm run electron:build        # Build Electron app
npm run electron:package      # Package as .deb

# Database
npm run db:migrate           # Run database migrations
npm run db:seed              # Seed with sample data

# Linting
npm run lint                 # Check all files for errors
npx eslint --fix .           # Fix auto-fixable issues
```

---

## Security Considerations

1. **API Key Storage**: Never expose to renderer process; encrypted at rest using OS-level encryption via electron-store
2. **IPC Security**: Use contextBridge (not direct require); validate all inputs; no eval or dynamic code execution
3. **Database**: Store in user's data directory; no remote sync; plain text acceptable per requirements
4. **CSP (Content Security Policy)**: Restrict to local resources only; no inline scripts; no external connections except Gemini API

---

## Next Steps

1. **Phase 3 Implementation**: File attachments and RAG
   - Design file upload UI (global vs persona-scoped)
   - Integrate vector store (LanceDB)
   - Implement text extraction pipeline
   - Add context injection for RAG

2. **Phase 4 Implementation**: Advanced controls
   - Implement hush/whisper features
   - Add circuit breaker for cost control
   - UI/UX polish

3. **Future Enhancements**:
   - Multi-provider LLM support (OpenAI, Ollama)
   - Voice input/output
   - Branching conversations
   - Multi-user collaboration

---

**Last Updated**: 2026-02-05  
**Document Version**: 2.0
