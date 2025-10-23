import { createFileRoute } from "@tanstack/react-router";

import { DashboardRoute } from "@/modules/dashboard";

export const Route = createFileRoute("/_app/dashboard/")({
  component: DashboardRoute,
});
