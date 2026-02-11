# Registry Management Scripts

CLI tools for managing project requirements and bugs with priority/complexity scoring.

## Installation

Dependencies are already in the project. The scripts use `commander` which was installed as a dev dependency.

## NPM Scripts

### Requirements

```bash
npm run req -- <command>           # Run any requirement command
npm run req:create                  # Interactive: create new requirement
npm run req -- list                 # List all requirements
npm run req -- list --priority high # List high priority only
npm run req -- list --complexity 5  # List items with complexity <= 5
npm run req -- get REQ-001         # Show full details
npm run req -- mark REQ-001 completed  # Update status
npm run req -- search "blackboard"  # Search in titles/descriptions
npm run req:next                    # Show top priority (highest score)
```

### Bugs

```bash
npm run bug -- <command>           # Run any bug command
npm run bug:create                  # Interactive: create new bug
npm run bug -- list                 # List all bugs
npm run bug -- list --status open   # List open bugs only
npm run bug -- get BUG-001          # Show full details
npm run bug -- mark BUG-001 resolved   # Update status
npm run bug -- search "crash"       # Search bugs
npm run bug:next                    # Show top priority bug
```

## Scoring System

Items are scored by **priority_weight / complexity** ratio:
- **Priority weights:** critical=4, high=3, medium=2, low=1
- **Complexity:** 1-10 (lower = easier to implement)

**Higher score = better to work on next**

Example:
- Critical priority (4) + Complexity 2 → Score: 2.00 (great!)
- High priority (3) + Complexity 6 → Score: 0.50 (lower priority)

## Registry Structure

```
requirements/
├── index.json              # Registry metadata and summary
└── REQ-001/
    └── requirement.json    # Full requirement data

bugs/
├── index.json              # Registry metadata and summary
└── BUG-001/
    └── bug.json            # Full bug data
```

## Commands Reference

### create
Interactive CLI that prompts for:
- Title (single line)
- Description (multi-line, Ctrl+D to finish)
- Priority (low/medium/high/critical)
- Complexity (1-10 scale with descriptions)

Returns: Generated ID (e.g., REQ-061 or BUG-009)

### get <id>
Display full details including description and implementation notes.

### list [options]
Filter options:
- `--status <status>` - Filter by status
- `--priority <priority>` - Filter by priority
- `--complexity <n>` - Max complexity threshold
- `--sort <field>` - Sort by: priority, complexity, score (default), created, updated
- `--asc` - Sort ascending (default is descending)
- `--limit <n>` - Limit results

### mark <id> <status>
Update item status.

**Requirements status:**
- `draft` - Rough idea, not ready for implementation
- `pending` - Ready for implementation, waiting to be started
- `in-progress` - Currently being worked on
- `completed` - Implementation finished
- `cancelled` - No longer needed

**Bugs status:**
- `open` - New bug, not yet investigated
- `in-progress` - Currently being fixed
- `resolved` - Fix implemented, awaiting verification
- `closed` - Fix verified and deployed
- `wontfix` - Intentionally not being fixed

### update <id>
Interactive update - prompts for new values (press Enter to keep current).

### search <query>
Full-text search across titles and descriptions.

### next [options]
Find the best item to work on next based on priority/complexity ratio.

Options:
- `--complexity <n>` - Only consider items up to this complexity

### delete <id>
Remove an item and its folder permanently.

## File Format

Each item is stored as JSON with markdown-formatted description:

```json
{
  "id": "REQ-001",
  "title": "Create New Session",
  "description": "User must be able to create a new Session...",
  "status": "completed",
  "priority": "critical",
  "complexity": 2,
  "createdAt": "2026-02-08",
  "updatedAt": "2026-02-08",
  "path": "requirements/REQ-001"
}
```

## Migration from requirements.md

The existing `requirements.md` has been migrated using:

```bash
node scripts/migrate-requirements.js
```

This created 37 requirement entries. You can now archive or delete the old `requirements.md` file.

## LLM Agent Note

**⚠️ IMPORTANT:** Do not directly edit files in `requirements/` or `bugs/` folders, or their `index.json` files. Always use these CLI scripts to ensure data consistency and proper ID generation.
