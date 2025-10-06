# Sub-task 1.2 – Rollback Strategy

_Date: 2025-02-15_

## Objectives
- Guarantee we can disable the v2 Project Manager instantly without rebuilding the app.
- Ensure a clear path to revert the packaged desktop app if the v2 rollout causes systemic regressions.
- Protect user data and layout state from corruption when toggling between legacy and v2 implementations.

## Layered Rollback Plan

1. **Feature-Flag Kill Switch**
   - Flag name: `projectManagerV2` (exposed via `isProjectManagerV2Enabled()` in `src/lib/feature-flags.ts`).
   - Source of truth: remote config JSON fetched at startup (to be wired in Task 5.2) with a build-time fallback using `VITE_FEATURE_PROJECT_MANAGER_V2`.
   - Action: flip the flag to `false` to immediately fall back to the legacy `ProjectManagerView` without shipping a new binary. Flag fetch interval should be capped at 5 minutes to balance responsiveness with network usage.

2. **Gradual Exposure Guardrails**
   - Ship the flag disabled by default; enable for internal QA cohorts first by distributing a signed config file alongside canary builds.
   - Maintain observability dashboards (errors, IPC failure rates, Suspense boundary fallbacks) segmented by flag status. Any regression above agreed thresholds triggers an automatic flag disable.

3. **Application Rollback (Tauri Updater)**
   - Package every release with the `tauri-plugin-updater` manifest, including a download URL for the previous stable version.
   - If disabling the flag is insufficient (e.g., shared store migrations fail), publish a rollback `weg-translator` bundle labelled as a "downgrade" on the update server. Clients will install the prior build on next update check.
   - Keep migrations reversible: persist schema bump scripts alongside down-migration stubs so the updater can run them during rollback. For settings stored in YAML, capture a snapshot before enabling v2-specific fields.

4. **Data Integrity Steps**
   - New stores introduced for v2 must gate their persistence by the same feature flag to avoid writing incompatible state when the flag is off.
   - When promoting v2, write dual-format artefacts (legacy + v2) for one release cycle. This ensures the legacy module can continue to read data if we revert.

5. **Communication & Monitoring**
   - Expose a diagnostic banner in the settings panel when the client is running with the v2 flag disabled due to a server override.
   - Log flag transitions and updater invocations through `tauri-plugin-log` so support can audit rollback events.

## Verification Checklist
- [ ] Toggle the flag off in development and confirm `WorkspacePage` swaps back to the legacy view without reload.
- [ ] Validate that disabling the flag leaves newly copied assets (`project-manager-v2/styles/*`) unloaded to prevent CSS bleed.
- [ ] Test updater-driven rollback on macOS and Windows by publishing a mock "previous" build and ensuring user settings remain intact.
- [ ] Confirm that database migrations introduced for v2 are no-ops when the flag is off and reversible when rolling back the binary.

This plan ensures a two-tier rollback mechanism (flag-level and binary-level) so the v2 Project Manager can be shipped safely while we iterate on Tasks 2–4.
