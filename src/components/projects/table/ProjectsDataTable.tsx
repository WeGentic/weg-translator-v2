import { useMemo, useState } from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { rankItem } from "@tanstack/match-sorter-utils";

import { formatDateParts } from "@/lib/datetime";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useBreakpoint } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { buildColumns } from "./columns";
import { ProjectsTableHeader } from "./ProjectsTableHeader";
import { ProjectsTableToolbar } from "./ProjectsTableToolbar";
import { ProjectsTableGrid } from "./ProjectsTableGrid";
import type { ProjectsDataTableProps, ProjectRow, TableFilters } from "./types";

// Import table animations and data table styles
import "@/styles/table-animations.css";
import "./data-table.css";
import "./new-project-button.css";
// SortingState already imported above via type from react-table

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
  onBatchDelete,
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
    //* Container to hold the entire table with zones: header, toolbar, main content, and footer
    <div className="flex h-full flex-col overflow-hidden rounded-tl-xl rounded-bl-xl border-t border-l border-b border-border bg-popover shadow-sm">
      {/* Header Zone - 54px fixed height */}
      <ProjectsTableHeader onCreateProject={onCreateProject} />

      {/* Toolbar Zone - Contains search, filters, and actions */}
      <div className="projects-table-toolbar-zone">
        <ProjectsTableToolbar
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </div>

      {/* Main Content Zone - Scrollable table area with footer */}
      <div className="flex-1 flex flex-col min-h-0">
        <ProjectsTableGrid
          table={table}
          selectedRows={selectedRows}
          search={search}
        />

        {/* Footer Zone - Positioned at bottom of container (outside scrollable area) */}
        <div className={cn(
          "flex-shrink-0",
          "border-t-2 border-border",
          "bg-gradient-to-r from-muted/15 via-muted/8 to-transparent",
          "backdrop-blur-sm shadow-sm"
        )}>
          <div className="px-4 py-3 text-[11px] font-medium text-primary">
            <div className="flex items-center gap-4">
              {/* Total projects count */}
              <span className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Total Projects:</span>
                <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-semibold bg-primary/15 text-primary rounded border border-primary/30">
                  {filteredData.length}
                </span>
              </span>
              {/* Selected count - only shown when items are selected */}
              {selectedRows.size > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Selected:</span>
                  <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-semibold bg-secondary/20 text-secondary-foreground rounded border border-secondary/40">
                    {selectedRows.size}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
