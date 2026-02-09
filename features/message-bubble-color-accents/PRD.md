# Message Bubble Color Accents

## Problem Statement

Currently, all message bubbles in the chat interface use a neutral `bg-card` styling regardless of which persona sent the message. While personas have assigned colors displayed on their avatars (FR-6.2), the message bubbles themselves lack visual differentiation. This creates a disconnect between the persona's visual identity and their contributions to the conversation, making it harder for users to quickly scan and associate messages with specific personas during active brainstorming sessions.

## User Stories

- **As a user conducting multi-persona brainstorming sessions**, I want message bubbles to have subtle color accents derived from each persona's assigned color, so that I can visually associate messages with specific personas at a glance without having to read the sender name every time.

- **As a user reviewing long conversation histories**, I want persona messages to have consistent visual differentiation, so that I can quickly scan through the chat and identify which persona contributed which ideas.

- **As a user with accessibility needs**, I want the color accents to maintain sufficient contrast and readability, so that the visual enhancement doesn't compromise text legibility.

## Functional Requirements

### FR-1: Programmatic Accent Color Calculation
**Description**: The system must calculate accent colors programmatically from each persona's base color using color manipulation algorithms.

- **Acceptance Criteria**:
  - Accent color is derived mathematically from the persona's assigned hex color
  - No hardcoded color mappings or lookup tables allowed
  - Calculation must produce consistent results for the same input color
  - Output must be a valid CSS color value (hex, rgb, or hsl)

### FR-2: Accent Application to Message Bubbles
**Description**: Persona message bubbles must display a subtle accent derived from the sender's assigned color.

- **Acceptance Criteria**:
  - Accent is applied only to persona messages (not user or orchestrator messages)
  - User/orchestrator messages continue to use neutral `bg-card` styling
  - Accent style is consistent across all persona messages (same visual treatment)
  - Accent must not overwhelm the primary `bg-card` background

### FR-3: Accent Style Specification
**Description**: The accent must use a left border accent combined with a subtle background tint.

- **Acceptance Criteria**:
  - Left border: 3-4px solid border using the calculated accent color
  - Background tint: Subtle overlay at 5-10% opacity of the accent color
  - Both elements use the same calculated accent color
  - Border and tint work together harmoniously

### FR-4: Edge Case Color Handling
**Description**: The system must handle edge cases where the base persona color would produce poor visibility.

- **Acceptance Criteria**:
  - Very light colors (luminance > 0.9): Darken accent by at least 40% to ensure visibility
  - Very dark colors (luminance < 0.1): Lighten accent by at least 40% to ensure visibility
  - Near-white colors (#FFFFFF and similar): Fall back to neutral gray (#6B7280) accent
  - Near-black colors (#000000 and similar): Fall back to neutral gray (#6B7280) accent
  - All adjusted colors must maintain WCAG AA contrast ratios against the background

### FR-5: Color Utility Functions
**Description**: Create reusable utility functions for color manipulation.

- **Acceptance Criteria**:
  - `calculateAccentColor(baseColor: string): string` - Returns accent color from base
  - `adjustLuminance(color: string, percent: number): string` - Lighten/darken helper
  - `getLuminance(color: string): number` - Calculate relative luminance (0-1)
  - `hexToHSL(color: string): { h: number, s: number, l: number }` - Convert hex to HSL
  - `hslToHex(h: number, s: number, l: number): string` - Convert HSL back to hex
  - All functions include unit tests with edge cases

### FR-6: Message Bubble Component Update
**Description**: Update the message bubble component to apply accents to persona messages.

- **Acceptance Criteria**:
  - Component accepts optional `accentColor` prop
  - When `accentColor` is provided, applies left border and background tint
  - When `accentColor` is undefined/null, uses neutral styling
  - Component styling updated in `components/chat/MessageBubble.tsx` or equivalent
  - Existing functionality (timestamps, sender names, actions) remains unchanged

### FR-7: Database Integration
**Description**: Message queries must return persona color data for accent calculation.

- **Acceptance Criteria**:
  - Message queries join with personas table to fetch assigned color
  - Color data is available when rendering message bubbles
  - No additional database calls required (join in existing query)
  - Handles cases where persona has been deleted (null color) gracefully

## Non-Functional Requirements

### NFR-1: Performance
**Description**: Color calculations must not impact rendering performance.

- **Acceptance Criteria**:
  - Color calculations complete in < 1ms per message
  - Consider memoization for repeated color calculations
  - No perceptible lag when scrolling through chat history

### NFR-2: Accessibility
**Description**: Accents must not compromise text readability.

- **Acceptance Criteria**:
  - Text color maintains WCAG AA contrast ratio (4.5:1) against the tinted background
  - Accent borders are visible but not distracting
  - Color is not the sole means of identification (sender name still displayed)
  - Works in both light and dark mode themes

### NFR-3: Maintainability
**Description**: Color utilities should be reusable for future features.

- **Acceptance Criteria**:
  - Color utilities placed in `lib/colors.ts` or similar shared location
  - Functions are pure (no side effects) and well-documented
  - TypeScript types exported for all functions
  - Unit tests cover edge cases and common scenarios

## Out of Scope

- **Configurable Accent Intensity**: This feature uses fixed calculation logic. Making accent intensity configurable per persona is out of scope for this increment and can be added later if requested.

- **Gradient Accents**: Only solid color accents are in scope. Gradient or pattern-based accents are not included.

- **Animated Accents**: No animations, transitions, or effects on the accent colors. Static styling only.

- **User Message Accents**: User and orchestrator messages will remain neutral. Adding accents to these message types is out of scope.

- **Accent Preview in Persona Form**: Real-time preview of how accents will look in the persona creation/edit form is out of scope. Users will see the result in the chat.

## Implementation Notes

- **Files Likely to Change**:
  - `components/chat/MessageBubble.tsx` - Apply accent styling
  - `lib/colors.ts` (new file) - Color utility functions
  - Database query files - Join personas table for color data

- **Dependencies**:
  - Requires FR-6.2 (Visual Separation with persona colors) to be implemented
  - Builds on existing persona color assignment system

- **Testing Strategy**:
  - Unit tests for color utility functions with various hex inputs
  - Visual testing for edge cases (light/dark colors)
  - Integration test ensuring persona messages display accents
