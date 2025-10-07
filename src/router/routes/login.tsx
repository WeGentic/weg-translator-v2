import { createFileRoute, redirect } from "@tanstack/react-router";

import { LoginRoute } from "@/modules/auth";

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context }: { context: { auth?: { isAuthenticated?: boolean } } }) => {
    if (context.auth?.isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginRoute,
});
