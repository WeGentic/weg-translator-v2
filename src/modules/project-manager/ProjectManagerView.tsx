import "@/shared/styles/main-view.css";
import "@/modules/project-manager/css/dropdowns.css";
import "@/modules/project-manager/css/project-manager.css";
import "@/modules/project-manager/css/new-project-button.css";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { SortingState } from "@tanstack/react-table";
import { useNavigate } from "@tanstack/react-router";

import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/use-toast";
import { ProjectsTableSkeleton } from "@/modules/project-manager/ui/table/ProjectsTableSkeleton";
import { deleteProject, type ProjectListItem } from "@/core/ipc";
import { useProjectListResource } from "./data/projectsResource";
import { filterProjects } from "@/modules/project-manager/state/filterProjects";

import { ProjectManagerHeader } from "./ProjectManagerHeader";
import { ProjectManagerToolbar } from "./ProjectManagerToolbar";
import { ProjectManagerContent } from "./ProjectManagerContent";
import { EmptyProjectsState } from "./components/EmptyProjectsState";
import { CreateProjectWizardV2 } from "@/modules/wizards/project";
import { DeleteProjectDialog } from "./components/DeleteProjectDialog";
import { ProjectManagerLayout } from "./layout/ProjectManagerLayout";
import { useSidebarTwoContentSync } from "./state/useSidebarTwoContentSync";
import {
  createDefaultTableControlsState,
  tableFiltersEqual,
  type TableControlsState,
  type TableFilters,
} from "./state/types";

const DEFAULT_SORTING: SortingState = [{ id: "updated", desc: true }];
const LIST_LIMIT = 100;

export type ProjectManagerViewProps = {
  onOpenProject?: (project: ProjectListItem) => void;
  onCreateProject?: () => void;
};

type DeleteTarget = { id: string; name: string } | null;

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && typeof error.message === "string" && error.message.length > 0) {
    return error.message;
  }
  return fallback;
}

export function ProjectManagerView(props: ProjectManagerViewProps = {}) {
  return (
    <Suspense fallback={<ProjectManagerViewSkeleton />}>
      <ProjectManagerViewInner {...props} />
    </Suspense>
  );
}

