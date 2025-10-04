import { createFileRoute } from "@tanstack/react-router";

import { DashboardView } from "@/features/dashboard/DashboardView";

function DashboardRoute() {
  return <DashboardView />;
}

export const Route = createFileRoute("/dashboard/")({
  component: DashboardRoute,
});
