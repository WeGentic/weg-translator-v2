import { IconTooltipButton } from "@/shared/icons";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { FolderOpen, Trash2 } from "lucide-react";

export interface ProjectManagerRow {
  id: string;
  name: string;
  createdLabel: string;
  createdDetail: string;
  updatedLabel: string;
  updatedDetail: string;
  status: string;
}

interface ProjectsTableProps {
  rows: ProjectManagerRow[];
  onOpenProject?: (projectId: string) => void;
  onRequestDelete?: (projectId: string, projectName: string) => void;
}

export function ProjectsTable({ rows, onOpenProject, onRequestDelete }: ProjectsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-background/80 shadow-sm">
      <Table aria-label="Projects table">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[35%]">Project</TableHead>
            <TableHead className="w-[30%]">Dates</TableHead>
            <TableHead className="w-[15%]">Status</TableHead>
            <TableHead className="w-[20%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} role="row" className="transition-colors hover:bg-muted/40">
              <TableCell role="cell">
                <div className="max-w-xs truncate font-medium text-foreground" title={row.name}>
                  {row.name}
                </div>
                </TableCell>
                <TableCell role="cell">
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-foreground/80">Created</span>
                      <time className="font-medium text-foreground" title={row.createdDetail}>
                        {row.createdLabel}
                      </time>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-foreground/80">Updated</span>
                      <time className="font-medium text-foreground" title={row.updatedDetail}>
                        {row.updatedLabel}
                      </time>
                    </div>
                  </div>
                </TableCell>
                <TableCell role="cell">
                  <span className="inline-flex items-center rounded-full border border-border/50 bg-muted/60 px-2 py-0.5 text-xs font-medium text-foreground/90">
                    {row.status}
                  </span>
                </TableCell>
                <TableCell role="cell" className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <IconTooltipButton
                      label="Open project"
                      ariaLabel={`Open project ${row.name}`}
                      onClick={() => onOpenProject?.(row.id)}
                      disabled={!onOpenProject}
                    >
                      <FolderOpen className="h-4 w-4" aria-hidden="true" />
                    </IconTooltipButton>

                    <IconTooltipButton
                      label="Delete project"
                      ariaLabel={`Delete project ${row.name}`}
                      onClick={() => onRequestDelete?.(row.id, row.name)}
                      disabled={!onRequestDelete}
                      tone="destructive"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </IconTooltipButton>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
  );
}
