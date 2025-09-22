import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface ProjectManagerRow {
  id: string;
  name: string;
  created: string;
  updated: string;
  status: string;
}

interface ProjectsTableProps {
  rows: ProjectManagerRow[];
  onOpenProject?: (projectId: string) => void;
  onRequestDelete?: (projectId: string, projectName: string) => void;
}

export function ProjectsTable({ rows, onOpenProject, onRequestDelete }: ProjectsTableProps) {
  return (
    <div className="overflow-hidden rounded-md border border-border/60 bg-background/80 shadow-sm">
      <Table aria-label="Projects table">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[45%]">Project</TableHead>
            <TableHead className="w-[25%]">Dates</TableHead>
            <TableHead className="w-[15%]">Status</TableHead>
            <TableHead className="w-[15%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} role="row">
              <TableCell role="cell">
                <div className="truncate font-medium text-foreground" title={row.name}>
                  {row.name}
                </div>
              </TableCell>
              <TableCell role="cell">
                <div className="flex flex-col text-xs text-muted-foreground">
                  <span>
                    <span className="text-foreground/80">Created:</span> {row.created}
                  </span>
                  <span>
                    <span className="text-foreground/80">Updated:</span> {row.updated}
                  </span>
                </div>
              </TableCell>
              <TableCell role="cell">
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-foreground/90">
                  {row.status}
                </span>
              </TableCell>
              <TableCell role="cell" className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => onOpenProject?.(row.id)} disabled={!onOpenProject}>
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onRequestDelete?.(row.id, row.name)}
                    disabled={!onRequestDelete}
                    aria-label={`Delete project ${row.name}`}
                  >
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
