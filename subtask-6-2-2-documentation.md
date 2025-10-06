# Subtask 6.2.2 – Polling Stability & Memory Checklist

## Objective
Outline the runtime checks needed to ensure the 1.5 s polling loop remains stable and that removing manual memoization has not introduced memory leaks or runaway state growth in the React 19 implementation.

## Polling Stability Plan
- **Timer verification** – instrument the renderer in a diagnostic build by wrapping `window.setInterval` to log timestamps for each tick; assert deviation stays within ±50 ms across 5 minutes (per [Tauri IPC best-practice testing guidance](https://www.projectrules.ai/rules/tauri)).
- **Back-pressure handling** – during Playwright E2E runs, mutate the database mid-refresh to confirm the UI gracefully handles overlapping refreshes (no queued duplicate intervals, no dropped promise rejections).
- **Visibility throttling** – toggle the window between foreground/background and check that the interval resumes immediately on focus (Chromium can throttle background tabs; watching the log ensures we are resilient).

## Memory Observation Plan
- **React DevTools heap snapshots** – capture heap snapshots before enabling `project-manager-v2`, after 5 minutes of polling with active filters, and after navigating away/back. Compare retained components to ensure sets/arrays are released.
- **OS-level monitoring** – record RSS every minute via `ps -o rss= -p <pid>` (macOS/Linux) or Task Manager’s “Memory (Active)” column on Windows. Target: delta < 8 MB across 10 minutes.
- **Wizard stress test** – repeatedly open/close the Create Project wizard during polling and observe that memory returns to baseline, confirming modal state cleanup still works without manual memoization.

## Regression Gate
- Investigate if jitter exceeds ±10% of the 1500 ms schedule or if memory ramps up monotonically across 10 minutes.
- File follow-up task to introduce guardrails (e.g., abort controllers on refresh promises, explicit `useEffect` cleanup) if thresholds are breached.

## Reporting
- Record findings beside timing metrics in `docs/perf/project-manager-v2-metrics.csv` and annotate any anomalies in the release QA log.
- Attach heap snapshots and timer logs to the Playwright artefacts for traceability.
