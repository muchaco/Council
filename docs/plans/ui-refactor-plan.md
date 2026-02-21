# UI Refactor Plan: Modern AI Workspace Design

## Objective
Transform the legacy "Council Chamber" admin dashboard into a modern, sophisticated AI workspace similar to ChatGPT, Claude, or Vercel's dashboard.

## Non-Goals
- No changes to state management, backend logic, or data structures
- No changes to IPC contracts or window API
- No new features, only visual refactoring

## Architecture Impact
- Changes are confined to `src/renderer/App.tsx` and `src/renderer/styles.css`
- May need to add shadcn components (Avatar, Accordion, Sheet, etc.)
- Font imports will change from Source Sans 3 + Playfair Display to Geist + Instrument Serif

## Implementation Steps

### Phase 1: Global Theme & Typography (Foundation)
1. **Update CSS Variables** (styles.css)
   - Replace cream/amber palette with crisp modern grays and subtle accent colors
   - Use standard shadcn variables: `bg-background`, `bg-muted/30`
   - Update font imports to Geist (sans) + Instrument Serif (display)
   
2. **Simplify Shell Layout** (App.tsx)
   - Replace card-in-card with clean, full-width main area
   - Add max-width container (`max-w-6xl mx-auto`)
   - Remove heavy shadows and borders, use whitespace

### Phase 2: Sidebar Navigation (App Shell)
1. **Create Sidebar Component**
   - Convert top tabs to left sidebar
   - Icons: LayoutDashboard, Users, Settings from lucide-react
   - Active state: `bg-accent text-accent-foreground` with left border
   - Collapsible on mobile (Sheet component)

### Phase 3: Discussion/Chat View (Critical)
1. **3-Column Layout**
   - Left: Chat thread (centered, max-width)
   - Right: Collapsible Briefing + Members sidebar
   
2. **Message Redesign**
   - Remove heavy bounding boxes
   - Agent messages: 4px left border with agent color, clean text
   - Conductor messages: Center-aligned, italicized, muted bg
   
3. **Floating Input Area**
   - Bottom-centered, glassmorphism (`backdrop-blur-md bg-background/80`)
   - Modern rounded prompt input with inset send button

### Phase 4: Dashboard (Councils List)
1. **Council Cards**
   - Clean white cards with `shadow-sm hover:shadow-md`
   - Overlapping Avatar group for members (instead of text)
   - Softer badges (slate colors)
   - Pulsing dot for status indicators

### Phase 5: Settings
1. **Provider Grid Redesign**
   - Compact list items instead of tall cards
   - Status badge (Green/Gray dot)
   - "Edit" button reveals inputs in Sheet or inline expand
   
2. **Global Default Model**
   - Dedicated section with constrained width (`max-w-md`)
   - Standard shadcn Select

### Phase 6: Edit Agent Page
1. **Form Layout**
   - Group related fields visually
   - System Prompt: reasonable default height, resizable
   - Advanced Settings accordion for Verbosity/Temperature

## Coverage Matrix

| Requirement | Test Case | Validation |
|------------|-----------|------------|
| Typography | Visual inspection | Serif headers, sans body |
| Color Palette | Visual inspection | No cream/yellow, clean grays |
| Sidebar Navigation | Navigation flow | All 3 tabs accessible |
| Chat Layout | Discussion view | 3-column layout, right sidebar collapsible |
| Message Styling | Message display | Left borders, conductor center |
| Floating Input | Input interaction | Glassmorphism, bottom-fixed |
| Council Cards | Dashboard view | Shadow cards, avatar groups |
| Provider Grid | Settings view | Compact layout, expand on edit |
| Agent Form | Edit agent view | Accordion for advanced |

## Validation Commands
- `bun run dev:renderer` - Visual validation
- Playwright screenshots at key views
- Responsive testing at 1024px and 1920px widths

## Rollback Strategy
- Keep original styles commented out in styles.css
- Git commit after each phase for easy bisect
- Feature flag via query param if needed
