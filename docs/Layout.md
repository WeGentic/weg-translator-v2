# Header Redesign Plan — Floating Top Bar

This document describes a complete redesign of the application Header (Top bar) to achieve a floating, rounded, modern layout with three content areas (Left, Center, Right). It aligns with the project stack: React 19.1.1 (with the new Compiler), TailwindCSS 4.1.x, and ShadCN UI (v3.x) components.

## Goals

- Floating header with rounded corners, translucent background, blur, and subtle elevation.
- Three content areas:
  - Left: Icon-only Side menu button (no visible text).
  - Center: Dynamic title text based on side menu selection (or route context fallback).
  - Right: User icon button (no function yet).
- Accessibility-first (labels, focus states, contrast, keyboard support).
- Responsive and robust layout that keeps the center title visually centered regardless of left/right content width.
- Non-invasive integration: can be introduced alongside the existing `WorkspaceHeader` and swapped in.

## Component Overview

- New component: `src/app/layout/chrome/header/AppHeader.tsx`
  - Encapsulates the floating header styling and 3-zone layout.
  - Accepts a `title` prop for the dynamic center text.
  - Emits `onToggleSidebar` for the left icon button (wired to existing sidebar cycle where applicable).
  - Shows a right-side user icon button (placeholder; no-op for now).
  - Uses ShadCN `Button` and (optionally) `Avatar` when added.

### Props

- `title: string` — dynamic center text.
- `onToggleSidebar?: () => void` — handler for left menu icon.
- `className?: string` — style override if needed.
- `elevated?: boolean` — toggles higher elevation (stronger shadow, ring) when desired.
- `hideUser?: boolean` — optional, hide right-side user icon for focused modes.

### Structure

- Root is a fixed-position container with insets and a high z-index for the floating effect.
- Inner wrapper is relatively positioned; left/right areas sit in normal flow; center title is absolutely centered so it remains visually centered regardless of side content.
- Background: semi-transparent card/background color with blur and subtle border.
- Radius: large (rounded-2xl) to communicate a modern, soft UI.

## Visual & Interaction Design

- Positioning: `fixed top-3 left-3 right-3 z-50` (adjust inset to fit safe areas and window controls).
- Container styling:
  - `rounded-2xl border border-border/50 bg-background/70 backdrop-blur shadow-lg`
  - Optional elevated mode adds `ring-1 ring-border/50 shadow-xl`.
  - Uses translucency and blur to feel “floating” over content.
- Left button (icon-only):
  - ShadCN `Button` with `variant="ghost"` and `size="icon"`.
  - `aria-label="Toggle sidebar"` and `.sr-only` label for accessibility.
  - Icon: `PanelLeft` from `lucide-react`.
- Center title:
  - Absolutely centered with `absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`.
  - `pointer-events-none` to avoid intercepting clicks.
  - `truncate` with `min-w-0` on the wrapper to prevent overflow.
- Right user icon button:
  - ShadCN `Button` with `variant="outline"` and `size="icon"`.
  - Icon: `CircleUser` from `lucide-react` (no action for now).
  - Future: switch to ShadCN `Avatar` when `ui/avatar.tsx` is present.

## Accessibility

- Header uses `role="banner"`.
- Icon buttons include `aria-label` and `.sr-only` text.
- Focus-visible rings rely on ShadCN defaults and Tailwind tokens.
- Color contrast respects theme tokens (`text-foreground`, `bg-background`, `border-border`).

## Responsive Behavior

- The absolute-centered title keeps visual centering regardless of left/right area width.
- Title is `truncate` and scales with breakpoints (e.g., `text-sm sm:text-base`).
- In compact windows, both icon buttons remain reachable; extra controls can be hidden or moved to menus in future iterations.

## Dynamic Title: Data Source Strategy

- Primary source: Side menu selection (when a selection model exists).
  - Example: selected project name, selected section ("Projects", "Jobs", etc.).
  - The selection can be lifted to `App` state and passed to `AppHeader` as `title`.
