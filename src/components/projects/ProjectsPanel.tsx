import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteProject, listProjects, type CreateProjectResponse, type ProjectListItem } from "@/ipc";

import { ProjectsTable, type ProjectManagerRow } from "./components/ProjectsTable";
import { CreateProjectWizard } from "./wizard/CreateProjectWizard";

type ProjectsPanelProps = {
  onOpenProject?: (project: ProjectListItem) => void;
};

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export function ProjectsPanel({ onOpenProject }: ProjectsPanelProps = {}) {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isWizardOpen, setWizardOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [snack, setSnack] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!snack) return;
    const id = window.setTimeout(() => setSnack(null), 3000);
    return () => window.clearTimeout(id);
  }, [snack]);

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
      if (pollingRef.current != null) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [loadProjects]);

  const rows = useMemo(() => projects.map(toRowViewModel), [projects]);

  const handleOpenProject = useCallback(
    (projectId: string) => {
      if (!onOpenProject) return;
      const project = projects.find((item) => item.projectId === projectId);
      if (!project) return;
      onOpenProject(project);
    },
    [onOpenProject, projects],
  );

  const handleProjectCreated = useCallback((_: CreateProjectResponse) => {
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
        setSnack({ kind: "success", message: `Deleted project “${target.name}”.` });
        setProjects(refreshed);
      } else {
        setSnack({ kind: "error", message: `Failed to delete project “${target.name}”.` });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Deletion failed";
      setSnack({ kind: "error", message });
    } finally {
      setDeleteTarget(null);
      setDeleteConfirm("");
    }
  }, [deleteTarget]);

  return (
    <section className="flex w-full flex-col gap-4 p-6" aria-labelledby="projects-heading">
      <div className="px-2">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Projects</p>
          <h2 id="projects-heading" className="text-lg font-semibold text-foreground">
            Active Projects
          </h2>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Preview your translation projects and continue where you left off.
        </p>
      </div>

      <div className="flex flex-col gap-3 px-2">
        <div className="flex items-center justify-end gap-2">
          <Button type="button" onClick={() => setWizardOpen(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Create new project
          </Button>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load projects</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Loading projects…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <p>No projects yet.</p>
            <p className="text-xs">Create your first project to get started.</p>
          </div>
        ) : (
          <ProjectsTable rows={rows} onOpenProject={handleOpenProject} onRequestDelete={handleRequestDelete} />
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
              onClick={handleConfirmDelete}
              disabled={!deleteTarget || deleteConfirm.trim() !== (deleteTarget?.name ?? "")}
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Snackbar notification */}
      {snack ? (
        <div className="fixed bottom-4 right-4 z-50 w-[320px] animate-in fade-in slide-in-from-bottom-2">
          <div
            role="status"
            className={
              snack.kind === "success"
                ? "rounded-md border border-border/70 bg-background/95 px-4 py-3 text-sm text-foreground shadow-lg"
                : "rounded-md border border-destructive/60 bg-destructive/15 px-4 py-3 text-sm text-destructive-foreground shadow-lg"
            }
          >
            {snack.message}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function toRowViewModel(project: ProjectListItem): ProjectManagerRow {
  return {
    id: project.projectId,
    name: project.name,
    created: formatDate(project.createdAt),
    updated: formatDate(project.updatedAt),
    status: formatStatus(project.status),
  } satisfies ProjectManagerRow;
}

function formatDate(isoDate: string) {
  const parsed = Number.isNaN(Date.parse(isoDate)) ? null : new Date(isoDate);
  if (!parsed) {
    return "—";
  }
  return DATE_FORMATTER.format(parsed);
}

function formatStatus(status: ProjectListItem["status"]) {
  if (status === "archived") return "Archived";
  return "Active";
}
