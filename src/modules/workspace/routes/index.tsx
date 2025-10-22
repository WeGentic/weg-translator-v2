import { useMemo } from "react";

import type { MainView } from "@/app/state/main-view";
import { WorkspacePage } from "@/modules/workspace/WorkspacePage";
import { consumeQueuedWorkspaceMainView } from "@/modules/workspace/navigation/main-view-persist";

function resolveInitialView(): MainView | undefined {
  return consumeQueuedWorkspaceMainView();
}

export function WorkspaceRoute() {
  const initialView = useMemo(() => resolveInitialView(), []);

  return <WorkspacePage initialView={initialView ?? "dashboard"} />;
}

export const workspaceRouteComponent = WorkspaceRoute;
