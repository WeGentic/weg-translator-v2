import { createFileRoute } from "@tanstack/react-router";

import { ResourcesRoute } from "@/modules/resources";

export const Route = createFileRoute("/_app/resources/")({
  component: ResourcesRoute,
});
