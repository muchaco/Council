# Repository Guidelines

## Project Overview

Council is a desktop-based AI brainstorming tool built with Next.js, React, and Electron. It enables users to conduct multi-agent AI debates through a custom persona system.

## Project Structure

```
my-app/
├── app/                    # Next.js app router pages
│   ├── page.tsx           # Root redirect
│   ├── layout.tsx         # Root layout with navigation
│   ├── globals.css        # Global styles
│   ├── personas/          # Persona management UI
│   ├── sessions/          # Sessions list
│   ├── session/           # Active session chat
│   │   ├── [id]/          # Existing session view
│   │   └── new/           # Create new session
│   └── settings/          # App settings
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── chat/             # Chat-related components (planned)
│   └── session/          # Session components (planned)
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions and services
│   ├── db/              # Database layer (planned)
│   ├── llm/             # LLM integration (planned)
│   └── utils.ts         # Utility functions
├── electron/            # Electron main process (planned)
├── stores/              # Zustand state stores (planned)
├── public/              # Static assets
├── styles/              # Additional styles
├── plan.md              # Implementation plan
└── package.json         # Dependencies and scripts
```

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Electron commands (planned)
npm run electron:dev       # Start Electron in dev mode
npm run electron:build     # Build Electron app
npm run electron:package   # Package as .deb
```

### ESLint Setup

This project uses ESLint 9 with the new flat config format (`eslint.config.mjs`). ESLint is configured with Next.js recommended rules via `eslint-config-next/core-web-vitals`.

**Important Notes:**
- The project uses the **flat config format** (ESLint 9+), not the legacy `.eslintrc` format
- Configuration is in `eslint.config.mjs` at the project root
- The lint command will automatically check all TypeScript, TSX, JavaScript, and JSX files
- Currently there are 3 known linting errors in the codebase that should be addressed

**Running Linter:**
```bash
npm run lint              # Check all files for errors
npx eslint .              # Alternative way to run linter
npx eslint --fix .        # Fix auto-fixable issues
```

**Ignored Directories:**
- `.next/`, `out/`, `build/` - Next.js build outputs
- `electron/dist/` - Electron build output
- `node_modules/` - Dependencies
- `next-env.d.ts` - Next.js types

## Coding Conventions

### File Naming
- Components: PascalCase (e.g., `MessageList.tsx`)
- Utilities: camelCase (e.g., `encryption.ts`)
- Directories: kebab-case (e.g., `chat-message/`)

### Component Structure
- Use functional components with TypeScript
- Props interface named `{ComponentName}Props`
- Export default for page components
- Named exports for reusable components

### Styling
- Tailwind CSS for all styling
- Use `class-variance-authority` for component variants
- Solid colors only (no gradients)
- Prefer semantic color tokens (e.g., `bg-accent`, `text-muted-foreground`)

### State Management
- Zustand for global state
- React hooks for local component state
- Database operations via IPC to main process

### TypeScript
- Strict mode enabled
- Explicit return types on functions
- Interface over type for object definitions

## Architecture Decisions

- **IPC Communication**: All API calls and database operations go through Electron's IPC to keep sensitive data (API keys) in the main process
- **Database**: SQLite with pure-JS driver for cross-platform compatibility
- **State**: Zustand for client state, SQLite for persistence
- **Styling**: Tailwind + shadcn/ui for consistent design system
- **LLM**: Google Gemini API with configurable models per persona

## Security

- API keys stored encrypted in electron-store
- Database stored in user's data directory
- No remote code execution
- IPC channels validated and typed

---

## Architecture Principles

### Functional Core, Imperative Shell

All business logic must follow the **Functional Core, Imperative Shell** pattern:

- **Functional Core**: Pure functions that contain all business logic. They are:
  - Free of side effects (no I/O, no mutations)
  - Deterministic (same input → same output)
  - Easy to test without mocks
  - Written in a domain-driven design (DDD) specification style

- **Imperative Shell**: Thin layer that:
  - Handles I/O (database, API calls, file system)
  - Orchestrates calls to the functional core
  - Contains no business logic

### Testing Standards

All functional core code must be tested with:

- **Data-driven / parametrized tests**: Test multiple scenarios using table-driven patterns
- **DDD specification style**: Tests should read like specifications of domain behavior
- **No mocking for core logic**: Pure functions don't need mocks
- **Shell tests**: Keep imperative shell tests close to zero

Example pattern:
```typescript
// Functional core - pure business logic
const calculateDebateOutcome = (personas: Persona[], context: Context): DebateResult => {
  // Pure transformation, no side effects
};

// Imperative shell - thin orchestration layer
const conductDebate = async (sessionId: string) => {
  const session = await db.sessions.get(sessionId);  // I/O
  const result = calculateDebateOutcome(session.personas, session.context);  // Core
  await db.results.save(result);  // I/O
};
```

---

### 📝 Tribal Knowledge Capture

If you encounter information that was **hard to find, undocumented, or required trial-and-error**, you must briefly update the `## Tribal Knowledge` section below.

**Update if you discovered:**

* **Commands:** Non-obvious scripts for linting, testing, or deployment.
* **Locations:** Key logic or configs hidden in unexpected directories.
* **Context:** Necessary "gotchas" or corrections to the user's initial description.

**Format:** Keep it to one bullet point:

* **[Topic]:** [The solution/path/command].

---

## Tribal Knowledge

*(Agent: Append new insights below this line)*

---
