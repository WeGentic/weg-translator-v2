import { Button } from "@/components/ui/button";

export interface ProjectManagerRow {
  id: string;
  name: string;
  languagePair: string;
  files: number;
  updated: string;
  status: string;
}

interface ProjectsTableProps {
  rows: ProjectManagerRow[];
  onOpenProject?: (projectId: string) => void;
}

export function ProjectsTable({ rows, onOpenProject }: ProjectsTableProps) {
  return (
    <div
      className="space-y-1 overflow-hidden rounded-md border border-border/60 bg-background/80 shadow-sm"
      role="table"
      aria-label="Projects table"
    >
      <div
        className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)_72px_110px_minmax(0,1fr)_minmax(0,0.9fr)] gap-3 border-b border-border/60 bg-muted/40 px-3 py-2 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground"
        role="row"
      >
        <span role="columnheader">Project</span>
        <span role="columnheader">Languages</span>
        <span role="columnheader">Files</span>
        <span role="columnheader">Updated</span>
        <span role="columnheader">Status</span>
        <span role="columnheader" className="text-right">
          Actions
        </span>
      </div>
      {rows.map((row) => (
        <div
          key={row.id}
          className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)_72px_110px_minmax(0,1fr)_minmax(0,0.9fr)] items-center gap-3 px-3 py-2 text-xs"
          role="row"
        >
          <div className="truncate font-medium text-foreground" role="cell">
            {row.name}
          </div>
          <div className="truncate text-muted-foreground" role="cell">
            {row.languagePair}
          </div>
          <div className="text-muted-foreground" role="cell">
            {row.files}
          </div>
          <div className="text-muted-foreground" role="cell">
            {row.updated}
          </div>
          <div className="truncate text-foreground" role="cell">
            {row.status}
          </div>
          <div className="flex justify-end" role="cell">
            <Button size="sm" variant="outline" onClick={() => onOpenProject?.(row.id)} disabled={!onOpenProject}>
              Open Project
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