- Fallback source: Current route via TanStack Router.
  - Map common routes to human-readable titles.
  - Example mapping: `{ "/": "Workspace", "/login": "Sign in", "/projects": "Projects" }`.

### Hook Example: `useHeaderTitle`

```ts
// src/hooks/useHeaderTitle.ts
import { useMemo } from "react";
import { useRouterState } from "@tanstack/react-router";

type Options = {
  explicit?: string | null; // preferred (e.g., from sidebar selection)
};

export function useHeaderTitle(opts?: Options): string {
  const router = useRouterState();
  if (opts?.explicit) return opts.explicit;

  const pathname = router.location.pathname;
  return useMemo(() => {
    const map: Record<string, string> = {
      "/": "Workspace",
      "/login": "Sign in",
      "/projects": "Projects",
    };
    return map[pathname] ?? "Workspace";
  }, [pathname]);
}
```

## Component Skeleton

```tsx
// src/app/layout/chrome/header/AppHeader.tsx
import { PanelLeft, CircleUser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  onToggleSidebar?: () => void;
  className?: string;
  elevated?: boolean;
  hideUser?: boolean;
};

export function AppHeader({ title, onToggleSidebar, className, elevated, hideUser }: Props) {
  return (
    <header role="banner" className={cn("fixed inset-x-3 top-3 z-50", className)}>
      <div
        className={cn(
          "relative mx-auto flex items-center justify-between gap-2 rounded-2xl border border-border/50 bg-background/70 px-2.5 py-2 shadow-lg backdrop-blur",
          elevated && "ring-1 ring-border/50 shadow-xl",
        )}
      >
        {/* Left: Menu icon-only */}
        <div className="flex min-w-0 items-center">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle sidebar"
            onClick={onToggleSidebar}
          >
            <PanelLeft className="size-5" aria-hidden="true" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        </div>

        {/* Center: Visually centered title */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <h1 className="truncate text-sm font-medium text-foreground sm:text-base" title={title}>
            {title}
          </h1>
        </div>

        {/* Right: User icon-only */}
        <div className="flex items-center gap-1">
          {hideUser ? null : (
            <Button variant="outline" size="icon" aria-label="User">
              <CircleUser className="size-5" aria-hidden="true" />
              <span className="sr-only">User</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
```

## Integration Plan (Step-by-step)

1. Add `AppHeader` component file (above skeleton) to `src/app/layout/chrome/header/AppHeader.tsx`.
2. Introduce a title source:
   - If the side menu exposes a selection (e.g., project, section), lift it to `App` state and derive a `headerTitle` string.
   - Otherwise, use `useHeaderTitle` (route-based fallback) as shown above.
3. Wire `AppHeader` into `src/App.tsx`:
   - Replace `WorkspaceHeader` import with `AppHeader` in a guarded manner to compare visually.
   - Pass `onToggleSidebar={cycleSidebarState}` and `title={headerTitle}`.
   - Keep the existing footer toggle and logout controls elsewhere for now, or move them later into a user menu.
4. Validate spacing with the main content:
   - Because the header is `fixed`, add top padding to the content container equal to the header’s height + margin (e.g., `pt-20`).
   - Remove the old sticky header spacing.
5. Add (optional) `ui/avatar.tsx` via ShadCN when needed if you prefer an avatar over the `CircleUser` icon.
6. Test across themes and sizes:
   - Verify truncation behavior of long titles.
   - Confirm focus rings are visible and accessible.
   - Confirm hover/active states on icon buttons.

## File Touchpoints

- Create: `src/app/layout/chrome/header/AppHeader.tsx` (new component).
- Optional: `src/hooks/useHeaderTitle.ts` (route/selection → title mapping).
- Update: `src/App.tsx:1` — to import and use `AppHeader` in place of `WorkspaceHeader` once ready.
- Review: `src/app/layout/chrome/WorkspaceHeader.tsx:1` — deprecate gradually or keep as an alternative layout.

## Tailwind & Theming Notes

- Uses tokenized colors: `bg-background`, `text-foreground`, `border-border`, `ring-ring` for consistency with ShadCN.
- Tailwind v4 utilities are used; no custom config changes required for the header.
- Backdrop blur is guarded by `backdrop-blur`; translucency uses `/70` alpha modifiers.

