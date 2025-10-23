import { Fragment, useCallback, useState } from "react";
import {
  Outlet,
  createRootRouteWithContext,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { MainLayout } from "@/app/shell";
import { WorkspaceFooter } from "@/app/shell/main_elements";
import { useAppHealth } from "@/app/hooks/useAppHealth";
import { queueWorkspaceMainViewIfNeeded } from "@/modules/workspace/navigation/main-view-persist";
import { UserAccountDialog } from "@/modules/auth";
import type { RouterContext as AppRouterContext } from "@/router/router-context";

const BASE_LAYOUT_CONFIG = {
  footer: { mounted: true, visible: true, height: 56 },
  sidebarOne: { mounted: true, width: 64 },
  sidebarTwo: { mounted: true, visible: true, width: 192 },
  background: { mounted: true, visible: true },
};

const LOGIN_PATH = "/login";

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
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);

  const handleDashboardClick = useCallback(() => {
    navigate({ to: "/dashboard" }).catch(() => undefined);
    dispatchNavigationEvent("dashboard");
  }, [navigate]);

  const handleProjectsClick = useCallback(() => {
    queueWorkspaceMainViewIfNeeded("projects");
    navigate({ to: "/" }).catch(() => undefined);
    dispatchNavigationEvent("projects");
  }, [navigate]);

  const handleEditorClick = useCallback(() => {
    queueWorkspaceMainViewIfNeeded("editor");
    navigate({ to: "/" }).catch(() => undefined);
    dispatchNavigationEvent("editor");
  }, [navigate]);

  const handleResourcesClick = useCallback(() => {
    navigate({ to: "/resources" }).catch(() => undefined);
    dispatchNavigationEvent("resource");
  }, [navigate]);

  const handleSettingsClick = useCallback(() => {
    queueWorkspaceMainViewIfNeeded("settings");
    navigate({ to: "/" }).catch(() => undefined);
    dispatchNavigationEvent("settings");
  }, [navigate]);

  const handleUserAccountClick = useCallback(() => {
    setAccountDialogOpen(true);
  }, []);

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
          onUserAccountClick={handleUserAccountClick}
        />
        <MainLayout.SidebarTwo />
        <MainLayout.Main>
          <Outlet />
        </MainLayout.Main>
        <MainLayout.Footer height={56}>
          <WorkspaceFooter health={health} />
        </MainLayout.Footer>
      </MainLayout.Root>
      <UserAccountDialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen} />
      {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </Fragment>
  );
}

export const Route = createRootRouteWithContext<AppRouterContext>()({
  beforeLoad: ({ context, location }) => {
    if (location.pathname === LOGIN_PATH) {
      return;
    }

    const auth = context.auth;
    if (!auth?.isAuthenticated) {
      const search = location.search ?? "";
      const hash = location.hash ?? "";
      const redirectTarget = `${location.pathname}${search}${hash}` || "/";

      throw redirect({
        to: "/login",
        search: {
          redirect: redirectTarget,
        },
      });
    }
  },
  component: RootComponent,
});
