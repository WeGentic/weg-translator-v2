// features/projects/hooks/useSidebarTwoContentSync.tsx
import { useEffect } from "react";
import type { ProjectListItem } from "@/ipc";
import { useLayoutStoreApi } from "@/app/layout/layout-context";
import { ProjectsBatchActionsPanel } from "../components/ProjectsBatchActionsPanel";
import { ProjectsOverviewCard } from "../components/ProjectsOverviewCard";

type Args = {
  selectedRows: Set<string>;
  projects: ProjectListItem[];
  onBatchDelete: (ids: string[]) => void;
  onOpenProject: (projectId: string) => void;
  clearSelection: () => void;
};

export function useSidebarTwoContentSync({
  selectedRows,
  projects,
  onBatchDelete,
  onOpenProject,
  clearSelection,
}: Args) {
  const layoutStore = useLayoutStoreApi();

  useEffect(() => {
    const store = layoutStore.getState();
    const sidebarTwo = store.sidebarTwo;

    if (selectedRows.size > 0) {
      if (!sidebarTwo.visible) {
        store.setSidebarTwo({ visible: true });
      }

      const selectedProjectNames = Array.from(selectedRows)
        .map((id) => projects.find((p) => p.projectId === id)?.name)
        .filter((name): name is string => name !== undefined);

      const selectedProjectIds = Array.from(selectedRows);

      store.setSidebarTwoContent(
        <ProjectsBatchActionsPanel
          selectedCount={selectedRows.size}
          selectedProjectNames={selectedProjectNames}
          selectedProjectIds={selectedProjectIds}
          onBatchDelete={onBatchDelete}
          onClearSelection={clearSelection}
          onOpenProject={onOpenProject}
        />,
      );
    } else {
      const activeProjects = projects.filter((p) => p.status === "active").length;
      const totalFiles = projects.reduce((sum, p) => sum + p.fileCount, 0);

      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const recentlyUpdated = projects.filter((p) => {
        const updatedTime = Date.parse(p.updatedAt);
        return !Number.isNaN(updatedTime) && updatedTime >= oneDayAgo;
      }).length;

      store.setSidebarTwoContent(
        <ProjectsOverviewCard
          totalProjects={projects.length}
          activeProjects={activeProjects}
          totalFiles={totalFiles}
          recentlyUpdated={recentlyUpdated}
        />,
      );
    }
  }, [selectedRows, projects, onBatchDelete, onOpenProject, clearSelection, layoutStore]);
}