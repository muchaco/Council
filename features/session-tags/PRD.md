# Session Tags - Product Requirements Document

## Problem Statement

As users create more brainstorming sessions, they need a way to organize and categorize them effectively. Currently, sessions can only be identified by their title and creation date, making it difficult to:
- Group related sessions by topic, project, or theme
- Quickly find sessions of a particular type
- Filter the sessions list to focus on relevant conversations
- Build mental models of session organization beyond chronological ordering

## User Stories

- **US-1**: As a user, I want to assign tags to a session when creating it, so I can categorize it by topic or project.
- **US-2**: As a user, I want to add or remove tags from an existing session, so my organization can evolve as the session develops.
- **US-3**: As a user, I want to see tags displayed on sessions in the list view, so I can quickly identify session categories.
- **US-4**: As a user, I want to filter the sessions list by tags, so I can focus on sessions relevant to my current work.

## Functional Requirements

### Tag Management

**FR-1.1**: Session tags must be free-text strings with a maximum length of 20 characters.

**FR-1.2**: A session may have 0-3 tags assigned to it.

**FR-1.3**: Duplicate tags (case-insensitive) must not be allowed on a single session.

**FR-1.4**: The system must normalize tag casing (convert to lowercase for storage) to ensure consistency.

**FR-1.5**: The "add tag" button (plus icon) must be disabled when a session already has 3 tags.

**FR-1.6**: Tag input must occur via a popover interface that opens when clicking the plus icon.

**FR-1.7**: The popover must contain a single text input allowing exactly one tag to be added per opening.

**FR-1.8**: Tag submission must occur when the user presses Enter.

**FR-1.9**: Validation must run on Enter press:
  - Reject if input contains only whitespace (after trim)
  - Reject if input exceeds 20 characters
  - Show inline validation error for rejected attempts

**FR-1.10**: Upon successful validation, the tag must be appended to the list without reordering existing tags.

**FR-1.11**: The popover must close after successful tag addition.

**FR-1.12**: Users must be able to remove individual tags by clicking an X icon on the tag pill.

**FR-1.12a**: "Editing" a tag value is not supported. To change a tag, users must remove it and add a new one.

### Tag Display

**FR-1.13**: Tags must be displayed as pills (with remove X icon) in editable contexts:
  - Session creation form
  - Session view/edit page

**FR-1.14**: Tags must be displayed as badges/chips (read-only, no X) in non-editable contexts:
  - Session list view

**FR-1.15**: Tags must be visually distinct using the design system's badge/pill style.

**FR-1.16**: Tags must be displayed in a single horizontal row (inline), not wrapping to new lines.

**FR-1.16a**: In session list view and session view, tags must be positioned immediately adjacent to the session title.

### Tag Content

**FR-1.17**: Tags may contain:
  - Alphanumeric characters
  - Special characters (hyphens, underscores, etc.)
  - Spaces within the text
  - Emojis

**FR-1.18**: Tags must be trimmed of leading/trailing whitespace before validation and storage.

### Data Model

**FR-1.19**: Tags must be stored in a separate `tags` table with:
  - Unique constraint on the tag name (case-insensitive)
  - Auto-generated integer primary key
  - This design enables future Phase 3 features: filtering sessions by tag and listing all available tags across the system

**FR-1.20**: A junction table `session_tags` must implement the many-to-many relationship between sessions and tags with foreign key constraints to both tables.

**FR-1.21**: Deleting a session must cascade-delete its tag associations but not the tags themselves. Orphaned tags (tags with zero session associations) may remain in the database and cleaned up via a background job or manual maintenance.

**FR-1.22**: The system must provide an API/IPC method to retrieve all existing tags for:
  - Autocomplete functionality during tag input
  - Future tag filtering UI (Phase 3)
  - Future "browse all tags" feature (Phase 3)

## Non-Functional Requirements

**NFR-1**: Tag operations must complete within 100ms to maintain responsive UI.

**NFR-2**: The tag storage design must support efficient filtering queries when FR-1.7 (Session List Filtering) is implemented.

**NFR-3**: The UI must display a maximum of 3 tags; the add button is disabled at this limit.

**NFR-4**: Tag input must prevent XSS by sanitizing input strings before storage.

## Out of Scope

- **Tag hierarchies or nested tags**: Tags are flat; no parent/child relationships
- **Tag colors or custom styling**: All tags use the default badge/pill appearance
- **Tag descriptions or metadata**: Tags are simple labels only
- **System-defined or required tags**: All tags are user-created; no mandatory tags
- **Tag management UI**: No dedicated page for managing all tags; tags are managed per-session
- **Bulk tag operations**: No ability to apply tags to multiple sessions at once
- **Tag usage analytics**: No tracking of most-used tags
- **Inline tag editing**: Tags cannot be edited in-place; must be removed and re-added
