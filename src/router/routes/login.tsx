import { createFileRoute, redirect } from "@tanstack/react-router";

import { LoginRoute } from "@/modules/auth";

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth?.isAuthenticated) {
      return;
    }

    const search = location.search as { redirect?: string } | undefined;
    const candidate = typeof search?.redirect === "string" ? search.redirect : null;
    const isSafeRedirect =
      typeof candidate === "string" &&
      candidate.length > 0 &&
      candidate.startsWith("/") &&
      !candidate.startsWith("//") &&
      candidate !== "/login";

    const target = isSafeRedirect ? candidate : "/";
    throw redirect({ to: target });
  },
  component: LoginRoute,
});
