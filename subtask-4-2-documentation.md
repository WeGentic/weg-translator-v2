# Sub-task 4.2 Documentation — Toolbar UI Parity

Date: 2025-02-16

## Scope
Sub-task 4.2 focused on retaining the legacy toolbar experience while removing memo-specific logic. Changes remain scoped to `src/features/project-manager-v2/ProjectManagerToolbar.tsx`.

## Implementation Notes
- Replaced the legacy `useMemo` pair for `hasActiveFilters` / `activeFiltersCount` with pure helpers (`calculateActiveFilters` and derived constants at `ProjectManagerToolbar.tsx:32-74`), feeding both the desktop clear affordance and mobile badge without additional renders.
- Confirmed all desktop `Select` triggers, items, and tooltip affordances retain the same Tailwind tokens and structural markup; only the handler references shifted to the new `applyFilterUpdate` helper so ShadCN v3.3.1 props remain unchanged.
- Verified the mobile popover stack continues to mirror the desktop options and badge behaviour, now backed by the shared helper logic instead of duplicated `useMemo` calculations.

## Behavioural Parity
- Active filter counts remain consistent across breakpoints, pulse animation, and tooltip messaging. Clear/reset flows still hide the badge instantly thanks to the shared helper.
- Styling stays aligned with the WeGentic palette variables; no additional CSS overrides were introduced.

## Validation
- `pnpm lint` (fails globally because of unrelated legacy warnings/errors; none of the reported findings reference the new toolbar file).

## Next Steps
Task 5 will revisit shared utilities (`filterProjects`, type exports) using the now-stable toolbar contract; no additional UI changes required from this sub-task.
