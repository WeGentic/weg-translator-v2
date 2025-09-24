import { createFileRoute } from "@tanstack/react-router";

import { WorkspacePage } from "@/features/workspace/WorkspacePage";

export const Route = createFileRoute("/")({
  component: WorkspacePage,
});
