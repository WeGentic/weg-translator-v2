import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteProject, listProjects, type ProjectListItem } from "@/ipc";
import type { SortingState } from "@tanstack/react-table";
import { useToast } from "@/components/ui/use-toast";
import type { TableFilters } from "./table";
import { useLayoutStoreApi } from "@/app/layout/layout-context";

import { ProjectsDataTable, ProjectsBatchActionsPanel } from "./table";
import { ProjectsTableSkeleton } from "./table/ProjectsTableSkeleton";
import { CreateProjectWizard } from "./wizard/CreateProjectWizard";
import { ProjectsOverviewCard } from "./overview/ProjectsOverviewCard";

type ProjectsPanelProps = {
  onOpenProject?: (project: ProjectListItem) => void;
};

export function ProjectsPanel({ onOpenProject }: ProjectsPanelProps = {}) {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isWizardOpen, setWizardOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const { toast } = useToast();
  const layoutStore = useLayoutStoreApi();

  // Table controlled state (preserved across polling)
  const [tableSorting, setTableSorting] = useState<SortingState>([{ id: "updated", desc: true }]);
  const [tableSearch, setTableSearch] = useState("");
  const [tableFilters, setTableFilters] = useState<TableFilters>({ progress: "all", projectType: "all", updatedWithin: "any" });

  // Row selection state
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const loadProjects = useCallback(async (options: { showSpinner?: boolean } = {}) => {
    if (options.showSpinner) {
      setIsLoading(true);
    }

    try {
      setError(null);
      const response = await listProjects({ limit: 100 });
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
  }, []);

  useEffect(() => {
    void loadProjects({ showSpinner: true });
    // Lightweight polling to reflect DB changes without manual refresh
    if (pollingRef.current != null) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    const id = window.setInterval(() => {
      void loadProjects();
    }, 1500);
    pollingRef.current = id;
    return () => {
      window.clearInterval(id);
      pollingRef.current = null;
    };
  }, [loadProjects]);

  // Legacy rows mapping is no longer needed with ProjectsDataTable

  const handleOpenProject = useCallback(
    (projectId: string) => {
      if (!onOpenProject) return;
      const project = projects.find((item) => item.projectId === projectId);
      if (!project) return;
      onOpenProject(project);
    },
    [onOpenProject, projects],
  );

  const handleProjectCreated = useCallback(() => {
    void loadProjects();
  }, [loadProjects]);

  const handleRequestDelete = useCallback((projectId: string, projectName: string) => {
    setDeleteTarget({ id: projectId, name: projectName });
    setDeleteConfirm("");
    setDeleteOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    const target = deleteTarget;
    setDeleteOpen(false);
    try {
      if (!target) return;
      const deleted = await deleteProject(target.id);
      // Re-fetch and verify project absence
      const refreshed = await listProjects({ limit: 100 });
      const exists = refreshed.some((p) => p.projectId === target.id);
      if (deleted > 0 && !exists) {
        toast({ title: "Project deleted", description: `Deleted "${target.name}".` });
        setProjects(refreshed);
      } else {
        toast({ variant: "destructive", title: "Deletion failed", description: `Could not delete "${target.name}".` });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Deletion failed";
      toast({ variant: "destructive", title: "Deletion failed", description: message });
    } finally {
      setDeleteTarget(null);
      setDeleteConfirm("");
    }
  }, [deleteTarget, toast]);

  const handleBatchDelete = useCallback(async (projectIds: string[]) => {
    try {
      // Delete all selected projects
      const deletePromises = projectIds.map(id => deleteProject(id));
      const results = await Promise.all(deletePromises);

      const successCount = results.filter(count => count > 0).length;

      // Refresh project list
      const refreshed = await listProjects({ limit: 100 });
      setProjects(refreshed);

      // Clear selections
      setSelectedRows(new Set());

      // Show success toast
      toast({
        title: "Projects deleted",
        description: `Successfully deleted ${successCount} project${successCount > 1 ? "s" : ""}.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Batch deletion failed";
      toast({ variant: "destructive", title: "Deletion failed", description: message });
    }
  }, [toast]);

  // Update Sidebar Two content based on selection
  // Automatically opens Sidebar Two if hidden when user makes a selection
  useEffect(() => {
    const store = layoutStore.getState();
    const sidebarTwo = store.sidebarTwo;

    if (selectedRows.size > 0) {
      // Auto-open Sidebar Two if it's hidden when user selects projects
      // This ensures the batch actions panel is immediately visible
      if (!sidebarTwo.visible) {
        store.setSidebarTwo({ visible: true });
      }

      // Derive selected project data
      const selectedProjectNames = Array.from(selectedRows)
        .map(id => projects.find(p => p.projectId === id)?.name)
        .filter((name): name is string => name !== undefined);

      const selectedProjectIds = Array.from(selectedRows);

      // Dispatch event to update sidebar title
      window.dispatchEvent(new CustomEvent("sidebar-two:title", { detail: { title: "Projects" } }));

      // Show batch actions panel in Sidebar Two
      store.setSidebarTwoContent(
        <ProjectsBatchActionsPanel
          selectedCount={selectedRows.size}
          selectedProjectNames={selectedProjectNames}
          selectedProjectIds={selectedProjectIds}
          onBatchDelete={handleBatchDelete}
          onClearSelection={() => setSelectedRows(new Set())}
          onOpenProject={handleOpenProject}
        />
      );
    } else {
      // Show overview card when no selections
      // Calculate statistics from current projects
      const activeProjects = projects.filter(p => p.status === "active").length;
      const totalFiles = projects.reduce((sum, p) => sum + p.fileCount, 0);
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const recentlyUpdated = projects.filter(p => {
        const updatedTime = Date.parse(p.updatedAt);
        return !Number.isNaN(updatedTime) && updatedTime >= oneDayAgo;
      }).length;

      // Dispatch event to update sidebar title
      window.dispatchEvent(new CustomEvent("sidebar-two:title", { detail: { title: "Overview" } }));

      store.setSidebarTwoContent(
        <ProjectsOverviewCard
          totalProjects={projects.length}
          activeProjects={activeProjects}
          totalFiles={totalFiles}
          recentlyUpdated={recentlyUpdated}
        />
      );
    }
  }, [selectedRows, projects, layoutStore, handleBatchDelete, handleOpenProject]);

  return (
    <section className="flex h-full w-full flex-col" aria-labelledby="projects-heading">
      

      <div className="flex flex-col gap-3 px-2">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load projects</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="flex-1">
        {isLoading ? (
          <ProjectsTableSkeleton />
        ) : projects.length === 0 ? (
          <EmptyProjectsState onCreate={() => setWizardOpen(true)} />
        ) : (
          <ProjectsDataTable
            items={projects}
            onOpenProject={handleOpenProject}
            onRequestDelete={handleRequestDelete}
            onCreateProject={() => setWizardOpen(true)}
            onBatchDelete={handleBatchDelete}
            selectedRows={selectedRows}
            onRowSelectionChange={setSelectedRows}
            sorting={tableSorting}
            onSortingChange={setTableSorting}
            search={tableSearch}
            onSearchChange={setTableSearch}
            filters={tableFilters}
            onFiltersChange={setTableFilters}
          />
        )}
      </div>

      <CreateProjectWizard open={isWizardOpen} onOpenChange={setWizardOpen} onProjectCreated={handleProjectCreated} />

      {/* Delete Project Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent aria-describedby="delete-project-desc">
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
            <DialogDescription id="delete-project-desc">
              This action permanently deletes the project and its files from disk. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <p className="text-sm text-muted-foreground">
                To confirm, type the project name exactly as shown:
              </p>
              <p className="mt-1 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-sm font-medium text-foreground">
                {deleteTarget?.name ?? "—"}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-name">Project name</Label>
              <Input
                id="confirm-name"
                autoFocus
                placeholder="Enter project name to confirm"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={!deleteTarget || deleteConfirm.trim() !== (deleteTarget?.name ?? "")}
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notifications handled by ToastProvider */}
    </section>
  );
}

// Retain legacy helpers (removed) — now handled by ProjectsDataTable formatting utilities

function EmptyProjectsState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex h-80 flex-col items-center justify-center gap-4 text-center animate-in fade-in-50 slide-in-from-bottom-4 duration-700">
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative rounded-full border border-border/50 bg-gradient-to-br from-muted/60 to-muted/40 p-6 shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-muted-foreground transition-colors duration-300 group-hover:text-primary"
            aria-hidden
          >
            <path
              d="M4 7a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z"
              stroke="currentColor"
              strokeWidth="1.5"
              className="transition-all duration-300"
            />
            <path
              d="M12 10v6m-3-3h6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
          </svg>
        </div>
      </div>

      <div className="space-y-2 animate-in slide-in-from-bottom-2 duration-700 delay-200">
        <h3 className="text-lg font-semibold text-foreground">No projects yet</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Create your first project to start translating files and managing your content with AI-powered tools.
        </p>
      </div>

      <Button
        type="button"
        onClick={onCreate}
        className="mt-4 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105 hover:from-primary/90 hover:to-primary animate-in slide-in-from-bottom-2 duration-700 delay-300"
        size="lg"
      >
        <Plus className="mr-2 h-5 w-5" aria-hidden />
        Create your first project
      </Button>
    </div>
  );
}
