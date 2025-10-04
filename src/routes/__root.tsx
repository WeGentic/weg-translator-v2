import { Fragment, useCallback } from "react";
import { Outlet, createRootRoute, useNavigate } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { MainLayout } from "@/app/layout";
import { WorkspaceFooter } from "@/app/layout/main_elements";
import { useAppHealth } from "@/app/hooks/useAppHealth";

const BASE_LAYOUT_CONFIG = {
  footer: { mounted: true, visible: true, height: 56 },
  sidebarOne: { mounted: true, width: 64 },
  sidebarTwo: { mounted: true, visible: true, width: 192 },
  background: { mounted: true, visible: true },
};

/**
 * Dispatches a custom navigation event that will be handled by useGlobalNavigationEvents
 * in the WorkspacePage component.
 */
function dispatchNavigationEvent(view: "dashboard" | "projects" | "resource" | "settings" | "editor") {
  window.dispatchEvent(
    new CustomEvent("app:navigate", {
      detail: { view },
    })
  );
}

function RootComponent() {
  const navigate = useNavigate();
  const { health } = useAppHealth();

  const handleDashboardClick = useCallback(() => {
    navigate({ to: "/dashboard" }).catch(() => undefined);
    dispatchNavigationEvent("dashboard");
  }, [navigate]);

  const handleProjectsClick = useCallback(() => {
    navigate({ to: "/" }).catch(() => undefined);
    dispatchNavigationEvent("projects");
  }, [navigate]);

  const handleEditorClick = useCallback(() => {
    navigate({ to: "/" }).catch(() => undefined);
    dispatchNavigationEvent("editor");
  }, [navigate]);

  const handleResourcesClick = useCallback(() => {
    navigate({ to: "/resources" }).catch(() => undefined);
    dispatchNavigationEvent("resource");
  }, [navigate]);

  const handleSettingsClick = useCallback(() => {
    navigate({ to: "/" }).catch(() => undefined);
    dispatchNavigationEvent("settings");
  }, [navigate]);

  return (
    <Fragment>
      <MainLayout.Root config={BASE_LAYOUT_CONFIG}>
        <MainLayout.Background />
        <MainLayout.SidebarOne
          onDashboardClick={handleDashboardClick}
          onProjectsClick={handleProjectsClick}
          onEditorClick={handleEditorClick}
          onResourceClick={handleResourcesClick}
          onSettingsClick={handleSettingsClick}
        />
        <MainLayout.SidebarTwo />
        <MainLayout.Main>
          <Outlet />
        </MainLayout.Main>
        <MainLayout.Footer height={56}>
          <WorkspaceFooter health={health} />
        </MainLayout.Footer>
      </MainLayout.Root>
      {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </Fragment>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
