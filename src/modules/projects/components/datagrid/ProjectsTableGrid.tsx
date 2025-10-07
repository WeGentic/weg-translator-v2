import type { Row, Table as TableInstance } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { cn } from "@/shared/utils/class-names";
import type { ProjectRow } from "../../state/types";

type ColumnMetaShape = {
  headerClassName?: string;
  cellClassName?: string;
};

export interface ProjectsTableGridProps {
  table: TableInstance<ProjectRow>;
  rows: Row<ProjectRow>[];
  selectedRows: ReadonlySet<string>;
  search: string;
}

export function ProjectsTableGrid({ table, rows, selectedRows, search }: ProjectsTableGridProps) {
  const columns = table.getAllColumns();

  return (
    <div className="projects-table-main-zone">
      <Table aria-label="Projects table" className="text-[14px] leading-6 text-foreground table-fixed">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className={cn(
                "border-b-2 border-[var(--color-tr-border)]",
                "bg-gradient-to-r from-[var(--color-tr-muted)]/20 via-[var(--color-tr-muted)]/10 to-transparent",
                "backdrop-blur-sm",
                "shadow-sm",
              )}
            >
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    "px-3 py-3 text-[12px] font-semibold normal-case",
                    "text-[var(--color-tr-primary-blue)]",
                    (header.column.columnDef.meta as ColumnMetaShape | undefined)?.headerClassName,
                  )}
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-32 px-3 py-8 text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2 transition-all duration-500 ease-in-out">
                  <div className="h-8 w-8 rounded-full bg-[var(--color-tr-muted)]/40 flex items-center justify-center">
                    <svg className="h-4 w-4 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium">No projects found</p>
                    {search && <p className="text-sm text-muted-foreground/80">for "{search}"</p>}
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => {
              const isSelected = selectedRows.has(row.original.id);
              return (
                <TableRow
                  key={row.id}
                  className={cn(
                    "group border-b transition-all duration-200 table-row-enter filter-transition",
                    "border-[var(--color-tr-border)]/40",
                    index % 2 === 0
                      ? "bg-[var(--color-tr-white)]/50"
                      : "bg-[var(--color-tr-muted)]/15",
                    isSelected && "bg-[var(--color-tr-primary-blue)]/10 border-[var(--color-tr-primary-blue)]/40",
                    "hover:bg-gradient-to-r hover:from-[var(--color-tr-accent)]/8 hover:via-[var(--color-tr-muted)]/15 hover:to-transparent",
                    "hover:shadow-md hover:shadow-[var(--color-tr-primary-blue)]/5",
                    "hover:scale-[1.001] hover:z-10",
                  )}
                  aria-selected={isSelected}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "px-3 py-2 text-[12px] font-normal transition-colors duration-200",
                        "text-[var(--color-tr-navy)]/90",
                        (cell.column.columnDef.meta as ColumnMetaShape | undefined)?.cellClassName,
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
