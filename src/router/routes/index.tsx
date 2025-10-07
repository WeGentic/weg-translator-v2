import { createFileRoute } from "@tanstack/react-router";

import { WorkspaceRoute } from "@/modules/workspace";

export const Route = createFileRoute("/")({
  component: WorkspaceRoute,
});