function ProjectManagerViewInner({
  onOpenProject,
  onCreateProject,
}: ProjectManagerViewProps) {
  const { projects, status, error: resourceError, refresh, mutate } = useProjectListResource({
    limit: LIST_LIMIT,
  });

  const [isWizardOpen, setWizardOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [controls, setControls] = useState<TableControlsState>(createDefaultTableControlsState);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const { toast } = useToast();
  const navigate = useNavigate();

  const projectList = useMemo(() => Array.from(projects), [projects]);

  const resourceErrorMessage = resourceError
    ? resolveErrorMessage(resourceError, "Unable to load projects.")
    : null;

  const visibleProjects = useMemo(
    () => filterProjects(projectList, controls.filters, controls.search),
    [projectList, controls.filters, controls.search],
  );

  useEffect(() => {
    setSelectedRows((current) => {
      if (current.size === 0) return current;
      const allowed = new Set(visibleProjects.map((project) => project.projectId));
      let changed = false;
      const next = new Set<string>();
      current.forEach((id) => {
        if (allowed.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [visibleProjects]);

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) {
      setDeleteTarget(null);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  const handleOpenProjectById = useCallback(
    (projectId: string) => {
      if (!projectId) {
        return;
      }

      navigate({
        to: "/projects/$projectId",
        params: { projectId },
      }).catch((error) => {
        console.error(`Failed to navigate to project ${projectId}`, error);
      });

      if (!onOpenProject) {
        return;
      }

      const project = projectList.find((item) => item.projectId === projectId);
      if (project) {
        onOpenProject(project);
      }
    },
    [navigate, onOpenProject, projectList],
  );

  const handleProjectCreated = useCallback(() => {
    void refresh({ immediate: true }).catch((error) => {
      console.error("Failed to refresh projects after creation", error);
    });
  }, [refresh]);

  const handleCreateProjectClick = useCallback(() => {
    onCreateProject?.();
    setWizardOpen(true);
  }, [onCreateProject]);

  const handleRequestDelete = useCallback((projectId: string, projectName: string) => {
    setDeleteTarget({ id: projectId, name: projectName });
    setDeleteDialogOpen(true);
  }, []);

  const deleteProjectsOptimistically = useCallback(
    async (projectIds: string[]) => {
      if (projectIds.length === 0) {
        return { successCount: 0, affectedNames: [] as string[] };
      }

      // Keep a snapshot so we can roll back the optimistic removal if any IPC call fails.
      const snapshot = projectList.map((item) => ({ ...item }));
      const targetIds = new Set(projectIds);
      const affectedNames = snapshot
        .filter((item) => targetIds.has(item.projectId))
        .map((item) => item.name);

      mutate((current) => current.filter((item) => !targetIds.has(item.projectId)));

      try {
        const results = await Promise.all(projectIds.map((id) => deleteProject(id)));
        const successCount = results.filter((count) => count > 0).length;

        if (successCount !== projectIds.length) {
          throw new Error("One or more projects could not be deleted.");
        }

        await refresh({ immediate: true });

        return { successCount, affectedNames };
      } catch (error) {
        mutate(() => snapshot);
        throw error;
      }
    },
    [mutate, projectList, refresh],
  );

  const handleBatchDelete = useCallback(
    async (projectIds: string[]) => {
      try {
        const { successCount } = await deleteProjectsOptimistically(projectIds);
        clearSelection();
        toast({
          title: "Projects deleted",
          description: `Successfully deleted ${successCount} project${successCount === 1 ? "" : "s"}.`,
        });
      } catch (error) {
        const message = resolveErrorMessage(error, "Batch deletion failed");
        toast({ variant: "destructive", title: "Deletion failed", description: message });
        try {
          await refresh({ immediate: true });
        } catch (refreshError) {
          console.error("Failed to refresh projects after failed batch deletion", refreshError);
        }
      }
    },
    [clearSelection, deleteProjectsOptimistically, refresh, toast],
  );

  const handleConfirmDelete = useCallback(
    async (projectId: string) => {
      try {
        const { affectedNames } = await deleteProjectsOptimistically([projectId]);
        clearSelection();
        toast({
          title: "Project deleted",
          description:
            affectedNames.length > 0
              ? `Deleted "${affectedNames[0]}".`
              : "Project deleted.",
        });
      } catch (error) {
        const message = resolveErrorMessage(error, "Deletion failed");
        toast({ variant: "destructive", title: "Deletion failed", description: message });
        throw new Error(message);
      }
    },
    [clearSelection, deleteProjectsOptimistically, toast],
  );

  function handleSearchChange(nextSearch: string) {
    setControls((current) => (current.search === nextSearch ? current : { ...current, search: nextSearch }));
  }

  function handleFiltersChange(nextFilters: TableFilters) {
    setControls((current) =>
      tableFiltersEqual(current.filters, nextFilters) ? current : { ...current, filters: nextFilters },
    );
  }

  const hasSelection = selectedRows.size > 0;
  const showInitialSkeleton = status === "pending" && projectList.length === 0;
  const shouldRenderEmptyState = !resourceErrorMessage && !showInitialSkeleton && projectList.length === 0;

  const selectedProjectIds = useMemo(() => Array.from(selectedRows), [selectedRows]);

  useSidebarTwoContentSync({
    selectedProjectIds,
    projects: projectList,
    onBatchDelete: handleBatchDelete,
    onOpenProject: handleOpenProjectById,
    onClearSelection: clearSelection,
  });

  return (
    <ProjectManagerLayout
      id="ProjectManager-view"
      ariaLabelledBy="ProjectManager-view-heading"
      header={<ProjectManagerHeader onCreateProject={handleCreateProjectClick} />}
      toolbar={
        <ProjectManagerToolbar
          search={controls.search}
          onSearchChange={handleSearchChange}
          filters={controls.filters}
          onFiltersChange={handleFiltersChange}
        />
      }
      footer={
        hasSelection ? (
          <ProjectsSelectionFooter
            selectedProjects={visibleProjects.filter((item) => selectedRows.has(item.projectId))}
            onClearSelection={clearSelection}
            onDeleteSelection={handleBatchDelete}
          />
        ) : null
      }
    >
      <div className="flex flex-1 flex-col">
        {resourceErrorMessage ? (
          <div className="flex flex-1 items-center justify-center px-4 pb-4 pt-2">
            <Alert variant="destructive" className="max-w-md">
              <AlertTitle>Unable to load projects</AlertTitle>
              <AlertDescription>{resourceErrorMessage}</AlertDescription>
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void refresh({ immediate: true }).catch((error) => {
                      console.error("Retrying projects refresh failed", error);
                    });
                  }}
                >
                  Retry
                </Button>
              </div>
            </Alert>
          </div>
        ) : showInitialSkeleton ? (
          <div className="flex flex-1 flex-col gap-4 px-4 py-6">
            <ProjectsTableSkeleton />
          </div>
        ) : shouldRenderEmptyState ? (
          <EmptyProjectsState onCreate={handleCreateProjectClick} />
        ) : (
          <ProjectManagerContent
            items={visibleProjects}
            sorting={sorting}
            onSortingChange={setSorting}
            search={controls.search}
            onOpenProject={handleOpenProjectById}
            onRequestDelete={handleRequestDelete}
            selectedRows={selectedRows}
            onRowSelectionChange={setSelectedRows}
          />
        )}
      </div>

      <CreateProjectWizardV2
        open={isWizardOpen}
        onOpenChange={setWizardOpen}
        onProjectCreated={handleProjectCreated}
      />

      <DeleteProjectDialog
        open={deleteDialogOpen}
        onOpenChange={handleDeleteDialogOpenChange}
        target={deleteTarget}
        onConfirmDelete={handleConfirmDelete}
      />
    </ProjectManagerLayout>
  );
}

function ProjectManagerViewSkeleton() {
  const fallbackControls = createDefaultTableControlsState();

  return (
    <ProjectManagerLayout
      id="ProjectManager-view"
      ariaLabelledBy="ProjectManager-view-heading"
      header={<ProjectManagerHeader onCreateProject={() => {}} />}
      toolbar={
        <ProjectManagerToolbar
          search={fallbackControls.search}
          onSearchChange={() => {}}
          filters={fallbackControls.filters}
          onFiltersChange={() => {}}
        />
      }
    >
      <div className="flex flex-1 flex-col gap-4 px-4 py-6">
        <ProjectsTableSkeleton />
      </div>
    </ProjectManagerLayout>
  );
}

function ProjectsSelectionFooter({
  selectedProjects,
  onClearSelection,
  onDeleteSelection,
}: {
  selectedProjects: ProjectListItem[];
  onClearSelection: () => void;
  onDeleteSelection: (projectIds: string[]) => void | Promise<void>;
}) {
  const projectNames = selectedProjects.map((item) => item.name);
  const selectedIds = selectedProjects.map((item) => item.projectId);

  return (
    <div className="flex flex-1 items-center justify-between px-4">
      <div className="flex flex-1 items-center gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-full bg-(--color-primary) px-3 text-sm font-semibold text-[var(--color-onprimary)]">
            {selectedProjects.length}
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">Selected projects</p>
            <p className="text-xs text-muted-foreground">
              {projectNames.length > 0 ? projectNames.join(", ") : "Select projects to manage actions."}
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClearSelection}
          className="inline-flex h-8 items-center justify-center rounded-md border border-border/60 px-3 text-sm font-medium text-foreground transition-all duration-200 hover:bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            void onDeleteSelection(selectedIds);
          }}
          className="inline-flex h-8 items-center justify-center rounded-md bg-[var(--color-destructive)] px-3 text-sm font-semibold text-[var(--color-destructive-foreground)] transition-all duration-200 hover:saturate-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-destructive)] focus-visible:ring-offset-2"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default ProjectManagerView;
