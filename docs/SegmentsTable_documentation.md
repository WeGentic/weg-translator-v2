# Segments Table Integration (2025-02-15)

## Overview
- Added `src/components/projects/editor/SegmentsTable.tsx` powered by TanStack Table v8 and @tanstack/react-virtual to render normalized JLIFF segment rows with virtualization and sticky headers.
- Implemented token rendering primitives:
  - `TokenLine` renders text and placeholder tokens with accessible chip buttons and deterministic keys.
  - `PlaceholderParityBadge` surfaces source/target placeholder counts with color-coded status messaging.
- Embedded the new table into `ProjectEditor`, replacing the placeholder preview panel while preserving existing metadata summary cards.

## Implementation Notes
- Virtualization uses a scroll container ref and a 64px row size estimate with overscan; when the virtualizer cannot materialize rows (e.g., jsdom tests), the component gracefully falls back to rendering all rows without virtualization.
- Table headers expose sorting on the Segment column, plus a fuzzy global search input backed by `rankItem` across key/source/target text.
- Placeholder parity badges expose `role="status"` for screen readers and tooltips summarizing count deltas.

## Testing & Linting
- `npm run lint` (emits pre-existing warnings about legacy `useEffect` setters and a test helper naming convention).
- `npx vitest run src/components/projects/editor/ProjectEditor.test.tsx` verifies the editor renders live table data with mocked artifacts.

## Follow-up
- Task 8.3 (`PlaceholderInspector`) and Task 9 (editing flow) remain outstanding.
- Consider addressing lint warnings in `ProjectEditor` once broader refactors are scheduled.
