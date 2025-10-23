import { Fragment, useCallback } from "react";
import {
  Outlet,
  createRootRouteWithContext,
  defaultStringifySearch,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import type { RouterContext as AppRouterContext } from "@/router/router-context";

function RootComponent() {
  return (
    <>
      <Outlet />
      {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </>
  );
}

export const Route = createRootRouteWithContext<AppRouterContext>()({
  beforeLoad: ({ context, location }) => {
    if (location.pathname === LOGIN_PATH) {
      return;
    }

    const auth = context.auth;
    if (!auth?.isAuthenticated) {
      const searchString = defaultStringifySearch(location.search ?? {});
      const hash = typeof location.hash === "string" ? location.hash : "";
      const redirectTarget = `${location.pathname}${searchString}${hash}` || "/";

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
