# Sidebar Two Module System

This document explains how the modular sidebar system works and how to extend it safely. Every module runs through the shared registry so the layout can switch content based on routes, events, and long‑lived context.

## 1. Architecture Overview
- `LayoutSidebarTwo` renders modules supplied by the registry. It also handles width/visibility toggles and keeps header titles in sync with navigation events.
- `layout-store.ts` owns the registry slice (`sidebarTwoRegistry`) with definitions, active modules, sticky cache, and focus metadata.
- Module registration happens through hooks (for example `useRegisterCoreSidebarTwoModules`) that run exactly once per feature domain.
- Activation flows:
  - **Route scoped**: when the current `view` matches a definition’s `routes`.
  - **Event driven**: when a module’s `trigger.name` CustomEvent fires.
  - **Persistent**: modules marked `persist: true` remain visible across multiple views or move into cached state when hidden.
- Focus management: a module can set `focusTargetId` so the layout moves keyboard focus to that element after activation.

```
      [TanStack Router navigation]     [Custom Events]
                   |                         |
                   v                         v
          LayoutSidebarTwo <----> sidebarTwoRegistry state
                   |                         |
                   +--> renders active modules + dispatches focus
```

## 2. Registering a Module
Each module is described by a `SidebarTwoModuleDefinition`. Minimal example:

```ts
const myModuleDefinition: SidebarTwoModuleDefinition<MyPayload> = {
  id: "my-module",
  scope: "route",
  routes: ["dashboard"],
  loader: {
    kind: "component",
    component: MySidebarModule,
  },
  order: 10,
  persist: false,
  focusTargetId: "my-module-root",
};
```

### Steps
1. Create a module component accepting `SidebarTwoModuleProps<TPayload>`. Use `props.context` for view information and `props.deactivate` to remove yourself if needed.
2. Export the `SidebarTwoModuleDefinition`. Avoid side effects—modules can be lazy loaded.
3. Register the definition inside the relevant domain hook:
   ```ts
   const definitions: SidebarTwoModuleDefinition<unknown>[] = [
     myModuleDefinition as SidebarTwoModuleDefinition<unknown>,
   ];
   useEffect(() => {
     const store = layoutStore.getState();
     for (const definition of definitions) {
       store.registerSidebarTwoModule(definition);
     }
   }, [layoutStore]);
   ```
4. If you need one-off activation (for example in a view component), call `layoutStore.getState().activateSidebarTwoModule(...)`.

## 3. Route Activation
- Provide `scope: "route"` and a `routes` array. Each entry should match the `view` name dispatched via `app:navigate`.
- The layout effect automatically activates modules for the current view and clears previous route-scoped modules.
- Use `order` to control render sequencing when multiple modules share a view (lower numbers render first).

## 4. Event Handling
- Declare a `trigger` with `name` and optionally `allowedViews` plus `mapEvent`. Example:
  ```ts
  trigger: {
    name: "projects:selection",
    allowedViews: ["projects", "dashboard"],
    mapEvent: (event) => {
      const detail = event.detail as ProjectSelectionDetail;
      if (!detail || detail.count === 0) return { action: "deactivate" };
      return {
        payload: detail,
        view: detail.view ?? "projects",
        allowedViews: detail.allowedViews,
      };
    },
  }
  ```
- The event bridge listens once per event name. Modules should avoid registering their own window listeners.
- `action: "deactivate"` removes the module while preserving cache if `persist` is set.
- Use `dispatch...` helpers (for example `dispatchProjectSelection`) or create new ones that emit typed `CustomEvent`s.

## 5. Persistence & Caching
- `persist: true` keeps the module visible across view switches. When the view changes, the registry demotes the module into `stickyModules` with a snapshot.
- Implement `serialize` and `hydrate` if the payload is not JSON-friendly.
- `activateSidebarTwoModule({ sticky: true })` can promote transient modules into persistent state even if their definition does not set `persist`.
- LRU trimming (limit 5) prevents unbounded growth; pick concise payloads.

## 6. Accessibility Checklist
Follow the baseline checklist before registering a module:
1. Wrap content inside an element covered by `focusTargetId` when keyboard landing is required.
2. Provide visible focus styles (`focus-visible` classes) or rely on shared components with baked-in outlines.
3. Ensure button semantics use `<button>` (not `<div>`) and set `aria-pressed`, `aria-expanded`, etc., where relevant.
4. When announcing dynamic status, prefer `aria-live="polite"` on lightweight labels. Avoid `assertive` unless blocking action.
5. Keyboard interactions should honour standard commands (Space/Enter to activate, Escape to dismiss).
6. Test using axe, keyboard-only navigation, and a screen reader (NVDA or VoiceOver). Document findings in PRs when accessibility behaviour changes.

