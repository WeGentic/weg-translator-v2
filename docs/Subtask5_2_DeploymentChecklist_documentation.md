# Subtask 5.2.2 — Deployment & Toggle Checklist (2025-02-23)

## Pre-flight Validation
- Confirm `isProjectManagerV2Enabled()` reads the remote JSON config and falls back to `VITE_FEATURE_PROJECT_MANAGER_V2` when offline. Dry-run by forcing the flag off and verifying the legacy module renders without a reload.
- Run targeted QA suite: `npm run test -- --run src/test/features/project-manager-v2/**` plus the new benchmark harness (set `PROJECT_MANAGER_TABLE_BENCHMARK=1`) to ensure table render times stay within tolerance.
- Execute the Step 5.1.3 E2E scenarios (PM-E2E-01 → PM-E2E-04) against a staging build with a fresh SQLite base dir to ensure create/delete flows succeed under real IPC.

## Rollout Steps
1. **Stage Build** — Package a release candidate with the v2 flag disabled by default. Publish to internal QA via auto-updater channels.
2. **Enable for QA Cohort** — Distribute a signed remote-config file toggling `projectManagerV2` to `true` for QA client IDs. Monitor logs for Suspense errors, IPC failures, and project list anomalies.
3. **Progressive Enablement** — Gradually expand rollout (10% → 50% → 100%) using remote config targeting. After each step, validate telemetry dashboards (error rate, average create/delete latency, selection store warnings).
4. **Flip Default** — Once stable, update build-time fallback (`VITE_FEATURE_PROJECT_MANAGER_V2=true`) so new installs see v2 immediately, while keeping the remote flag available for emergency shutdowns.

## Fallback & Rollback
- **Instant Disable** — Flip the remote flag to `false`; clients revert to the legacy module on next config poll (<5 minutes). Ensure optimistic caches clear by calling `invalidateProjectsResource` when the flag changes.
- **Binary Rollback** — If deeper issues surface (e.g., schema drift), publish the previous signed build via `tauri-plugin-updater`. Maintain reversible SQL migrations and YAML setting snapshots to avoid data loss during downgrades.
- **Communication** — Surface a settings banner when the remote flag forces legacy mode, and log all flag transitions through `tauri-plugin-log` for support traceability.

## Post-Deployment Checklist
- Capture metrics for Step 5.2.3 (render latency, CPU spikes) 24h after full rollout and compare to legacy baselines.
- Update QA playbook and onboarding docs with final toggle state so contributors understand the active default.
- Schedule a follow-up audit to remove dead legacy code once telemetry stays green for two release cycles.
