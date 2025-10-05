import "../main-view.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SortingState } from "@tanstack/react-table";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { ProjectsTableSkeleton } from "@/components/projects/table/ProjectsTableSkeleton";
import { deleteProject, listProjects, type ProjectListItem } from "@/ipc";
import { filterProjects } from "./utils/filterProjects";

import { ProjectsManagerHeader } from "./ProjectManagerHeader";
import { ProjectsManagerToolbar } from "./ProjectManagerToolbar";
import { ProjectManagerContent } from "./ProjectManagerContent";
import { EmptyProjectsState } from "./components/EmptyProjectsState";
import { CreateProjectWizard } from "./components/wizard/CreateProjectWizard";
import { DeleteProjectDialog } from "./components/DeleteProjectDialog";
import { useSidebarTwoContentSync } from "./hooks/useSidebarTwoContentSync";
import type { TableFilters } from "./types/types";

const DEFAULT_SORTING: SortingState = [{ id: "updated", desc: true }];
const DEFAULT_FILTERS: TableFilters = {
  progress: "all",
  projectType: "all",
  updatedWithin: "any",
};
const POLLING_INTERVAL_MS = 1500;
const LIST_LIMIT = 100;

type ProjectManagerViewProps = {
  onOpenProject?: (project: ProjectListItem) => void;
  onCreateProject?: () => void;
};

type DeleteTarget = { id: string; name: string } | null;

export function ProjectManagerView({ onOpenProject, onCreateProject }: ProjectManagerViewProps = {}) {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isWizardOpen, setWizardOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<TableFilters>(DEFAULT_FILTERS);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const { toast } = useToast();

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) {
      setDeleteTarget(null);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  const loadProjects = useCallback(
    async (options: { showSpinner?: boolean } = {}) => {
      if (options.showSpinner) {
        setIsLoading(true);
      }

      try {
        setError(null);
        const response = await listProjects({ limit: LIST_LIMIT });
        setProjects(response);
      } catch (unknownError) {
        const message =
          unknownError instanceof Error ? unknownError.message : "Unable to load projects.";
        setError(message);
      } finally {
        if (options.showSpinner) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadProjects({ showSpinner: true });

    const intervalId = window.setInterval(() => {
      void loadProjects();
    }, POLLING_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadProjects]);

  const handleOpenProjectById = useCallback(
    (projectId: string) => {
      if (!onOpenProject) return;
      const project = projects.find((item) => item.projectId === projectId);
      if (project) {
        onOpenProject(project);
      }
    },
    [onOpenProject, projects],
  );

  const handleProjectCreated = useCallback(() => {
    void loadProjects();
  }, [loadProjects]);

  const handleCreateProjectClick = useCallback(() => {
    onCreateProject?.();
    setWizardOpen(true);
  }, [onCreateProject]);

  const handleRequestDelete = useCallback((projectId: string, projectName: string) => {
    setDeleteTarget({ id: projectId, name: projectName });
    setDeleteDialogOpen(true);
  }, []);

  const handleAfterDelete = useCallback(() => {
    setDeleteTarget(null);
    clearSelection();
    void loadProjects();
  }, [clearSelection, loadProjects]);

  const handleBatchDelete = useCallback(
    async (projectIds: string[]) => {
      try {
        const results = await Promise.all(projectIds.map((id) => deleteProject(id)));
        const successCount = results.filter((count) => count > 0).length;

        await loadProjects();
        clearSelection();

        toast({
          title: "Projects deleted",
          description: `Successfully deleted ${successCount} project${successCount === 1 ? "" : "s"}.`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Batch deletion failed";
        toast({ variant: "destructive", title: "Deletion failed", description: message });
      }
    },
    [clearSelection, loadProjects, toast],
  );

  const handleBatchDeleteRequest = useCallback(
    (ids: string[]) => handleBatchDelete(ids),
    [handleBatchDelete],
  );

  const visibleProjects = useMemo(
    () => filterProjects(projects, filters, search),
    [projects, filters.progress, filters.projectType, filters.updatedWithin, search],
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

  useSidebarTwoContentSync({
    selectedRows,
    projects,
    onBatchDelete: handleBatchDeleteRequest,
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
        
          <ProjectsManagerHeader onCreateProject={handleCreateProjectClick} />

          <div className="projects-table-toolbar-zone">
            <ProjectsManagerToolbar
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFiltersChange={setFilters}
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
                search={search}
                filters={filters}
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
