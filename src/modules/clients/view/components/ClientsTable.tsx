import type { Row, Table as TableInstance } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";

import type { ClientRow } from "./columns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { cn } from "@/shared/utils/class-names";

export interface ClientsTableProps {
  table: TableInstance<ClientRow>;
  rows: Row<ClientRow>[];
  searchTerm: string;
  isLoading?: boolean;
}

export function ClientsTable({ table, rows, searchTerm, isLoading = false }: ClientsTableProps) {
  if (isLoading) {
    return <ClientsTableSkeleton />;
  }

  const columns = table.getVisibleLeafColumns();

  return (
    <div className="projects-table-main-zone clients-table-main-zone">
      <Table aria-label="Clients table" className="table-fixed text-[14px] leading-6 text-foreground">
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
                <ClientsTableEmptyState searchTerm={searchTerm} />
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => (
              <TableRow
                key={row.id}
                className={cn(
                  "group border-b transition-all duration-200 table-row-enter filter-transition",
                  "border-[var(--color-tr-border)]/40",
                  index % 2 === 0 ? "bg-[var(--color-tr-white)]/50" : "bg-[var(--color-tr-muted)]/15",
                  "hover:bg-gradient-to-r hover:from-[var(--color-tr-accent)]/8 hover:via-[var(--color-tr-muted)]/15 hover:to-transparent",
                  "hover:shadow-md hover:shadow-[var(--color-tr-primary-blue)]/5",
                  "hover:scale-[1.001] hover:z-10",
                )}
                style={{ animationDelay: `${index * 35}ms` }}
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
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function ClientsTableEmptyState({ searchTerm }: { searchTerm: string }) {
  const hasSearch = Boolean(searchTerm);

  return (
    <div className="flex flex-col items-center gap-2 transition-all duration-500 ease-in-out">
      <div className="h-8 w-8 rounded-full bg-[var(--color-tr-muted)]/40 flex items-center justify-center">
        <svg className="h-4 w-4 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M16 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2m18 0v-2a4 4 0 00-3-3.87M9 7a4 4 0 118 0 4 4 0 01-8 0zm12 4v-2m0 0V7m0 2h-2m2 0h2"
          />
        </svg>
      </div>
      <div className="space-y-1">
        <p className="font-medium text-foreground">No clients found</p>
        {hasSearch ? (
          <p className="text-sm text-muted-foreground/80">for “{searchTerm}”</p>
        ) : (
          <p className="text-sm text-muted-foreground/80">Add a new client to get started.</p>
        )}
      </div>
    </div>
  );
}

function ClientsTableSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading clients"
      className="clients-table-skeleton overflow-hidden rounded-xl border border-border/60 bg-background/80 shadow-sm"
    >
      <div className="p-3">
        <div className="space-y-2">
          {SKELETON_ROW_KEYS.map((key) => (
            <div key={key} className="h-9 animate-pulse rounded-md bg-muted/50" />
          ))}
        </div>
      </div>
    </div>
  );
}

const SKELETON_ROW_KEYS = [
  "clients-skeleton-row-1",
  "clients-skeleton-row-2",
  "clients-skeleton-row-3",
  "clients-skeleton-row-4",
  "clients-skeleton-row-5",
];

type ColumnMetaShape = {
  headerClassName?: string;
  cellClassName?: string;
};
