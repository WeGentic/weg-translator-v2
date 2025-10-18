import type { Row, Table as TableInstance } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";

import {
  CLIENT_FILTER_OPTIONS,
  type ClientsFilterValue,
} from "@/modules/clients/constants";
import type { ClientRow } from "./columns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { cn } from "@/shared/utils/class-names";

export interface ClientsTableProps {
  table: TableInstance<ClientRow>;
  rows: Row<ClientRow>[];
  searchTerm: string;
  activeFilter: ClientsFilterValue;
  isLoading?: boolean;
}

const FILTER_LABEL_LOOKUP: Record<ClientsFilterValue, string> = CLIENT_FILTER_OPTIONS.reduce(
  (lookup, option) => {
    lookup[option.value] = option.label;
    return lookup;
  },
  {} as Record<ClientsFilterValue, string>,
);

export function ClientsTable({ table, rows, searchTerm, activeFilter, isLoading = false }: ClientsTableProps) {
  if (isLoading) {
    return <ClientsTableSkeleton />;
  }

  const columns = table.getAllColumns();

  return (
    <div className="clients-table-zone rounded-xl border border-[var(--color-tr-border)]/70 bg-[var(--color-tr-white)]/90 shadow-sm">
      <Table aria-label="Clients table" className="text-sm leading-6 text-foreground">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className="border-b border-[var(--color-tr-border)]/80 bg-[var(--color-tr-muted)]/20 backdrop-blur-sm"
            >
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    "px-4 py-3 text-[12px] font-semibold text-[var(--color-tr-primary-blue)]",
                    (header.column.columnDef.meta as ColumnMetaShape | undefined)?.headerClassName,
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-40 px-6 py-8 text-center align-middle">
                <ClientsTableEmptyState searchTerm={searchTerm} filter={activeFilter} />
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => (
              <TableRow
                key={row.id}
                className={cn(
                  "border-b border-[var(--color-tr-border)]/40 transition-colors duration-200",
                  index % 2 === 0
                    ? "bg-[var(--color-tr-white)]/80"
                    : "bg-[var(--color-tr-muted)]/10",
                  "hover:bg-[var(--color-tr-accent)]/15 hover:text-foreground",
                )}
                style={{ animationDelay: `${index * 35}ms` }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      "px-4 py-2 text-[13px] text-[var(--color-tr-sidebar-foreground)]/90 transition-colors duration-200",
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

function ClientsTableEmptyState({
  searchTerm,
  filter,
}: {
  searchTerm: string;
  filter: ClientsFilterValue;
}) {
  const hasSearch = Boolean(searchTerm);
  const filterLabel = FILTER_LABEL_LOOKUP[filter] ?? "All clients";
  const displayFilter = filter !== "all" ? filterLabel : null;

  return (
    <div className="flex flex-col items-center gap-3 text-muted-foreground">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-[var(--color-tr-border)]/70 bg-[var(--color-tr-muted)]/30">
        <svg
          className="h-5 w-5 text-[var(--color-tr-primary-blue)]/80"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2m18 0v-2a4 4 0 00-3-3.87M9 7a4 4 0 118 0 4 4 0 01-8 0zm12 4v-2m0 0V7m0 2h-2m2 0h2"
          />
        </svg>
      </div>
      <div className="space-y-1">
        <p className="text-base font-medium text-foreground">No clients found</p>
        {hasSearch ? (
          <p className="text-sm text-muted-foreground/80">
            Adjust your search for “{searchTerm}” to see more results.
          </p>
        ) : displayFilter ? (
          <p className="text-sm text-muted-foreground/80">
            No records match the “{displayFilter}” filter. Try showing all clients.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground/80">
            Add a new client to get started or import records from the dashboard.
          </p>
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
      className="clients-table-skeleton rounded-xl border border-[var(--color-tr-border)]/70 bg-[var(--color-tr-muted)]/10 p-6 shadow-inner"
    >
      <div className="space-y-3">
        {SKELETON_ROW_KEYS.map((key) => (
          <div key={key} className="h-9 animate-pulse rounded-md bg-[var(--color-tr-muted)]/50" />
        ))}
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