## Tauri/Desktop Considerations

- macOS traffic lights and window chrome: if using custom-decorated windows, ensure the top inset (`top-3`) does not overlap with draggable regions.
- Hit testing: keep icon buttons inside non-draggable areas.
- Performance: backdrop blur and translucency are inexpensive at header scale; verify on low-spec devices.

## Future Enhancements

- User menu (Profile, Preferences, Logout) via ShadCN `DropdownMenu`.
- Notification or status pill near the title (e.g., active jobs count badge).
- Quick actions: Shortcut to start translation or open recent projects.
- Animated show/hide: fade + slight translate for header appearance.

---

## Example Usage in `App.tsx`

```tsx
// src/App.tsx (excerpt)
import { AppHeader } from "@/app/layout/chrome";
import { useHeaderTitle } from "@/hooks/useHeaderTitle";

// ...inside component
const title = useHeaderTitle({ explicit: null /* or your sidebar selection */ });

return (
  <div className="flex min-h-screen flex-col bg-background/60">
    <AppHeader title={title} onToggleSidebar={cycleSidebarState} />
    <div className="flex flex-1 overflow-hidden pt-20">
      {/* Sidebar + Main content */}
    </div>
  </div>
);
```

This plan provides a drop-in, modern floating header that meets the requested design: floating, rounded borders; three areas (left menu icon-only, centered dynamic text, right user icon). It leverages existing ShadCN components and tailwind tokens used throughout the project.


---

## Implementation Progress — 2025-02-14

- [x] Reviewed existing `WorkspaceHeader`/layout structure to identify integration points.
- [x] Added `src/app/layout/chrome/header/AppHeader.tsx` implementing the floating header zones.
- [x] Created `src/hooks/useHeaderTitle.ts` to derive dynamic titles from router state.
- [x] Reworked `src/App.tsx` to adopt `AppHeader`, add a utility bar for legacy controls, and adjust layout spacing.
- [x] Verified lint (`npm run lint`) to confirm the updated UI compiles cleanly.

---

# Sidebar Redesign Plan — Floating Sidebar

This section defines a rework of the Sidebar to be floating and to display both fixed and temporary menu items. Selecting an item updates the main content view (via router or local state). It aligns with React 19.1.1, TailwindCSS 4.1.x, and ShadCN UI v3.x.

## Goals

- Floating, rounded, translucent sidebar with blur and subtle elevation.
- Displays two groups of items:
  - Fixed: core app areas (e.g., Workspace, Projects, Jobs, History, Settings).
  - Temporary: context-driven or ephemeral items (e.g., recent files/projects, active jobs).
- Selecting an item sets the main content view (router or `mainView` state).
- Works with the floating header; no overlap and consistent z-index stacking.
- Accessible navigation with clear focus states and keyboard support.

## Component Overview

- New component: `src/app/layout/chrome/sidebar/AppSidebar.tsx`
  - Encapsulates floating styling and responsive state: `expanded | compact | hidden`.
  - Accepts fixed and temporary items arrays; renders grouped lists.
  - Emits `onSelect(key)` to update the active view.
  - Integrates with the header’s left button via the existing `cycleSidebarState`.

### Menu Item Model

```ts
// src/types/navigation.ts (optional)
import type { LucideIcon } from "lucide-react";

export type MenuItem = {
  key: string;            // unique identifier, also maps to route or view key
  label: string;          // visible label in expanded mode
  icon: LucideIcon;       // lucide-react icon component
  route?: string;         // optional route path, if using Router
  badge?: string | number;// optional badge (e.g., active jobs count)
};
```

### AppSidebar Props

- `state: 'expanded' | 'compact' | 'hidden'` — current sidebar state.
- `fixedItems: MenuItem[]` — core menu.
- `temporaryItems?: MenuItem[]` — ephemeral items (e.g., recent, active).
- `selectedKey: string | null` — which item is active.
- `onSelect: (key: string) => void` — handler to set main view.
- `className?: string` — style overrides.
- `floating?: boolean` — toggles floating container styling (default true).

