# Projects Table Performance

Target: smooth interactions up to ~150–200 rows with 1.5s polling.

How to measure
- Build dev app and open the Projects page.
- Use Performance panel (Chromium) and record while:
  - Typing in global search (10 chars).
  - Toggling sort on Updated 5x.
  - Switching Status filter between values.
- Capture timings for scripting + rendering; aim < 50ms per interaction on modern hardware.

Implementation notes
- Table uses TanStack v8 row models and controlled state to avoid remounts.
- Fuzzy filter is global and debounced (250ms).
- No heavy date libs; Intl APIs used for formatting.
- Virtualization (react-virtual) is available if row counts exceed targets.

Tips if regressions found
- Memoize column defs and handlers; avoid recreating on every render.
- Consider narrowing global filter to applicable fields.
- Reduce re-renders by lifting state above polling effects (already done).

## 2025-02-23 Benchmark Snapshot
- Method: `PROJECT_MANAGER_TABLE_BENCHMARK=1 npm run test -- --run src/test/benchmarks/projectsTable.benchmark.test.tsx` (Vitest jsdom, Apple M2 Max, Node 22.12).
- Dataset: 250 synthetic `ProjectListItem` rows mirroring realistic metadata.
- Results (average of 2 runs):
  - Legacy table (`src/features/project-manager/ProjectManagerContent`): **~438ms** initial render.
  - v2 table (`src/features/project-manager-v2/content/ProjectManagerContent`): **~150ms** initial render.
- Observations: v2 delivers ~2.9× faster mount thanks to Suspense-friendly store + lean column metadata. A TanStack warning about the `updated` column appears in jsdom because the legacy table initialises sorting before columns mount; harmless in production but worth addressing if we port the benchmark to CI.
- Next steps: rerun after integrating virtualization or large datasets (>500 rows) and pipe metrics into release dashboards once E2E automation lands.
