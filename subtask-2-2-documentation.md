# Sub-task 2.2 Documentation — Effects & Async Flow Modernisation

Date: 2025-02-15

## Scope
Sub-task 2.2 covered the polling loop, async data loading, and dialog transitions in the React 19-ready view (`src/features/project-manager-v2/ProjectManagerView.tsx`).

## Implementation Notes
- Replaced the legacy `useCallback`-driven `loadProjects` helper with a plain `refreshProjects` function plus a `useRef` cache (`refreshProjectsRef`). This keeps the polling interval wired to the latest closure without `useEffectEvent`, avoiding stale state while remaining lint-compliant with current `@types/react`.
- Preserved spinner semantics by gating `setIsLoading` behind the `showSpinner` option, ensuring identical UX between initial load, manual refreshes, and background polling.
- Centralised error handling through `resolveErrorMessage`, providing deterministic copy for alert and toast flows while stripping unsafe `unknown` state mutations flagged by ESLint.
- Dialog transitions (`handleDeleteDialogOpenChange`, `handleAfterDelete`) now use direct inline handlers backed by the React Compiler, eliminating redundant memo hooks while preserving accessibility props.

## Behavioural Parity
- Polling interval remains 1500 ms with the same cleanup logic. Alerts and toasts reuse the exact copy from the legacy view.
- Project creation, deletion, and batch delete pathways invoke the new refresh pipeline, guaranteeing data parity with the previous implementation.

## Risks & Follow-ups
- When other tasks port the wizard and delete dialog into `project-manager-v2`, ensure their internal submit handlers continue to call the new `refreshProjects` helper instead of duplicating logic.
- Monitor Tauri IPC error surface for unexpected message formats; `resolveErrorMessage` currently assumes `Error` payloads but can be extended if IPC changes.

## Validation
- `npx eslint src/features/project-manager-v2/ProjectManagerView.tsx` (passes).

## Next Steps
Sub-task 2.3 will reconcile child component contracts and document interaction assumptions for downstream modernisation work.
