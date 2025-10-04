import { useMemo, useState } from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { rankItem } from "@tanstack/match-sorter-utils";

import { useBreakpoint } from "@/hooks/useMediaQuery";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDateParts } from "@/lib/datetime";
import { cn } from "@/lib/utils";

import { ProjectsTableGrid } from "./components/datagrid/ProjectsTableGrid";
import { buildColumns } from "./components/datagrid/columns";
import type { ProjectManagerContentProps, ProjectRow, TableFilters } from "./types/types";

function fuzzyFilter(
  row: { getValue: (columnId: string) => unknown },
  columnId: string,
  value: string,
) {
  const cellValue = row.getValue(columnId);
  const stringValue =
    cellValue == null
      ? ''
      : typeof cellValue === 'string'
        ? cellValue
        : typeof cellValue === "number" || typeof cellValue === "boolean"
          ? String(cellValue)
          : "";
  const itemRank = rankItem(stringValue, value);
  return itemRank.passed;
}

function toProjectRow(item: ProjectManagerContentProps["items"][number]): ProjectRow & {
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

const DEFAULT_FILTERS: TableFilters = {
  progress: "all",
  projectType: "all",
  updatedWithin: "any",
};

type ExtendedProps = ProjectManagerContentProps & {
  sorting?: SortingState;
  onSortingChange?: (next: SortingState) => void;
  search?: string;
  onSearchChange?: (next: string) => void;
  filters?: TableFilters;
  onFiltersChange?: (next: TableFilters) => void;
};

export function ProjectManagerContent({
  items,
  onOpenProject,
  onRequestDelete,
  selectedRows: controlledSelectedRows,
  onRowSelectionChange: setControlledSelectedRows,
  sorting: controlledSorting,
  onSortingChange: setControlledSorting,
  search: controlledSearch,
  filters: controlledFilters,
}: ExtendedProps) {
  const [localSorting, setLocalSorting] = useState<SortingState>([{ id: "updated", desc: true }]);
  const [localSelectedRows, setLocalSelectedRows] = useState<Set<string>>(() => new Set());

  const selectedRows = controlledSelectedRows ?? localSelectedRows;
  const setSelectedRows = setControlledSelectedRows ?? setLocalSelectedRows;
  const sorting = controlledSorting ?? localSorting;
  const setSorting = setControlledSorting ?? setLocalSorting;
  const filters = controlledFilters ?? DEFAULT_FILTERS;
  const search = controlledSearch ?? "";

  const data = useMemo(() => items.map(toProjectRow), [items]);
  const breakpoint = useBreakpoint();
  const debouncedSearch = useDebouncedValue(search, 250);

  const filteredData = useMemo(() => {
    const now = Date.now();
    const thresholdMs =
      filters.updatedWithin === "24h"
        ? 24 * 60 * 60 * 1000
        : filters.updatedWithin === "7d"
          ? 7 * 24 * 60 * 60 * 1000
          : filters.updatedWithin === "30d"
            ? 30 * 24 * 60 * 60 * 1000
            : null;
    return data.filter((row) => {
      if (filters.progress !== "all" && row.activityStatus !== filters.progress) return false;
      if (filters.projectType !== "all" && row.projectType !== filters.projectType) return false;
      if (thresholdMs != null) {
        if (now - row.updatedRaw > thresholdMs) return false;
      }
      return true;
    });
  }, [data, filters]);

  const searchFilteredData = useMemo(() => {
    const query = debouncedSearch.trim();
    if (query.length === 0) return filteredData;

    return filteredData.filter((row) => {
      const fields: Array<string | number | undefined> = [
        row.name,
        row.slug,
        row.projectType,
        row.status,
        row.activityStatus,
      ];

      return fields.some((value) => {
        if (value == null) return false;
        const stringValue = typeof value === "string" ? value : String(value);
        return rankItem(stringValue, query).passed;
      });
    });
  }, [filteredData, debouncedSearch]);

  const columns = useMemo(
    () =>
      buildColumns(
        {
          onOpenProject,
          onRequestDelete,
          onRowSelectionChange: setSelectedRows,
          selectedRows,
          rawItems: items,
        },
        breakpoint,
      ),
    [onOpenProject, onRequestDelete, setSelectedRows, selectedRows, items, breakpoint],
  );

  const table = useReactTable({
    data: searchFilteredData,
    columns,
    state: {
      sorting,
      globalFilter: debouncedSearch,
    },
    filterFns: { fuzzy: fuzzyFilter },
    globalFilterFn: fuzzyFilter,
    onSortingChange: (updaterOrValue) => {
      const nextState =
        typeof updaterOrValue === "function" ? updaterOrValue(sorting) : updaterOrValue;
      setSorting(nextState);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-label="Project Manager main content">
      <div className="flex-1 overflow-auto">
        <ProjectsTableGrid table={table} selectedRows={selectedRows} search={search} />
      </div>

      <div
        className={cn(
          "flex-shrink-0",
          "border-t-2 border-border",
          "bg-gradient-to-r from-muted/15 via-muted/8 to-transparent",
          "backdrop-blur-sm shadow-sm",
        )}
      >
        <div className="px-4 py-3 text-[11px] font-medium text-primary">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Total Projects:</span>
              <span className="inline-flex h-5 min-w-[24px] items-center justify-center rounded border border-primary/30 bg-primary/15 px-1.5 text-[11px] font-semibold text-primary">
                {searchFilteredData.length}
              </span>
            </span>
            {selectedRows.size > 0 ? (
              <span className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Selected:</span>
                <span className="inline-flex h-5 min-w-[24px] items-center justify-center rounded border border-secondary/40 bg-secondary/20 px-1.5 text-[11px] font-semibold text-secondary-foreground">
                  {selectedRows.size}
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
