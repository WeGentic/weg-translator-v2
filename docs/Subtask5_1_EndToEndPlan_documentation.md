# Subtask 5.1.3 — End-to-End Scenario Plan (2025-02-23)

## Objectives
- Validate that the project creation wizard and deletion flows succeed in a production-like Tauri 2.8.5 + React 19.1.1 runtime.
- Exercise optimistic cache updates, Suspense-driven reloads, and TanStack selection state under real IPC.
- Provide a repeatable plan that QA can automate with Playwright while supporting manual smoke runs before toggling v2 live.

## Tooling & Environment Strategy
- Use Playwright 1.44+ with the `@tauri-apps/cli` test runner shim to launch the desktop bundle; aligns with 2024–2025 community guidance for Tauri UI E2E coverage.
- Configure Playwright to attach to the Tauri dev server via `npx tauri dev -- --e2e`, passing a `TAURI_ENV=test` flag so the backend swaps to a temp app dir (`$TMPDIR/weg-translator-e2e`). `DbManager::new_with_base_dir` already accepts an arbitrary path, so we only need to expose an env override (see Next Steps).
- Ship deterministic fixtures under `tests/e2e/fixtures/` (wizard sample files, YAML settings) copied into the temp app dir before each run; clean up between scenarios to keep state isolated.
- Capture JSON logs streamed via `tauri-plugin-log` by wiring Playwright’s `page.on("console")` to persist artifacts (helps debug IPC failures).

## Scenario Matrix
| ID | Scenario | Pre-conditions | Steps | Expected Results |
| --- | --- | --- | --- | --- |
| PM-E2E-01 | Create project via wizard | Fresh app dir, no projects | Launch app → open “New project” → complete details (name "Smoke Project", OFF file upload stub, EN→DE languages) → submit | Wizard closes, toast "Project created" appears, new row surfaces at top with status "pending", TanStack selection empty |
| PM-E2E-02 | Create + open project | Existing project from PM-E2E-01 | From table row menu choose “Open project” | Tauri navigation event fires, sidebar badge updates to active file count, backend confirms project dir exists |
| PM-E2E-03 | Single delete | At least one project (non-optimistic) | Trigger row action “Delete” → confirm dialog | Row disappears, toast "deleted" copy shown, DB row removed (verify via IPC `listProjects` response), Suspense boundary resettles without error |
| PM-E2E-04 | Batch delete multi-select | 3 projects present | Use header checkbox to select all → open batch panel → confirm delete | Selection clears, all rows gone, sidebar metrics reset, projects resource refetch completes, DB empty |
| PM-E2E-05 | Wizard retry after IPC error | Backend stub forces `createProject` failure (disable network) | Submit wizard while failure flag set → server returns error → clear flag → resubmit | First attempt shows destructive toast, wizard remains open with errors; second attempt succeeds and row appears |
| PM-E2E-06 | Legacy fallback toggle smoke | Feature flag allows switching to legacy view | Toggle feature flag (via settings stub or IPC) → ensure legacy module renders → toggle back → ensure v2 still lists projects | Guarantees rollout switch is non-destructive and state perseveres |

## Observability & Diagnostics
- Enable Playwright trace + screenshot capture for each scenario; store artifacts in `tests/e2e/artifacts/<scenario-id>/` for CI download.
- Attach backend structured logs to the same folder; correlate by scenario ID to help triage IPC or DB races.
- Measure create/delete latency by reading timestamps from logs to build baseline metrics (< 2s from action to table refresh). Feed numbers into Step 5.2.3 benchmarks.

## Implementation Notes & Dependencies
- Requires exposing a `WTA_TEST_APP_DIR` env variable consumed by the Tauri bootstrap before `DbManager::new_with_base_dir`, plus a CLI flag to toggle it in CI.
- Need Playwright page objects covering the project shell (toolbar, wizard, table row actions) so selectors stay resilient to future refactors.
- Integrate into CI via `npm run e2e:projects` executed on macOS + Windows runners; gate releases on scenarios PM-E2E-01 → PM-E2E-04.

## Next Steps
1. Add backend env override (feature-toggle aware) to direct the SQLite base dir and project artifacts into a temp location.
2. Scaffold Playwright project under `tests/e2e/project-manager/` with shared fixtures and utility hooks for IPC orchestration.
3. Implement page objects + scenario specs per matrix above, wiring failure hooks to collect logs/artifacts automatically.
4. Document test execution in the QA playbook and integrate into release pipelines.
