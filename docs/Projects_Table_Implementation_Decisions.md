# Projects Table — Implementation Decisions

- Headless vs. integrated UI
  - Chose TanStack Table v8 (headless) with ShadCN components for full control and accessibility.
- Status model
  - Frontend displays activity status (Pending/Running/Completed/Failed). Aggregated server-side to avoid N+1 calls.
- Search
  - Global fuzzy search via `rankItem` from `@tanstack/match-sorter-utils` for better match ranking.
- Formatting
  - `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat` avoid additional deps.
- Toolbar
  - Non-sticky based on UX feedback; keeps visual breathing room near the header.
- State management
  - Table state controlled by ProjectsPanel to persist through polling.
- Performance
  - Virtualization available if lists grow beyond current targets.

