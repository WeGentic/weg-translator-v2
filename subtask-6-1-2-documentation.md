# Subtask 6.1.2 – Integration & QA Plan for Project Manager IPC Flows

## Objective
Plan how to validate that the React 19 `project-manager-v2` surface still exercises the production Tauri IPC commands (`list_projects`, `delete_project`, `create_project`) with the same behaviour as the legacy view. The goal is to combine a pragmatic automation path with a manual QA checklist so we can cover high-risk scenarios before release.

## Automation Strategy
1. **Playwright-driven E2E pass against the packaged Tauri app**
   - Use [`@playwright/test`] with the [Tauri driver launch recipe](https://v2.tauri.app/blog/tauri-20/#test-driver) to spin up the desktop build (`npm run tauri dev -- --target host`).
   - Configure a dedicated project in `playwright.config.ts` (`project-manager-v2`) that boots the feature flag by default (`process.env.VITE_FEATURE_PROJECT_MANAGER_V2 = "true"`).
   - Stub project data by pointing the app at a fixture database generated from the shipped migrations (for example, place a seeded SQLite file such as `scripts/fixtures/project-manager-v2-large.db` in the app config directory) so commands return deterministic rows.
   - Scenarios to automate:
     - Initial load renders 100-row request, table populates, and the footer counts match the DB.
     - Trigger the row action menu → delete flow; confirm confirmation dialog enforces name matching and the project disappears after IPC resolves.
     - Start the wizard via the “New Project” CTA; ensure the same command queue used by legacy flows is invoked (verify via log output or instrumentation described below).
     - Confirm polling re-renders rows when the backend DB changes mid-session (mutate fixture DB between polls).
   - Capture console output and command logs to assert that the IPC invocations complete without serialization errors (aligns with the [2024 Tauri IPC integration guidance](https://www.projectrules.ai/rules/tauri)).

2. **Rust-side integration smoke tests**
   - Extend `src-tauri/tests/db_integration.rs` with project-manager-specific cases: seed an in-memory SQLite database, call `list_projects` and `delete_project`, and assert the projections match the TypeScript expectations.
   - These tests ensure the backend contract remains stable even when frontend changes land, and they run quickly in CI.

3. **React testing-library harness with live IPC bridge (optional)**
   - Reuse the existing `ProjectManagerView.test.tsx` but replace mocks with the `@tauri-apps/api` testing bridge for a single scenario (happy-path load) to confirm the React view can talk to an actual command handler in a Node/Tauri test harness.
   - Only necessary if Playwright coverage is flaky; otherwise keep the test file mocked for determinism.

## Manual QA Checklist
Run after the automated suite or whenever we upgrade dependencies:
1. Launch the desktop app with `VITE_FEATURE_PROJECT_MANAGER_V2=true`.
2. **Data load & polling** – confirm the table populates within 2 seconds, then watch for refreshes every ~1.5 s (status badge timestamps should update when backend data changes).
3. **Error handling** – simulate a backend failure (disconnect the network or rename the DB file) and verify the destructive alert shows the IPC error message, then recovers once restored.
4. **Selection + sidebar sync** – select rows and confirm the sidebar contextual actions stay in sync; repeat after applying search/filter to ensure hidden rows are pruned.
5. **Delete flow** – attempt deletion with incorrect confirmation text (button stays disabled), then delete a project and confirm toast feedback plus row removal.
6. **Wizard flow** – open the wizard, progress through steps without saving, cancel to ensure state resets; then complete creation and confirm the new project appears after the spinner completes.
7. **Cross-session resilience** – close and reopen the app; the last known projects load without manual refresh, ensuring IPC state doesn’t leak across sessions.

## Instrumentation & Reporting
- Enable `tauri-plugin-log` in dev builds (already active) and pipe JSON logs to Playwright to assert specific command names appeared with `success` status.
- For Playwright runs, archive the log file + video for each scenario to feed into release notes.
- Add a `project-manager-v2` checklist entry to the release QA template so the manual cases are always executed.

## Next Steps
- Stand up the Playwright project scaffold and seed fixture DB (tracked under Task 6 automation follow-up).
- Align with backend owners on fixture data expectations to keep IPC contracts in sync.
- Schedule the first cross-platform (macOS + Windows) manual run before the RC build.
