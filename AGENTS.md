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

## Git Workflow

### Commit Messages
Follow conventional commits pattern:
```
feat: add persona creation form
fix: resolve chat scroll issue
docs: update API documentation
refactor: simplify database queries
test: add unit tests for Gemini client
```

### Branch Naming
- `feature/persona-management`
- `fix/session-chat-scroll`
- `refactor/database-layer`

### Pull Request Guidelines
1. Reference related issue in description
2. Include screenshots for UI changes
3. Ensure `npm run lint` passes
4. Keep PRs focused and under 500 lines when possible
5. Request review from maintainers

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

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Zustand State Management](https://github.com/pmndrs/zustand)
- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)
