# Task 8 – Routing Integration & Navigation

## Overview
- Extended the root layout handlers so Sidebar One triggers TanStack navigation for `/dashboard` and `/resources`, emitting `app:navigate` events for consistent active-state tracking (`src/routes/__root.tsx`).
- Updated Sidebar Two’s view listener to recognize dashboard/resources views and display proper titles (`src/app/layout/layout-sidebar-two.tsx`).
- Added lightweight skeleton states to the dashboard and resources routes to avoid layout jumps before data arrives (`src/routes/dashboard/index.tsx`, `src/routes/resources/index.tsx`).

## Behavior Notes
- Navigation buttons now highlight in both sidebars when landing on the new routes; existing settings/projects/editor flows remain untouched.
- The placeholder loaders render for a single frame today and will naturally extend once real data fetching hooks in.
- `routeTree.gen.ts` already contained the new routes, so no additional generation step was required.

## Follow-up Suggestions
- Wire sidebar resource button to context-aware content in Sidebar Two once the resource library view is built.
- Replace the temporary `setTimeout` loaders with actual data-fetching suspense boundaries when backend hooks become available.
- Consider broadcasting richer navigation payloads (e.g., resource category) once detail pages exist.
