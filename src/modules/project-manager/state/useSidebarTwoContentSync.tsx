// features/projects/hooks/useSidebarTwoContentSync.tsx
import { useEffect, useMemo } from "react";
import type { ProjectListItem } from "@/core/ipc";
import { useLayoutStoreApi } from "@/app/shell/layout-context";
import { ProjectsBatchActionsPanel } from "../components/ProjectsBatchActionsPanel";
import { ProjectsOverviewCard } from "../components/ProjectsOverviewCard";

interface SidebarSyncArgs {
  selectedProjectIds: ReadonlyArray<string>;
  projects: ReadonlyArray<ProjectListItem>;
  onBatchDelete: (ids: string[]) => Promise<void>;
  onOpenProject: (projectId: string) => void;
  onClearSelection: () => void;
}

function SidebarBatchActionsContent({
  selectedCount,
  selectedNames,
  selectedIds,
  onBatchDelete,
  onClearSelection,
  onOpenProject,
}: {
  selectedCount: number;
  selectedNames: string[];
  selectedIds: ReadonlyArray<string>;
  onBatchDelete: (ids: string[]) => Promise<void>;
  onClearSelection: () => void;
  onOpenProject: (projectId: string) => void;
}) {
  return (
    <ProjectsBatchActionsPanel
      selectedCount={selectedCount}
      selectedProjectNames={selectedNames}
      selectedProjectIds={[...selectedIds]}
      onBatchDelete={onBatchDelete}
      onClearSelection={onClearSelection}
      onOpenProject={onOpenProject}
    />
  );
}

function SidebarOverviewContent({
  totalProjects,
  activeProjects,
  totalFiles,
  recentlyUpdated,
}: {
  totalProjects: number;
  activeProjects: number;
  totalFiles: number;
  recentlyUpdated: number;
}) {
  return (
    <ProjectsOverviewCard
      totalProjects={totalProjects}
      activeProjects={activeProjects}
      totalFiles={totalFiles}
      recentlyUpdated={recentlyUpdated}
    />
  );
}

export function useSidebarTwoContentSync({
  selectedProjectIds,
  projects,
  onBatchDelete,
  onOpenProject,
  onClearSelection,
}: SidebarSyncArgs) {
  const layoutStore = useLayoutStoreApi();

  const projectLookup = useMemo(() => {
    const lookup = new Map<string, ProjectListItem>();
    for (const project of projects) {
      lookup.set(project.projectId, project);
    }
    return lookup;
  }, [projects]);

  const selectionSummary = useMemo(() => {
    if (selectedProjectIds.length === 0) {
      return { count: 0, names: [] as string[] };
    }

    const names: string[] = [];
    for (const id of selectedProjectIds) {
      const name = projectLookup.get(id)?.name;
      if (name) {
        names.push(name);
      }
    }

    return { count: selectedProjectIds.length, names };
  }, [selectedProjectIds, projectLookup]);

  const overviewSummary = useMemo(() => {
    if (projects.length === 0) {
      return { totalProjects: 0, activeProjects: 0, totalFiles: 0, recentlyUpdated: 0 };
    }

    let activeProjects = 0;
    let totalFiles = 0;
    let recentlyUpdated = 0;
    const threshold = Date.now() - 24 * 60 * 60 * 1000;

    for (const project of projects) {
      const status = project.status?.toLowerCase();
      if (status === "active" || status === "running") {
        activeProjects += 1;
      }
      totalFiles += project.fileCount ?? 0;
      const updatedTime = Date.parse(project.updatedAt);
      if (!Number.isNaN(updatedTime) && updatedTime >= threshold) {
        recentlyUpdated += 1;
      }
    }

    return {
      totalProjects: projects.length,
      activeProjects,
      totalFiles,
      recentlyUpdated,
    };
  }, [projects]);

  const batchActionsContent = useMemo(() => {
    if (selectionSummary.count === 0) {
      return null;
    }
    return (
      <SidebarBatchActionsContent
        key="sidebar-selected-projects"
        selectedCount={selectionSummary.count}
        selectedNames={selectionSummary.names}
        selectedIds={selectedProjectIds}
        onBatchDelete={onBatchDelete}
        onClearSelection={onClearSelection}
        onOpenProject={onOpenProject}
      />
    );
  }, [onBatchDelete, onClearSelection, onOpenProject, selectedProjectIds, selectionSummary]);

  const overviewContent = useMemo(() => {
    if (selectionSummary.count > 0) {
      return null;
    }

    return (
      <SidebarOverviewContent
        key="sidebar-overview-projects"
        totalProjects={overviewSummary.totalProjects}
        activeProjects={overviewSummary.activeProjects}
        totalFiles={overviewSummary.totalFiles}
        recentlyUpdated={overviewSummary.recentlyUpdated}
      />
    );
  }, [overviewSummary, selectionSummary.count]);

  // Sync layout slot whenever either memoised React node changes; cleanup only clears
  // our content if it is still the active entry to avoid stomping other sidebar updates.
  useEffect(() => {
    const store = layoutStore.getState();
    const content = batchActionsContent ?? overviewContent ?? null;

    if (!content) {
      store.setSidebarTwoContent(null);
      return;
    }

    if (!store.sidebarTwo.visible) {
      store.setSidebarTwo({ visible: true });
    }

    store.setSidebarTwoContent(content);

    return () => {
      const currentContent = layoutStore.getState().sidebarTwoContent;
      if (currentContent === content) {
        layoutStore.getState().setSidebarTwoContent(null);
      }
    };
  }, [batchActionsContent, overviewContent, layoutStore]);
}
