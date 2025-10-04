/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import "../main-view.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLayoutStoreApi } from "@/app/layout/layout-context";
import { useToast } from "@/components/ui/use-toast";
import { ProjectsManagerHeader } from "./ProjectManagerHeader";
import { ProjectListItem, TableFilters } from "./types/types";
import { SortingState } from "node_modules/@tanstack/table-core/build/lib/features/RowSorting";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProjectsBatchActionsPanel } from "./components/ProjectsBatchActionsPanel";
import { ProjectsOverviewCard } from "./components/ProjectsOverviewCard";
import { ProjectsManagerToolbar } from "./ProjectManagerToolbar";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CreateProjectWizard } from "./components/wizard/CreateProjectWizard";
import { deleteProject, listProjects } from "@/ipc";
import { ProjectManagerContent } from "./ProjectManagerContent";

type ProjectManagerViewProps = {
  onOpenProject?: (project: ProjectListItem) => void;
  sorting?: SortingState;
  onSortingChange?: (next: SortingState) => void;
  search?: string;
  onSearchChange?: (next: string) => void;
  filters?: TableFilters;
  onFiltersChange?: (next: TableFilters) => void;
   onCreateProject?: () => void;
};

export function ProjectManagerView({
  onOpenProject,
  onCreateProject,
  // Row selection
  selectedRows: controlledSelectedRows,
  onRowSelectionChange: setControlledSelectedRows,
  // Optional controlled state
  sorting: controlledSorting,
  onSortingChange: setControlledSorting,
  search: controlledSearch,
  onSearchChange: setControlledSearch,
  filters: controlledFilters,
  onFiltersChange: setControlledFilters,
}: ProjectManagerViewProps = {}) {

    {/* Old code from ProjectPanel */}
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
    <section className="mainview-container" aria-labelledby="ProjectManager-heading" id="ProjectManager-view" role="region">
        <ProjectsManagerHeader onCreateProject={onCreateProject} />
        <div className="projects-table-toolbar-zone">
                <ProjectsManagerToolbar
                  search={search}
                  onSearchChange={setSearch}
                  filters={filters}
                  onFiltersChange={setFilters}
                />
              </div>
        <div className="flex flex-col gap-3 px-2">
        <ProjectManagerContent
          items={projects}
          onOpenProject={handleOpenProject}
          onRequestDelete={handleRequestDelete}
          selectedRows={selectedRows}
          onRowSelectionChange={setSelectedRows}
          sorting={sorting}
          onSortingChange={setSorting}
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFiltersChange={setFilters}
        />

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load projects</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
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

    </section>
  );
}

export default ProjectManagerView;