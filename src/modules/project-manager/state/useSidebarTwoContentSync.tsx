// features/projects/hooks/useSidebarTwoContentSync.tsx
import { useEffect, useMemo } from "react";
import type { ProjectListItem } from "@/core/ipc";
import { useLayoutSelector, useLayoutStoreApi } from "@/app/shell/layout-context";
import { ProjectsOverviewCard } from "../components/ProjectsOverviewCard";
import { FocusedProjectShortcut } from "../components/FocusedProjectShortcut";
import {
  dispatchProjectClear,
  dispatchProjectSelection,
  dispatchProjectSelectionClear,
} from "@/modules/projects/events";
import { useRegisterProjectSidebarModules } from "../sidebar/registerProjectSidebarModules";

interface SidebarSyncArgs {
  selectedProjectIds: ReadonlyArray<string>;
  projects: ReadonlyArray<ProjectListItem>;
  onBatchDelete: (ids: string[]) => Promise<void>;
  onOpenProject: (projectId: string) => void;
  onClearSelection: () => void;
  openingProjectId: string | null;
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
  openingProjectId,
}: SidebarSyncArgs) {
  const focusedProject = useLayoutSelector((state) => state.focusedProject);
  const layoutStore = useLayoutStoreApi();
  useRegisterProjectSidebarModules();

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

  const selectionPayload = useMemo(() => {
    if (selectionSummary.count === 0) {
      return null;
    }
    return {
      count: selectionSummary.count,
      selectedIds: [...selectedProjectIds],
      selectedNames: [...selectionSummary.names],
      onBatchDelete,
      onClearSelection,
      onOpenProject,
      openingProjectId,
      view: "projects" as const,
      allowedViews: ["projects", "dashboard"] as const,
    };
  }, [onBatchDelete, onClearSelection, onOpenProject, openingProjectId, selectedProjectIds, selectionSummary]);

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

  const focusedProjectContent = useMemo(() => {
    if (selectionSummary.count > 0 || !focusedProject) {
      return null;
    }
    return (
      <FocusedProjectShortcut
        key={`sidebar-focused-project-${focusedProject.projectId}`}
        projectId={focusedProject.projectId}
        projectName={focusedProject.projectName}
        isOpening={openingProjectId === focusedProject.projectId}
        onOpen={onOpenProject}
        onDismiss={dispatchProjectClear}
      />
    );
  }, [dispatchProjectClear, focusedProject, onOpenProject, openingProjectId, selectionSummary.count]);

  useEffect(() => {
    const store = layoutStore;
    if (selectionSummary.count > 0) {
      store.getState().setSidebarTwoLegacyContent(null);
      return () => {
        store.getState().setSidebarTwoLegacyContent(null);
      };
    }

    const content = focusedProjectContent ?? overviewContent ?? null;
    store.getState().setSidebarTwoLegacyContent(content);
    return () => {
      store.getState().setSidebarTwoLegacyContent(null);
    };
  }, [focusedProjectContent, layoutStore, overviewContent, selectionSummary.count]);

  useEffect(() => {
    if (selectionPayload) {
      dispatchProjectSelection(selectionPayload);
      return () => {
        dispatchProjectSelectionClear();
      };
    }

    dispatchProjectSelectionClear();
    return undefined;
  }, [selectionPayload]);

  useEffect(() => {
    if (!selectionPayload && !focusedProject) {
      // Overview content remains on legacy path for now; ensure selection module clears.
      dispatchProjectSelectionClear();
    }
  }, [selectionPayload, focusedProject]);
}
