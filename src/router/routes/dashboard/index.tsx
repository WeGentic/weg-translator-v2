import { createFileRoute } from "@tanstack/react-router";

import { DashboardRoute } from "@/modules/dashboard";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardRoute,
});
