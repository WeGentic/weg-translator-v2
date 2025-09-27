import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { rankItem } from "@tanstack/match-sorter-utils";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateParts } from "@/lib/datetime";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useBreakpoint } from "@/hooks/useMediaQuery";
import { buildColumns } from "./columns";
import { ProjectsTableToolbar } from "./ProjectsTableToolbar";
import type { ProjectsDataTableProps, ProjectRow, TableFilters } from "./types";
import { cn } from "@/lib/utils";

// Import table animations
import "@/styles/table-animations.css";
// SortingState already imported above via type from react-table

type ColumnMetaShape = {
  headerClassName?: string;
  cellClassName?: string;
};

function fuzzyFilter(row: { getValue: (columnId: string) => unknown }, columnId: string, value: string) {
  const cellValue = row.getValue(columnId);
  const stringValue =
    cellValue == null
      ? ""
      : typeof cellValue === "string"
        ? cellValue
        : typeof cellValue === "number" || typeof cellValue === "boolean"
          ? String(cellValue)
          : "";
  const itemRank = rankItem(stringValue, value);
  return itemRank.passed;
}

function toProjectRow(item: ProjectsDataTableProps["items"][number]): ProjectRow & {
  updatedRaw: number;
  createdRaw: number;
} {
  const created = formatDateParts(item.createdAt);
  const updated = formatDateParts(item.updatedAt);
  return {
    id: item.projectId,
    name: item.name,
    slug: item.slug,
    projectType: item.projectType,
    status: item.status,
    activityStatus: item.activityStatus,
    fileCount: item.fileCount,
    created,
    updated,
    createdRaw: Date.parse(item.createdAt),
    updatedRaw: Date.parse(item.updatedAt),
  };
}

export function ProjectsDataTable({
  items,
  onOpenProject,
  onRequestDelete,
  onCreateProject,
  // Row selection
  selectedRows: controlledSelectedRows,
  onRowSelectionChange: setControlledSelectedRows,
  // Optional controlled state
  sorting: controlledSorting,
  onSortingChange: setControlledSorting,
  search: controlledSearch,
  onSearchChange: setControlledSearch,
  filters: controlledFilters,
  onFiltersChange: setControlledFilters,
}: ProjectsDataTableProps & {
  sorting?: SortingState;
  onSortingChange?: (next: SortingState) => void;
  search?: string;
  onSearchChange?: (next: string) => void;
  filters?: TableFilters;
  onFiltersChange?: (next: TableFilters) => void;
}) {
  const [localSorting, setLocalSorting] = useState<SortingState>([{ id: "updated", desc: true }]);
  const [localSearch, setLocalSearch] = useState("");
  const [localFilters, setLocalFilters] = useState<TableFilters>({ progress: "all", projectType: "all", updatedWithin: "any" });
  const [localSelectedRows, setLocalSelectedRows] = useState<Set<string>>(new Set());

  const sorting = controlledSorting ?? localSorting;
  const setSorting = setControlledSorting ?? setLocalSorting;
  const search = controlledSearch ?? localSearch;
  const setSearch = setControlledSearch ?? setLocalSearch;
  const filters = controlledFilters ?? localFilters;
  const setFilters = setControlledFilters ?? setLocalFilters;
  const selectedRows = controlledSelectedRows ?? localSelectedRows;
  const setSelectedRows = setControlledSelectedRows ?? setLocalSelectedRows;

  const debouncedSearch = useDebouncedValue(search, 250);
  const breakpoint = useBreakpoint();

  const data = useMemo(() => items.map(toProjectRow), [items]);

  const filteredData = useMemo(() => {
    const now = Date.now();
    const thresholdMs =
      filters.updatedWithin === "24h" ? 24 * 60 * 60 * 1000 : filters.updatedWithin === "7d" ? 7 * 24 * 60 * 60 * 1000 : filters.updatedWithin === "30d" ? 30 * 24 * 60 * 60 * 1000 : null;
    return data.filter((row) => {
      if (filters.progress !== "all" && row.activityStatus !== filters.progress) return false;
      if (filters.projectType !== "all" && row.projectType !== filters.projectType) return false;
      if (thresholdMs != null) {
        if (now - row.updatedRaw > thresholdMs) return false;
      }
      return true;
    });
  }, [data, filters]);

  const columns = useMemo(() => buildColumns({
    onOpenProject,
    onRequestDelete,
    onRowSelectionChange: setSelectedRows,
    selectedRows,
    rawItems: items
  }, breakpoint), [onOpenProject, onRequestDelete, setSelectedRows, selectedRows, items, breakpoint]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      globalFilter: debouncedSearch,
    },
    filterFns: { fuzzy: fuzzyFilter },
    globalFilterFn: fuzzyFilter,
    onSortingChange: (updaterOrValue) => {
      const nextState = typeof updaterOrValue === 'function'
        ? updaterOrValue(sorting)
        : updaterOrValue;
      setSorting(nextState);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-background/95 to-background/80 shadow-lg backdrop-blur-sm">
      <ProjectsTableToolbar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFiltersChange={setFilters}
        onCreateProject={onCreateProject}
      />

      <div className="flex-1 overflow-auto">
        <Table aria-label="Projects table" className="text-[14px] leading-6 text-foreground">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-b-2 border-border/50 bg-gradient-to-r from-muted/30 to-muted/10 backdrop-blur-sm">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "px-3 py-2 text-[12px] font-medium normal-case text-muted-foreground/80",
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
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 px-3 py-8 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2 transition-all duration-500 ease-in-out">
                    <div className="h-8 w-8 rounded-full bg-muted/40 flex items-center justify-center">
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
              table.getRowModel().rows.map((row, index) => {
                const isSelected = selectedRows.has(row.original.id);
                return (
                <TableRow
                  key={row.id}
                  className={cn(
                    "group border-b border-border/40 transition-all duration-200 table-row-enter filter-transition",
                    // Alternating row colors
                    index % 2 === 0 ? "bg-background/50" : "bg-muted/20",
                    // Selection styling
                    isSelected && "bg-primary/10 border-primary/30",
                    // Hover styling
                    "hover:bg-gradient-to-r hover:from-muted/30 hover:to-muted/10 hover:shadow-sm"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {row.getVisibleCells().map((cell) => {
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "px-3 py-2 text-[12px] font-normal text-foreground/90 transition-colors duration-200",
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
    </div>
  );
}
