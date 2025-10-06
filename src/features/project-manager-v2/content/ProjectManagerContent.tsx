import { flexRender } from "@tanstack/react-table";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProjectListItem } from "@/ipc";
import { cn } from "@/lib/utils";

import { filterProjectsByPreset, filterProjectsBySearch, normalizeSearch } from "../data";
import { useProjectManagerSelector } from "../state";
import { useProjectsTable, type ProjectColumnMeta } from "../table";

interface ProjectManagerContentProps {
  projects: ProjectListItem[];
  onRequestDelete: (project: ProjectListItem) => void;
  onOpenProject?: (project: ProjectListItem) => void;
}

export function ProjectManagerContent({ projects, onRequestDelete, onOpenProject }: ProjectManagerContentProps) {
  const search = useProjectManagerSelector((state) => state.search);
  const replaceSelection = useProjectManagerSelector((state) => state.replaceSelection);
  const selectedIds = useProjectManagerSelector((state) => state.selectedIds);
  const filters = useProjectManagerSelector((state) => state.filters);

  const filteredProjects = filterProjectsByPreset(projects, filters);
  const visibleProjects = filterProjectsBySearch(filteredProjects, search);
  const hasQuery = normalizeSearch(search).length > 0;

  if (projects.length === 0) {
    return (
      <section className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/60 bg-background/40">
        <div className="space-y-2 text-center">
          <h2 className="text-base font-semibold text-foreground">No projects yet</h2>
          <p className="text-sm text-muted-foreground">Create your first project to get started.</p>
        </div>
      </section>
    );
  }

  if (visibleProjects.length === 0) {
    return (
      <section className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/60 bg-background/40">
        <div className="space-y-2 text-center">
          <h2 className="text-base font-semibold text-foreground">No matches</h2>
          <p className="text-sm text-muted-foreground">
            {hasQuery ? "Adjust your search to see more projects." : "Try refreshing to load new projects."}
          </p>
        </div>
      </section>
    );
  }

  const table = useProjectsTable({
    data: visibleProjects,
    selectedIds,
    onSelectionChange: replaceSelection,
    onRequestDelete,
    onOpenProject,
  });

  const headerGroups = table.getHeaderGroups();
  const rowModel = table.getRowModel();

  return (
    <section className="flex flex-1 flex-col rounded-xl border border-border bg-background/80 shadow-sm">
      <div className="h-full overflow-auto">
        <Table className="min-w-[720px]">
          <TableHeader>
            {headerGroups.map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-[var(--color-tr-muted)]/50">
                {headerGroup.headers.map((header) => {
                  if (header.isPlaceholder) {
                    return <TableHead key={header.id} />;
                  }

                  const meta = header.column.columnDef.meta as ProjectColumnMeta | undefined;
                  const headerClassName = resolveHeaderClassName(meta);

                  return (
                    <TableHead key={header.id} className={headerClassName}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rowModel.rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className={cn(
                  "transition-colors",
                  "hover:bg-[var(--color-tr-muted)]/40",
                  "data-[state=selected]:bg-[var(--color-tr-accent)]/25",
                  "data-[state=selected]:text-[var(--color-tr-sidebar-foreground)]",
                )}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as ProjectColumnMeta | undefined;
                  const cellClassName = resolveCellClassName(meta);
                  return (
                    <TableCell key={cell.id} className={cellClassName}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function resolveHeaderClassName(meta?: ProjectColumnMeta) {
  const align = meta?.headerAlign ?? "left";
  return cn(
    "align-middle text-xs font-semibold uppercase tracking-wide text-[var(--color-tr-muted-foreground)]",
    alignClass(align),
    meta?.headerClassName,
  );
}

function resolveCellClassName(meta?: ProjectColumnMeta) {
  const align = meta?.cellAlign ?? "left";
  return cn("align-middle", alignClass(align), meta?.cellClassName);
}

function alignClass(alignment: "left" | "center" | "right") {
  switch (alignment) {
    case "center":
      return "text-center";
    case "right":
      return "text-right";
    default:
      return "text-left";
  }
}
