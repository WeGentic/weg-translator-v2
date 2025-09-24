# Layout System Usage

This note documents how to adopt the shared layout primitives that back the new React 19 + TanStack Router shell.

## Per-route staticData

Use `staticData.layout` on each route module to express the chrome configuration. Values cascade from parent to child routes, so override only what you need.

```tsx
// src/routes/index.tsx
export const Route = createFileRoute("/")({
  staticData: {
    layout: {
      header: true,
      footer: true,
      sidemenu: "expanded",
      background: { kind: "default" },
    },
  },
  component: WorkspacePage,
});
```

When nothing is provided the layout falls back to header + footer visible, an expanded sidebar, and the default background token.

## Header content

Routes can replace the default header by registering a slot. The component stays mounted while navigating between descendant routes.

```tsx
function ProjectDetailsRoute() {
  const { project } = useProject();

  return (
    <>
      <MainLayout.Header.Slot>
        <AppHeader title={`Project — ${project.name}`} />
      </MainLayout.Header.Slot>
      <ProjectDetailsView project={project} />
    </>
  );
}
```

If a route does not provide a slot the header falls back to `AppHeader` populated via `useHeaderTitle()`.

## Sidemenu composition

Populate the navigation rail with route-specific items by registering a `Sidemenu.Slot`. You can reuse the presentational `AppSidebar` or render a custom structure.

```tsx
<MainLayout.Sidemenu.Slot>
  <AppSidebar
    fixedItems={FIXED_MENU_ITEMS}
    temporaryItems={temporaryProjectItems}
    editorItems={temporaryEditorItems}
    selectedKey={mainView}
    onSelect={(key) => setMainView(key as MainView)}
    floating={false}
  />
</MainLayout.Sidemenu.Slot>
```

`AppSidebar` automatically reflects the discriminated `SidemenuState` coming from the store, so it collapses to compact or hidden modes without further props.

## Programmatic toggles

Child components can read the layout context to toggle chrome elements without drilling props.

```tsx
import { useLayoutContext } from "@/app/layout/MainLayout";

function WorkspaceFooterSlot({ health }: { health: AppHealthReport | null }) {
  const layout = useLayoutContext();

  if (layout.footerVisible) {
    return <WorkspaceFooter health={health} />;
  }

  return <CollapsedFooterBar onExpand={() => layout.setFooterVisible(true)} />;
}
```

For cross-cutting actions (e.g. keyboard shortcuts) the Zustand store exports actions directly:

```ts
import { useLayoutStore } from "@/app/layout/layout-store";

const cycleSidemenu = useLayoutStore.getState().cycleSidemenu;
```

## Background overrides

You can either use `staticData.layout.background` or register a `Background.Slot` for dynamic content.

```tsx
<MainLayout.Background.Slot>
  <AnimatedGrid />
</MainLayout.Background.Slot>
```

The layout shell renders backgrounds behind the main grid (`-z-10` with `pointer-events-none`) so content focus and interactivity remain intact.
