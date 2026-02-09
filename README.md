# Council

A private, desktop-based command center that transforms solitary brainstorming into a high-level strategic summit by convening a team of autonomous AI agents to debate your challenges.

![Status](https://img.shields.io/badge/status-beta-blue)
![Platform](https://img.shields.io/badge/platform-Linux%20(Debian)-green)
![Phase](https://img.shields.io/badge/phase-2%20of%204-orange)

---

## What is Council?

Council functions as a self-regulating meeting room: you define the problem, and a cast of custom "Personas"—equipped with distinct personalities, specific LLM models, and private instructions—discuss it while an AI "Orchestrator" directs the flow, managing turn-taking and maintaining a live "Blackboard" of consensus to prevent circular arguments.

It is a tool for rapid ideation and rigorous critique, allowing you to step back and watch a simulated expert panel dismantle and reconstruct your ideas until a definitive solution is reached.

---

## Features

### Current (Phase 1 & 2)

- **Multi-Agent Debates**: Create sessions with multiple AI personas that debate your problem
- **Smart Orchestrator**: AI-driven turn-taking that selects the best speaker for each response
- **Custom Personas**: Build reusable personas with unique roles, models, and hidden agendas
- **Shared Blackboard**: Live view of consensus, conflicts, and next steps
- **Session Management**: Create, resume, and manage multiple brainstorming sessions
- **Local-First**: All data stored locally in SQLite; no cloud dependencies
- **Cost Tracking**: Real-time token and cost monitoring
- **Secure**: Encrypted API key storage using OS-level encryption

### Coming Soon (Phase 3 & 4)

- File attachments with RAG (Retrieval-Augmented Generation)
- Document context for personas
- Hush and whisper controls
- Circuit breaker for cost control
- Topic drift detection

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Linux (Debian-based distributions recommended)
- Google Gemini API key

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd Council/my-app

# Install dependencies
npm install

# Start development server
npm run electron:dev
```

### Configuration

1. Launch the app
2. Go to Settings
3. Enter your Gemini API key
4. Test the connection
5. Create your first persona
6. Start a new session

---

## Project Structure

```
my-app/
├── app/                    # Feature page components
│   ├── layout.tsx         # Shared renderer layout
│   ├── globals.css        # Global styles
│   ├── personas/          # Persona management UI
│   ├── sessions/          # Sessions list
│   ├── session/           # Active session chat
│   │   └── new/           # Create new session
│   └── settings/          # App settings
├── src/                   # Vite SPA bootstrap and routing
│   ├── main.tsx           # React entrypoint
│   └── App.tsx            # Hash-router route map
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── chat/             # Chat-related components
│   └── session/          # Session components
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions and services
│   ├── db/              # Database layer
│   ├── llm/             # LLM integration
│   └── utils.ts         # Utility functions
├── electron/            # Electron main process
├── stores/              # Zustand state stores
├── public/              # Static assets
├── requirements/        # Requirement registry (CLI-managed)
├── plan.md              # Implementation roadmap
└── package.json         # Dependencies and scripts
```

---

## Documentation

- **[plan.md](./plan.md)** - Implementation roadmap and technical architecture
- **[AGENTS.md](./AGENTS.md)** - Development guidelines and conventions

---

## Development

```bash
# Start development server with hot reload
npm run electron:dev

# Build for production
npm run build

# Build Electron app
npm run electron:build

# Package as .deb for Linux
npm run electron:package

# Run linter
npm run lint

# Fix linting issues
npx eslint --fix .
```

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Desktop Framework | Electron + Electron Forge |
| Frontend | Vite + React (SPA) |
| State Management | Zustand |
| Database | SQLite (pure JS) |
| Settings | electron-store |
| LLM | Google Gemini API |
| UI | shadcn/ui + Tailwind CSS |
| Icons | Lucide React |

---

## Architecture

Council uses a secure Electron architecture:

- **Renderer Process**: Vite-powered React SPA with Zustand state management and hash routing
- **Main Process**: Node.js backend handling API calls and encryption
- **IPC Communication**: Secure context bridge between renderer and main
- **Database**: SQLite with pure-JS driver for cross-platform compatibility

All LLM API calls and sensitive operations happen in the main process, keeping API keys secure and never exposing them to the renderer.

---

## Requirements

Requirements are tracked in the CLI-managed registry under `requirements/`.

```bash
npm run req -- list
npm run req:next
```

---

## Roadmap

- **Phase 1** ✅ Core Loop - Basic chat with personas and sequential turn-taking
- **Phase 2** ✅ The Conductor - Smart orchestrator with AI-driven turn-taking
- **Phase 3** ⏳ The Context - File attachments and RAG support
- **Phase 4** ⏳ Polish & Controls - Advanced features and UI polish

---

## Security

- API keys encrypted at rest using OS-level encryption
- All sensitive operations in main process
- No telemetry or external syncing
- Content Security Policy restricts external connections

---

## License

[Add your license here]

---

## Contributing

[Add contribution guidelines here]

---

**Built with** ❤️ **for deep thinkers and problem solvers**