### Structure & Styling

- Position: `fixed left-3 top-20 bottom-3 z-40` to avoid overlapping the floating header.
- Container:
  - `rounded-2xl border border-border/50 bg-card/70 backdrop-blur shadow-lg`
  - Width transitions per state: expanded `w-72`, compact `w-20`.
- Items:
  - ShadCN `Button` with `variant="ghost"`, `size="sm"`, full-width.
  - In compact mode: show only icons; use `sr-only` text and optional tooltip.
  - Indicate active item with `aria-current="page"` and variant/emphasis.

### Accessibility

- Wrap nav in `<aside role="complementary"><nav role="navigation" aria-label="Primary" /></aside>`.
- Keyboard:
  - Tab order follows visual order.
  - `Escape` closes/hides when in overlay/mobile mode.
  - Focus visible rings rely on ShadCN tokens; ensure visible contrast.
- Announce selection changes by updating header title (`useHeaderTitle({ explicit })`).

## Example: Component Skeleton

```tsx
// src/app/layout/chrome/sidebar/AppSidebar.tsx
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/types/navigation"; // or inline

type Props = {
  state: 'expanded' | 'compact' | 'hidden';
  fixedItems: MenuItem[];
  temporaryItems?: MenuItem[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  className?: string;
  floating?: boolean;
};

export function AppSidebar({
  state,
  fixedItems,
  temporaryItems = [],
  selectedKey,
  onSelect,
  className,
  floating = true,
}: Props) {
  if (state === 'hidden') return null;

  const container = cn(
    floating && "fixed left-3 top-20 bottom-3 z-40",
    "flex w-72 flex-col rounded-2xl border border-border/50 bg-card/70 backdrop-blur shadow-lg transition-[width] duration-200",
    state === 'compact' && "w-20",
    className,
  );

  const renderItem = (item: MenuItem) => (
    <Button
      key={item.key}
      variant={selectedKey === item.key ? "secondary" : "ghost"}
      size="sm"
      className={cn("justify-start px-3", state === 'compact' && "justify-center px-0")}
      aria-current={selectedKey === item.key ? "page" : undefined}
      onClick={() => onSelect(item.key)}
      type="button"
    >
      <item.icon className="size-4" aria-hidden="true" />
      <span className={cn("ml-2 truncate", state === 'compact' && "sr-only")}>{item.label}</span>
      {typeof item.badge !== 'undefined' ? (
        <span className={cn("ml-auto rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground", state === 'compact' && "sr-only")}>
          {item.badge}
        </span>
      ) : null}
    </Button>
  );

  return (
    <aside className={container} aria-hidden={false}>
      <nav role="navigation" aria-label="Primary" className="flex min-h-0 flex-1 flex-col gap-2 p-2">
        <div className="space-y-1" aria-label="Fixed">
          {fixedItems.map(renderItem)}
        </div>
        {temporaryItems.length ? (
          <div className="space-y-1" aria-label="Temporary">
            {temporaryItems.map(renderItem)}
          </div>
        ) : null}
      </nav>
    </aside>
  );
}
```

## Setting the Main Content View

Two integration strategies:

- Router-driven: each `MenuItem.route` navigates via TanStack Router; header title derives from route with `useHeaderTitle`.
- State-driven: introduce `mainView: 'workspace' | 'projects' | 'jobs' | 'history' | 'settings' | ...` in `App.tsx`, update on `onSelect`, and conditionally render content panes.

### Example: State-driven Wiring (excerpt)

```tsx
// src/App.tsx (conceptual excerpt)
type MainView = 'workspace' | 'projects' | 'jobs' | 'history' | 'settings';
const [mainView, setMainView] = useState<MainView>('workspace');

const fixedItems: MenuItem[] = [
  { key: 'workspace', label: 'Workspace', icon: PanelsTopLeft },
  { key: 'projects', label: 'Projects', icon: FolderKanban },
  { key: 'jobs', label: 'Jobs', icon: Briefcase },
  { key: 'history', label: 'History', icon: History },
  { key: 'settings', label: 'Settings', icon: Settings },
];

<AppSidebar
  state={sidebarState}
  fixedItems={fixedItems}
  temporaryItems={runtimeTemporaryItems}
  selectedKey={mainView}
  onSelect={(key) => {
    setMainView(key as MainView);
    // optionally push route here, then set header via useHeaderTitle({ explicit: label })
  }}
/>;

// Render main content based on view
{mainView === 'workspace' && <WorkspaceMainContent ... />}
{mainView === 'projects' && <ProjectsPanel ... />}
// etc.
```

