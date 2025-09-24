import { Fragment } from "react";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { MainLayout } from "@/app/layout/MainLayout";

const BASE_LAYOUT_CONFIG = {
  header: { mounted: true, visible: true, height: 64 },
  footer: { mounted: true, visible: true, height: 56 },
  sidemenu: { mounted: true, mode: "expanded" as const, compactWidth: 112, expandedWidth: 264 },
  background: { mounted: true, visible: true },
};

function RootComponent() {
  return (
    <Fragment>
      <MainLayout.Root config={BASE_LAYOUT_CONFIG}>
        <MainLayout.Background />
        <MainLayout.Header />
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
