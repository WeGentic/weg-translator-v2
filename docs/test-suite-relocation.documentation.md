# Test Suite Relocation Summary

## Scope
- Moved former component/feature/route tests into module-scoped `__tests__` directories (history, settings, editor, projects, workspace).
- Added `src/test/utils/providers.tsx` to host shared `renderWithRouter` helpers consumed via the global setup entry.
- Trimmed the legacy `src/test/components`, `src/test/features`, and `src/test/routes` folders after migration.

## Integration Notes
- Tests continue to import application code via `@/modules/...` aliases; colocated placement improves IDE discovery and future refactors.
- Utility imports should now reference `@/test/utils` when shared helpers are required.

## Follow-ups
- Gradually adopt `renderWithRouter` in suites that currently redefine matchMedia or manual providers.
- Monitor module directories for additional helper extraction opportunities (e.g., wizard fixtures) as domains mature.
