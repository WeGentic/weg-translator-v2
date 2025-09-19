import { createFileRoute, redirect } from "@tanstack/react-router";
import App from "../App";

export const Route = createFileRoute("/")({
  beforeLoad: ({
    context,
    location,
  }: {
    context: { auth?: { isAuthenticated?: boolean } };
    location: { pathname?: string };
  }) => {
    if (!context.auth?.isAuthenticated) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.pathname ?? "/",
        },
      });
    }
  },
  component: App,
});