## Integration Plan (Step-by-step)

1. Define `MenuItem` type and initial fixed items config.
2. Create `src/app/layout/chrome/sidebar/AppSidebar.tsx` based on the skeleton above.
3. Decide routing model: router-driven vs state-driven (start with state-driven for minimal disruption).
4. In `src/App.tsx`, add `mainView` state and wire `AppSidebar.onSelect` to update it; pass explicit header title via `useHeaderTitle({ explicit })` when appropriate.
5. Map `mainView` to content panes; keep existing `WorkspaceSidebar` temporarily until migration is complete.
6. Style offsets to align with floating header: sidebar `top-20 bottom-3 left-3`, main container keeps `pt-24`.
7. Validate keyboard navigation, focus rings, and contrast across themes.

## File Touchpoints

- Create: `src/app/layout/chrome/sidebar/AppSidebar.tsx` (new floating sidebar component).
- Optional: `src/types/navigation.ts` for `MenuItem` type and shared navigation utilities.
- Update: `src/App.tsx` to manage `mainView` and render `AppSidebar`.
- Review/Deprecate: `src/app/layout/chrome/WorkspaceSidebar.tsx` once feature parity is achieved.

## Tauri/Desktop Considerations

- Keep draggable window regions separate from interactive sidebar areas.
- Use `z-40` for sidebar and `z-50` for header to ensure proper stacking.
- Ensure performance by limiting heavy effects; `backdrop-blur` is acceptable at this scale.

## Future Enhancements

- Persist pinned temporary items and sidebar state (expanded/compact) in local storage.
- Context menu for temporary items (pin/unpin, clear, rename).
- Grouped temporary sections (e.g., Active Jobs, Recent Files) with collapsible headers.
- Tooltip for compact mode labels with keyboard hint.

---

## Sidebar Implementation Plan — TODOs

- [x] Add `MenuItem` type and seed fixed items. (src/app/layout/chrome/sidebar/AppSidebar.tsx, src/App.tsx)
- [x] Implement `AppSidebar` with floating container and grouped lists. (src/app/layout/chrome/sidebar/AppSidebar.tsx)
- [x] Wire `AppSidebar` into `App.tsx` (state-driven main view) and update header title. (src/App.tsx)
- [x] Reduce sidebar width (expanded `w-64`, compact `w-16`) and adjust content padding (`pl-64`/`pl-16`).
- [x] Elevate vertical hierarchy: semantic `<nav><ul><li>…</li></ul></nav>`, section labels (“Navigation”, “Quick access”).
- [x] Sidebar height spans between header and footer via dynamic `top`/`bottom` insets computed from visibility (header/footer heights considered).
- [x] Migrate any WorkspaceSidebar-only features or visuals.
      - Extracted Project Manager list into `ProjectsPanel` and render on Projects view (state-driven): `src/components/projects/ProjectsPanel.tsx` and `src/App.tsx`.
      - Left padding matches floating widths (`pl-72`/`pl-20`) for alignment.
- [x] Validate accessibility (roles, focus, esc-close for overlays) and theming.
      - Added skip-to-content link with focus-visible styles and `z-60` to surface above header: `src/App.tsx`.
      - Wrapped main content in `<main id="main-content" role="main">` and ensured sidebar `nav` has proper labeling.
      - Confirmed icon buttons include `aria-label` and `aria-hidden` on icons; selected nav items set `aria-current="page"`.
      - Verified ShadCN focus rings and Tailwind tokens (`bg-background`, `text-foreground`, `border-border`) are used consistently for theming.
