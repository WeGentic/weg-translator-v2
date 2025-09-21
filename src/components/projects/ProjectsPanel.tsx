import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Loader2, Plus, RotateCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { listProjects, type CreateProjectResponse, type ProjectListItem } from "@/ipc";

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
  const [isRefreshing, startRefresh] = useTransition();

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
    startRefresh(() => {
      void loadProjects();
    });
  }, [loadProjects, startRefresh]);

  const handleRefresh = useCallback(() => {
    startRefresh(() => {
      void loadProjects({ showSpinner: true });
    });
  }, [loadProjects, startRefresh]);

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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={handleRefresh} disabled={isLoading || isRefreshing}>
              {isRefreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCw className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Refresh
            </Button>
          </div>
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
          <ProjectsTable rows={rows} onOpenProject={handleOpenProject} />
        )}
      </div>

      <CreateProjectWizard open={isWizardOpen} onOpenChange={setWizardOpen} onProjectCreated={handleProjectCreated} />
    </section>
  );
}

function toRowViewModel(project: ProjectListItem): ProjectManagerRow {
  return {
    id: project.projectId,
    name: project.name,
    languagePair: "—",
    files: project.fileCount,
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
