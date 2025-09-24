# JLIFF Editor Enhancements — 2025-09-24

## Overview
- Hardened `TargetEditor` against manual brace entry, added Alt+P shortcut to focus placeholder chips, and exposed one-click "Insert missing" remediation.
- Extended `SegmentsTable` with combined mismatch/placeholder/status filters plus inline QC warning icons for rows with placeholder issues.
- Switched segment join keys to the backend-aligned `u{unit}-s{segment}` format and updated supporting utilities/tests.

## UI & UX Updates
- `TargetEditor` now presents live-region guidance, accessible chip buttons, and sanitised paste handling; copy/reset/save flows remain intact.
- `RowActions` exposes an "Insert missing (n)" button that surfaces only when discrepancies exist, preserving save/dirty state checks.
- Filter toolbar gains “Has placeholders” checkbox and status select, while the parity badge column surfaces warning icons via `AlertTriangle`.

## Quality & Testing
- Added focused tests in `TargetEditor.test.tsx` covering brace blocking, Alt+P focus, and missing-placeholder insertion.
- Added `SegmentsTable.test.ts` to validate placeholder filter reducers and normalisation helpers.
- Updated existing unit tests (`tokenize.test.ts`, `ProjectEditor.test.tsx`) to assert new key format and mock interfaces.
- Full Vitest suite executed (`npm run test`).

## Performance Notes (2025-09-24 follow-up)
- Added `useMemo`-based rendering in `TokenLine` and `PlaceholderParityBadge` to keep placeholder token markup stable unless inputs change.
- Opted out of React 19 auto memoization for `SegmentsTable` (`"use no memo"`) per TanStack guidance, while retaining virtualization flattening via `useMemo`.

## Follow-up / Open Items
- Component-level parity badge rendering lacks dedicated snapshot/visual coverage; consider adding once design stabilises.
- Concurrency guard for backend writes (Plan Task 16.3) still pending.