## 7. Styling & Theming
- Use shared sidebar CSS classes (`sidebar-two-button`, `sidebar-two-zone`, etc.) located under `src/app/shell/sidebar-two-content/css`.
- Respect theme tokens from `src/shared/styles/theme.css`. Do not hardcode colors.
- When introducing module-specific styles, scope them under a BEM-like prefix to avoid collisions.

## 8. Testing Guidance
- Unit-test pure helpers (payload mappers, serialization) with Vitest.
- For components, prefer Testing Library to render the module in isolation, mocking store interactions with `useLayoutStoreApi`.
- Verify event bridges using `fireEvent(new CustomEvent(...))` and assert dispatch counts.
- For persistent modules, add tests ensuring `hydrateSidebarTwoRegistry` restores cached entries.

## 9. Troubleshooting
- **Module never renders**: confirm `routes` or `trigger.name` matches actual events; log inside `mapEvent`.
- **Focus not moving**: ensure `focusTargetId` exists in the DOM and the element is focusable (`tabIndex={-1}` for wrappers).
- **Unexpected unmount**: check `clearSidebarTwoModules` filters—event-driven modules with `allowedViews` that exclude the current view will be dismissed.

## 10. Checklist for New Modules
- [ ] Definition exported with unique `id`.
- [ ] Registered in a domain hook or provider.
- [ ] Handles cleanup via `deactivate` when payload becomes invalid.
- [ ] Meets accessibility checklist.
- [ ] Tests cover key interactions.
- [ ] Documentation updated if new patterns introduced.

Following these conventions keeps the sidebar predictable, accessible, and easy to extend as new features arrive.

## Implementation Tasks
- [x] Review sidebar module architecture and project focus events to understand existing activation patterns.
- [x] Define project-focus sidebar module payload + activation strategy.
- [x] Implement project tab module component with navigation + dismissal behaviour.
- [x] Register module within project sidebar registration hook and wire event dispatch updates if needed.
- [x] Add automated coverage validating event mapping and module behaviour.
- [x] Align project tab styling with `sidebar-two-button` aesthetics using dedicated CSS module.
- [x] Integrate close affordance within the tab button and position module below route-scoped sidebar content.

## Progress Log
- Stage 1 (Planning): Reviewed plan document and overall sidebar module architecture to refresh constraints for implementing project-specific tabs.
- Stage 2 (Planning): Outlined implementation tasks and dependencies covering module payload, component work, registration, and testing.
- Stage 3 (Analysis): Inspected workspace/project open flow, layout store registry, and existing `FocusedProjectShortcut` component to reuse for the new module; confirmed `dispatchProjectFocus` payload suffices and noted need to handle `PROJECT_CLEAR_EVENT` for cleanup.
- Stage 4 (Design): Decided to introduce an event-driven, persistent module leveraging `FocusedProjectShortcut`, triggered by `PROJECT_FOCUS_EVENT`, with cleanup tied to `PROJECT_CLEAR_EVENT`; tab interactions will navigate via TanStack Router and queue workspace view resets before emitting `dispatchProjectClear`.
- Stage 5 (Risks): Noted key risks—ensuring repeated `PROJECT_FOCUS_EVENT` updates refresh payload without duplicating modules, keeping dismissal in sync with route transitions (`PROJECT_CLEAR_EVENT` coverage), and orchestrating close navigation without leaving stale focus state in the layout store.
- Stage 7 (Implementation): Added `ProjectFocusSidebarModule` with persistent event-scoped definition, navigation/dismissal handlers, and registry wiring; hooked into project module registration and verified behaviour with focused unit tests.
- Stage 8 (Verification): Ran targeted Vitest suite (`projectFocusModule.test.tsx`) confirming event mapping, navigation, dismissal, and cleanup paths succeed under mocked router/workspace conditions.
- Stage 9 (UI Polish): Restyled the tab with `sidebar-two-button`-aligned aesthetics via dedicated CSS, integrated the close control into the tab surface, and set module priority to render beneath route-driven content.
- Stage 10 (Validation): Confirmed updated layout via unit tests and ensured module registration honours visual stacking requirements.
- Stage 11 (Header UX): Adjusted `LayoutSidebarTwo` so the header stays on generic labels ("Project Workspace"/"Projects") instead of injecting project names when focus events fire.
- Stage 12 (Ordering): Prioritised route-driven sidebar modules ahead of event/manual entries to keep persistent project tabs anchored beneath active view content across navigation flows.
