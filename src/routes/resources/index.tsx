import { createFileRoute } from "@tanstack/react-router";

import { ResourcesView } from "@/features/resources/ResourcesView";

function ResourcesRoute() {
  return <ResourcesView />;
}

export const Route = createFileRoute("/resources/")({
  component: ResourcesRoute,
});
