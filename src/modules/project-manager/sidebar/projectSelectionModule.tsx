import { useEffect } from "react";

import type { SidebarTwoModuleDefinition, SidebarTwoModuleProps } from "@/app/shell/sidebar-two-registry/types";
import { ProjectsBatchActionsPanel } from "../components/ProjectsBatchActionsPanel";
import { PROJECT_SELECTION_EVENT, type ProjectSelectionDetail } from "../../projects/events";

export type ProjectSelectionModulePayload = ProjectSelectionDetail;

function ProjectSelectionModule({ payload, deactivate, requestFocus }: SidebarTwoModuleProps<ProjectSelectionModulePayload>) {
  useEffect(() => {
    if (!payload || payload.count === 0) {
      deactivate();
    }
  }, [payload, deactivate]);

  useEffect(() => {
    if (payload?.count && payload.count > 0 && requestFocus) {
      requestFocus();
    }
  }, [payload?.count, requestFocus]);

  if (!payload || payload.count === 0) {
    return null;
  }

  return (
    <div id="sidebar-two-project-selection" tabIndex={-1}>
      <ProjectsBatchActionsPanel
        selectedCount={payload.count}
        selectedProjectNames={Array.from(payload.selectedNames)}
        selectedProjectIds={[...payload.selectedIds]}
        onBatchDelete={payload.onBatchDelete}
        onClearSelection={payload.onClearSelection}
        onOpenProject={payload.onOpenProject}
        openingProjectId={payload.openingProjectId}
      />
    </div>
  );
}

export const projectSelectionModuleId = "projects:selection";

export const projectSelectionModuleDefinition: SidebarTwoModuleDefinition<ProjectSelectionModulePayload> = {
  id: projectSelectionModuleId,
  label: "Project Selection",
  scope: "event",
  persist: true,
  focusTargetId: "sidebar-two-project-selection",
  trigger: {
    name: PROJECT_SELECTION_EVENT,
    allowedViews: ["projects", "dashboard"],
    mapEvent: (event) => {
      const detail = event.detail as ProjectSelectionModulePayload | null | undefined;
      if (!detail || detail.count === 0) {
        return { action: "deactivate" };
      }
      return {
        payload: detail,
        view: detail.view ?? "projects",
        allowedViews: detail.allowedViews ?? ["projects", "dashboard"],
      };
    },
  },
  loader: {
    kind: "component",
    component: ProjectSelectionModule,
  },
};
