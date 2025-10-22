import type { Row, Table as TableInstance } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";

import { LuFileQuestion } from "react-icons/lu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { cn } from "@/shared/utils/class-names";
import type { ProjectRow } from "../../state/types";
import "../../css/project-manager-table.css";

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
    <div className="clients-project-manager-main-zone">
      <Table aria-label="Projects table" className="text-[14px] leading-6 text-foreground table-fixed">
        <TableHeader
        className="
            bg-(--color-gradient-parchment-peacock-400)
            text-(--color-gradient-parchment-peacock-800)
            ">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className={cn(
                "border-b-2 border-(--color-aquaverde-500)",
                "backdrop-blur-sm",
                "shadow-sm",
              )}
            >
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    "px-3 py-3 text-[14px] font-semibold normal-case",
                    "text-(--color-victorian-peacock-950)",
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
              <TableCell colSpan={columns.length} 
                className="h-32 px-3 py-8 text-center text-(--color-victorian-peacock-950)">
                <div className="flex flex-col items-center gap-2 transition-all duration-500 ease-in-out">
                  <div className="h-20 w-20 rounded-full bg-(--color-destructive) flex items-center justify-center">
                    <LuFileQuestion className="h-10 w-10 text-(--color-victorian-peacock-50)" />
                  </div>
                  <div>
                    <p className="text-[20px]">No projects found</p>
                    {search && <p className="text-sm text-(--color-victorian-peacock-800)">for "{search}"</p>}
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
                  "border-(--color-aquaverde-100)/40",
                  index % 2 === 0 ? "bg-(--color-aquaverde-100)" : "bg-(--color-aquaverde-200)",
                  isSelected && "bg-(--color-secondary)/10 border-(--color-primary)/40",
                  "hover:bg-linear-to-r hover:from-(--color-aquaverde-300)/50 hover:via-(--color-aquaverde-300)/50 hover:to-transparent",
                  "hover:shadow-md hover:shadow-(--color-aquaverde-500)/5",
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
                        "text-[var(--color-navy)]/90",
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
