import { Fragment, useCallback } from "react";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { MainLayout } from "@/app/layout";

const BASE_LAYOUT_CONFIG = {
  header: { mounted: true, visible: false, height: 64 },
  footer: { mounted: true, visible: true, height: 56 },
  sidemenu: { mounted: true, mode: "hidden" as const, compactWidth: 56, expandedWidth: 264 },
  sidebarOne: { mounted: true, width: 64 },
  sidebarTwo: { mounted: true, visible: true, width: 192 },
  background: { mounted: true, visible: true },
};

/**
 * Dispatches a custom navigation event that will be handled by useGlobalNavigationEvents
 * in the WorkspacePage component.
 */
function dispatchNavigationEvent(view: "projects" | "settings") {
  window.dispatchEvent(
    new CustomEvent("app:navigate", {
      detail: { view },
    })
  );
}

function RootComponent() {
  const handleProjectsClick = useCallback(() => {
    dispatchNavigationEvent("projects");
  }, []);

  const handleSettingsClick = useCallback(() => {
    dispatchNavigationEvent("settings");
  }, []);

  return (
    <Fragment>
      <MainLayout.Root config={BASE_LAYOUT_CONFIG}>
        <MainLayout.Background />
        <MainLayout.Header />
        <MainLayout.SidebarOne
          onProjectsClick={handleProjectsClick}
          onSettingsClick={handleSettingsClick}
        />
        <MainLayout.SidebarTwo />
        <MainLayout.Sidemenu />
        <MainLayout.Main>
          <Outlet />
        </MainLayout.Main>
        <MainLayout.Footer />
      </MainLayout.Root>
      {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </Fragment>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
