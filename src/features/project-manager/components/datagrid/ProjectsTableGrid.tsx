import type { Table as TableInstance } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ProjectRow } from "../../types/types";

type ColumnMetaShape = {
  headerClassName?: string;
  cellClassName?: string;
};

/**
 * ProjectsTableGrid Component
 *
 * Renders the main table grid with enhanced styling and features:
 * - Glassmorphism header with subtle vertical dividers
 * - Modern row hover/selection/odd-even effects using theme colors
 * - Smooth animations and transitions
 *
 * Note: Footer has been moved to parent component (ProjectsDataTable)
 *
 * @param table - TanStack table instance
 * @param selectedRows - Set of selected row IDs
 * @param search - Current search query (for empty state messaging)
 */
export interface ProjectsTableGridProps {
  table: TableInstance<ProjectRow>;
  selectedRows: Set<string>;
  search: string;
}

export function ProjectsTableGrid({ table, selectedRows, search }: ProjectsTableGridProps) {
  const columns = table.getAllColumns();

  return (
    <div className="projects-table-main-zone">
      <Table aria-label="Projects table" className="text-[14px] leading-6 text-foreground">
        {/* Enhanced Header with Glassmorphism Effect */}
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className={cn(
                // Enhanced border using theme color
                "border-b-2 border-[var(--color-tr-border)]",
                // Glassmorphism effect: gradient background with backdrop blur
                "bg-gradient-to-r from-[var(--color-tr-muted)]/20 via-[var(--color-tr-muted)]/10 to-transparent",
                "backdrop-blur-sm",
                // Subtle shadow for depth
                "shadow-sm",
              )}
            >
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    // Base header styling with theme colors
                    "px-3 py-3 text-[12px] font-semibold normal-case",
                    "text-[var(--color-tr-primary-blue)]",
                    // Custom header class from column meta (includes vertical-separator-partial)
                    (header.column.columnDef.meta as ColumnMetaShape | undefined)?.headerClassName,
                  )}
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        {/* Table Body with Enhanced Row Effects */}
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            // Empty state row
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
            // Data rows with modern hover/selection/odd-even effects
            table.getRowModel().rows.map((row, index) => {
              const isSelected = selectedRows.has(row.original.id);
              return (
              <TableRow
                key={row.id}
                className={cn(
                  // Base row styling with smooth transitions
                  "group border-b transition-all duration-200 table-row-enter filter-transition",
                  // Border color using theme variable
                  "border-[var(--color-tr-border)]/40",
                  // Odd/even row striping using theme colors
                  index % 2 === 0
                    ? "bg-[var(--color-tr-white)]/50" // Even rows: lighter background
                    : "bg-[var(--color-tr-muted)]/15", // Odd rows: slightly tinted
                  // Selection state: highlighted with primary color
                  isSelected && "bg-[var(--color-tr-primary-blue)]/10 border-[var(--color-tr-primary-blue)]/40",
                  // Hover state: gradient overlay with elevation
                  "hover:bg-gradient-to-r hover:from-[var(--color-tr-accent)]/8 hover:via-[var(--color-tr-muted)]/15 hover:to-transparent",
                  "hover:shadow-md hover:shadow-[var(--color-tr-primary-blue)]/5",
                  // Slight scale effect on hover for modern feel
                  "hover:scale-[1.001] hover:z-10",
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {row.getVisibleCells().map((cell) => {
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        // Base cell styling
                        "px-3 py-2 text-[12px] font-normal transition-colors duration-200",
                        // Text color using theme variable
                        "text-[var(--color-tr-navy)]/90",
                        // Custom cell class from column meta (includes vertical-separator-partial)
                        (cell.column.columnDef.meta as ColumnMetaShape | undefined)?.cellClassName,
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
