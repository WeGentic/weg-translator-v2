import "@/shared/styles/main-view.css";
import "./css/dropdowns.css";
import "./css/data-table.css";
import "./css/new-project-button.css";

import { useEffect, useRef, useState } from "react";
import type { SortingState } from "@tanstack/react-table";

import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { useToast } from "@/shared/ui/use-toast";
import { ProjectsTableSkeleton } from "@/modules/projects/ui/table/ProjectsTableSkeleton";
import { deleteProject, listProjects, type ProjectListItem } from "@/core/ipc";
import { filterProjects } from "./state/filterProjects";

import { ProjectManagerHeader } from "./ProjectManagerHeader";
import { ProjectManagerToolbar } from "./ProjectManagerToolbar";
import { ProjectManagerContent } from "./ProjectManagerContent";
import { EmptyProjectsState } from "./components/EmptyProjectsState";
import { CreateProjectWizard } from "./components/wizard/CreateProjectWizard";
import { DeleteProjectDialog } from "./components/DeleteProjectDialog";
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

type ProjectManagerViewProps = {
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

export function ProjectManagerView({ onOpenProject, onCreateProject }: ProjectManagerViewProps = {}) {
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
    if (!onOpenProject) return;
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
    // Selection state is pruned when filters/search hide previously selected rows.
    // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect -- pruning must update the backing Set to keep sidebar parity
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

  useSidebarTwoContentSync({
    selectedRows,
    projects,
    onBatchDelete: handleBatchDelete,
    onOpenProject: handleOpenProjectById,
    clearSelection,
  });

  const showEmptyState = !isLoading && projects.length === 0 && error == null;

  return (
    <section
      className="mainview-container flex flex-1 min-h-0 flex-col"
      aria-labelledby="ProjectManager-heading"
      id="ProjectManager-view"
      role="region"
    >
      <div className="flex flex-1 min-h-0 flex-col">
        <ProjectManagerHeader onCreateProject={handleCreateProjectClick} />

        <div className="projects-table-toolbar-zone">
          <ProjectManagerToolbar
            search={controls.search}
            onSearchChange={handleSearchChange}
            filters={controls.filters}
            onFiltersChange={handleFiltersChange}
          />
        </div>

        {error ? (
          <div className="px-4 pb-2">
            <Alert variant="destructive">
              <AlertTitle>Could not load projects</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        <div className="flex flex-1 min-h-0">
          {isLoading ? (
            <ProjectsTableSkeleton />
          ) : showEmptyState ? (
            <EmptyProjectsState onCreate={handleCreateProjectClick} />
          ) : (
            <ProjectManagerContent
              items={visibleProjects}
              onOpenProject={handleOpenProjectById}
              onRequestDelete={handleRequestDelete}
              selectedRows={selectedRows}
              onRowSelectionChange={setSelectedRows}
              sorting={sorting}
              onSortingChange={setSorting}
              search={controls.search}
            />
          )}
        </div>
      </div>

      <CreateProjectWizard open={isWizardOpen} onOpenChange={setWizardOpen} onProjectCreated={handleProjectCreated} />

      <DeleteProjectDialog
        open={deleteDialogOpen}
        onOpenChange={handleDeleteDialogOpenChange}
        target={deleteTarget}
        onAfterDelete={handleAfterDelete}
      />
    </section>
  );
}

export default ProjectManagerView;
