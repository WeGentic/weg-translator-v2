# Subtask 6.2.1 – Render Timing Metrics Plan

## Objective
Identify the metrics and profiling workflow needed to compare `project-manager` (legacy) and `project-manager-v2` render performance when the list contains hundreds of projects and the polling loop is active.

## Target Metrics
- **Initial mount duration** – time from navigation to the view until the first table paint completes.
- **Subsequent render duration** – React commit time when polling refreshes the dataset.
- **Frame rate stability** – drop in frames (jank) while scrolling a 500+ row table.
- **Memory footprint** – resident set size (RSS) of the frontend process immediately after mount and after 5 minutes of polling.

## Tooling
- **React Profiler API (`Profiler` + DevTools)** – capture `actualDuration` and `baseDuration` for the table subtree (per [React 19 compiler guidance](https://www.technaureus.com/blog-detail/react-19-compiler-explained-faster-smarter-smoothe)).
- **Chrome DevTools Performance panel** – record WebView sessions, mark navigation start, and export the trace for comparison (applicable because Tauri embeds Chromium).
- **Tauri process metrics** – use `tauri::async_runtime::spawn(async move { app_handle.tracker().memory_usage() })` debug hook during perf builds to log memory snapshots, or read the OS-level process stats (Activity Monitor / Task Manager) at timed checkpoints.

## Dataset Preparation
1. Run migrations normally by launching the app once.
2. Seed a large dataset by executing a SQL script (to be added under `scripts/perf-seeds/seed_projects.sql`) against the app config DB (e.g. `sqlite3 ~/Library/Application Support/WegTranslator/weg_translator.db ".read scripts/perf-seeds/seed_projects.sql"`). The script should insert ~1000 projects with varied statuses and timestamps to match real-world distribution.
3. Restart the app so both legacy and v2 views load identical data.

## Measurement Procedure
1. **Baseline (legacy)**
   - Launch with `VITE_FEATURE_PROJECT_MANAGER_V2=false` and open the existing project manager.
   - Start DevTools Performance recording, interact with the table (scroll, open dialogs), then stop after one polling cycle.
   - Export the `.json` trace and note key timings (first paint, largest commit duration).
2. **Modernized view**
   - Launch with `VITE_FEATURE_PROJECT_MANAGER_V2=true` and repeat the same flow.
   - Record React Profiler flame chart focusing on `ProjectManagerView` and `ProjectsTableGrid`.
3. **Comparison**
   - Log the following for each run: initial mount duration, 90th percentile commit duration across 10 polling ticks, average FPS while scrolling, peak RSS.
   - Store the results in `docs/perf/project-manager-v2-metrics.csv` (new file) to track regressions across releases.

## Acceptance Bar
- React 19 view should not exceed legacy initial mount time by more than 10%.
- Polling commit duration should stay under 50 ms with a 100-row payload and under 120 ms with the 1000-row stress dataset.
- No more than 5% frame drop (measured via DevTools FPS meter) during scroll.
- Memory growth after 5 minutes must stay within ±10 MB of the legacy implementation.

## Follow-up
- Automate the measurement script with Playwright’s `tracing.start({ screenshots: true })` once the E2E harness lands (ties into Step 6.1.2).
- Re-run the comparison whenever we upgrade React Compiler or change list rendering internals.
