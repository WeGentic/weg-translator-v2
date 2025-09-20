import { FolderKanban, Plus } from "lucide-react";

import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

export type SidebarState = "expanded" | "compact" | "hidden";

type WorkspaceSidebarProps = {
  state: SidebarState;
  onCreateProject: () => void;
};

type ProjectManagerRow = {
  id: string;
  name: string;
  languagePair: string;
  files: number;
  updated: string;
  status: string;
};

const PROJECT_MANAGER_ROWS: ProjectManagerRow[] = [
  {
    id: "PJT-001",
    name: "Marketing Site Localisation",
    languagePair: "EN → ES",
    files: 12,
    updated: "2024-07-18",
    status: "In progress",
  },
  {
    id: "PJT-002",
    name: "Mobile App Strings",
    languagePair: "EN → DE",
    files: 9,
    updated: "2024-07-11",
    status: "Ready for QA",
  },
  {
    id: "PJT-003",
    name: "Support Knowledge Base",
    languagePair: "EN → IT",
    files: 27,
    updated: "2024-07-02",
    status: "Awaiting review",
  },
];

export function WorkspaceSidebar({ state, onCreateProject }: WorkspaceSidebarProps) {
  if (state === "hidden") {
    return null;
  }

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border/60 bg-card/70 backdrop-blur transition-[width] duration-200",
        state === "expanded" ? "w-72" : "w-20",
      )}
    >
      {state === "expanded" ? (
        <>
          <div className="px-4 pb-4 pt-6">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Project Manager
              </p>
              <h2 className="text-lg font-semibold text-foreground">Active Projects</h2>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Preview your translation projects and continue where you left off.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <ProjectManagerTable rows={PROJECT_MANAGER_ROWS} />
          </div>
          <div className="border-t border-border/60 px-4 py-4">
            <Button className="w-full" onClick={onCreateProject}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Create new project
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center gap-4 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground">
            <FolderKanban className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Project Manager</span>
          </div>
          <Button size="icon" onClick={onCreateProject}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Create new project</span>
          </Button>
        </div>
      )}
    </aside>
  );
}

function ProjectManagerTable({ rows }: { rows: ProjectManagerRow[] }) {
  return (
    <div className="space-y-1 overflow-hidden rounded-md border border-border/60 bg-background/80">
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)_72px_110px_minmax(0,1fr)] gap-3 border-b border-border/60 bg-muted/40 px-3 py-2 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
        <span>Project</span>
        <span>Languages</span>
        <span>Files</span>
        <span>Updated</span>
        <span>Status</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.id}
          className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)_72px_110px_minmax(0,1fr)] items-center gap-3 px-3 py-2 text-xs"
        >
          <div className="truncate font-medium text-foreground">{row.name}</div>
          <div className="truncate text-muted-foreground">{row.languagePair}</div>
          <div className="text-muted-foreground">{row.files}</div>
          <div className="text-muted-foreground">{row.updated}</div>
          <div className="truncate text-foreground">{row.status}</div>
        </div>
      ))}
    </div>
  );
}
