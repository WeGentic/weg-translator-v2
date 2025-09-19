import { Fragment } from "react";
import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

function RootComponent() {
  const locationHref = useRouterState({
    select: (state) => state.location.href,
  });

  return (
    <Fragment>
      <AppErrorBoundary resetKeys={[locationHref]}>
        <Outlet />
      </AppErrorBoundary>
      {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </Fragment>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
