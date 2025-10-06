import { useEffect } from "react";

import type { ProjectListItem } from "@/ipc";

import {
  buildProjectsOverviewMetrics,
  selectProjectsByIds,
  summarizeSelection,
} from "../data";
import { useProjectManagerSelector } from "../state";
import { ProjectsBatchActionsPanel } from "./components/ProjectsBatchActionsPanel";
import { ProjectsOverviewCard } from "./components/ProjectsOverviewCard";
import { useSidebarController } from "./SidebarController";

interface SidebarContentSyncArgs {
  projects: ProjectListItem[];
  onBatchDelete: (ids: string[]) => void;
  isDeleting: boolean;
  onOpenProject?: (project: ProjectListItem) => void;
}

export function useSidebarContentSync({
  projects,
  onBatchDelete,
  isDeleting,
  onOpenProject,
}: SidebarContentSyncArgs) {
  const controller = useSidebarController();
  const selectedIds = useProjectManagerSelector((state) => state.selectedIds);
  const clearSelection = useProjectManagerSelector((state) => state.clearSelection);

  useEffect(() => {
    controller.ensureMounted();
    return () => {
      controller.reset();
    };
  }, [controller]);

  useEffect(() => {
    const selectedProjects = selectProjectsByIds(projects, selectedIds);
    const selectionSummary = summarizeSelection(selectedProjects);

    if (selectionSummary.selectedCount > 0) {
      controller.setContent(
        (
          <ProjectsBatchActionsPanel
            selectedProjects={selectedProjects}
            selectionSummary={selectionSummary}
            onClearSelection={clearSelection}
            onBatchDelete={onBatchDelete}
            isDeleting={isDeleting}
            onOpenProject={onOpenProject}
          />
        ),
        { visible: true },
      );
      return;
    }

    const overviewMetrics = buildProjectsOverviewMetrics(projects);
    controller.setContent(
      (
        <ProjectsOverviewCard
          totalProjects={overviewMetrics.totalProjects}
          activeProjects={overviewMetrics.activeProjects}
          totalFiles={overviewMetrics.totalFiles}
          recentlyUpdated={overviewMetrics.recentlyUpdated}
        />
      ),
      { visible: true },
    );
  }, [
    controller,
    projects,
    selectedIds,
    clearSelection,
    onBatchDelete,
    isDeleting,
    onOpenProject,
  ]);
}
