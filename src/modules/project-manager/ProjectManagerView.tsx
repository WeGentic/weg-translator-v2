import "@/shared/styles/main-view.css";
import "@/modules/project-manager/css/dropdowns.css";
import "@/modules/project-manager/css/data-table.css";
import "@/modules/project-manager/css/new-project-button.css";

import { useEffect, useRef, useState } from "react";
import type { SortingState } from "@tanstack/react-table";
import { useNavigate } from "@tanstack/react-router";

import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { useToast } from "@/shared/ui/use-toast";
import { ProjectsTableSkeleton } from "@/modules/project-manager/ui/table/ProjectsTableSkeleton";
import { deleteProject, listProjects, type ProjectListItem } from "@/core/ipc";
import { filterProjects } from "@/modules/project-manager/state/filterProjects";

import { ProjectManagerHeader } from "./ProjectManagerHeader";
import { ProjectManagerToolbar } from "./ProjectManagerToolbar";
import { ProjectManagerContent } from "./ProjectManagerContent";
import { EmptyProjectsState } from "./components/EmptyProjectsState";
import { CreateProjectWizardV2 } from "./components/wizard-v2/CreateProjectWizardV2";
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
const POLLING_INTERVAL_MS = 1500;
const LIST_LIMIT = 100;

export type ProjectManagerViewProps = {
  onOpenProject?: (project: ProjectListItem) => void;
  onCreateProject?: () => void;
};

type DeleteTarget = { id: string; name: string } | null;

type RefreshOptions = {
  showSpinner?: boolean;
};

type RefreshProjectsFn = (options?: RefreshOptions) => Promise<void>;

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && typeof error.message === "string" && error.message.length > 0) {
    return error.message;
  }
  return fallback;
}

export function ProjectManagerView({
  onOpenProject,
  onCreateProject,
}: ProjectManagerViewProps = {}) {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isWizardOpen, setWizardOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [controls, setControls] = useState<TableControlsState>(createDefaultTableControlsState);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const refreshProjectsRef = useRef<RefreshProjectsFn>(() => Promise.resolve());

  const { toast } = useToast();
  const navigate = useNavigate();

  async function refreshProjects({ showSpinner }: RefreshOptions = {}) {
    if (showSpinner) {
      setIsLoading(true);
    }

    try {
      setError(null);
      const response = await listProjects({ limit: LIST_LIMIT });
      setProjects(response);
    } catch (unknownError) {
      setError(resolveErrorMessage(unknownError, "Unable to load projects."));
    } finally {
      if (showSpinner) {
        setIsLoading(false);
      }
    }
  }

  refreshProjectsRef.current = refreshProjects;

  useEffect(() => {
    void refreshProjectsRef.current({ showSpinner: true });

    const intervalId = window.setInterval(() => {
      void refreshProjectsRef.current();
    }, POLLING_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  function handleDeleteDialogOpenChange(open: boolean) {
    setDeleteDialogOpen(open);
    if (!open) {
      setDeleteTarget(null);
    }
  }

  function clearSelection() {
    setSelectedRows(new Set());
  }

  function handleOpenProjectById(projectId: string) {
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

    const project = projects.find((item) => item.projectId === projectId);
    if (project) {
      onOpenProject(project);
    }
  }

  function handleProjectCreated() {
    void refreshProjects();
  }

  function handleCreateProjectClick() {
    onCreateProject?.();
    setWizardOpen(true);
  }

  function handleRequestDelete(projectId: string, projectName: string) {
    setDeleteTarget({ id: projectId, name: projectName });
    setDeleteDialogOpen(true);
  }

  function handleAfterDelete() {
    setDeleteTarget(null);
    clearSelection();
    void refreshProjects();
  }

  async function handleBatchDelete(projectIds: string[]) {
    try {
      const results = await Promise.all(projectIds.map((id) => deleteProject(id)));
      const successCount = results.filter((count) => count > 0).length;

      await refreshProjects();
      clearSelection();

      toast({
        title: "Projects deleted",
        description: `Successfully deleted ${successCount} project${successCount === 1 ? "" : "s"}.`,
      });
    } catch (err) {
      const message = resolveErrorMessage(err, "Batch deletion failed");
      toast({ variant: "destructive", title: "Deletion failed", description: message });
    }
  }

  function handleSearchChange(nextSearch: string) {
    setControls((current) => (current.search === nextSearch ? current : { ...current, search: nextSearch }));
  }

  function handleFiltersChange(nextFilters: TableFilters) {
    setControls((current) =>
      tableFiltersEqual(current.filters, nextFilters) ? current : { ...current, filters: nextFilters },
    );
  }

  const visibleProjects = filterProjects(projects, controls.filters, controls.search);

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

  const hasSelection = selectedRows.size > 0;

  useSidebarTwoContentSync({
    selectedRows,
    projects,
    onBatchDelete: handleBatchDelete,
    onOpenProject: handleOpenProjectById,
    clearSelection,
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
            onDeleteSelection={(projectIds) => {
              void handleBatchDelete(projectIds);
            }}
          />
        ) : null
      }
    >
      <div className="flex flex-1 flex-col">
        {error ? (
          <div className="flex flex-1 items-center justify-center px-4 pb-4 pt-2">
            <Alert variant="destructive" className="max-w-md">
              <AlertTitle>Unable to load projects</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : isLoading ? (
          <div className="flex flex-1 flex-col gap-4 px-4 py-6">
            <ProjectsTableSkeleton />
          </div>
        ) : projects.length === 0 ? (
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
        onAfterDelete={handleAfterDelete}
      />
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
          <span className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-full bg-[var(--color-tr-primary-blue)] px-3 text-sm font-semibold text-[var(--color-tr-anti-primary)]">
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
          className="inline-flex h-8 items-center justify-center rounded-md bg-[var(--color-tr-destructive)] px-3 text-sm font-semibold text-[var(--color-tr-destructive-foreground)] transition-all duration-200 hover:saturate-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-tr-destructive)] focus-visible:ring-offset-2"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default ProjectManagerView;
