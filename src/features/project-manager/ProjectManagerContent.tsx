import { useMemo, useState } from "react";
import { getCoreRowModel, getSortedRowModel, useReactTable, type SortingState } from "@tanstack/react-table";

import { useBreakpoint } from "@/hooks/useMediaQuery";
import { formatDateParts } from "@/lib/datetime";

import { ProjectsTableGrid } from "./components/datagrid/ProjectsTableGrid";
import { buildColumns } from "./components/datagrid/columns";
import { ProjectManagerFooter } from "./components/ProjectManagerFooter";
import { filterProjects } from "./utils/filterProjects";
import type { ProjectManagerContentProps, ProjectRow, TableFilters } from "./types/types";

const DEFAULT_FILTERS: TableFilters = {
  progress: "all",
  projectType: "all",
  updatedWithin: "any",
};

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

type ExtendedProps = ProjectManagerContentProps & {
  sorting?: SortingState;
  onSortingChange?: (next: SortingState) => void;
  search?: string;
  filters?: TableFilters;
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
  const search = controlledSearch ?? "";
  const filters = controlledFilters ?? DEFAULT_FILTERS;

  const filteredProjects = useMemo(
    () => filterProjects(items, filters, search),
    [items, filters.progress, filters.projectType, filters.updatedWithin, search],
  );

  const tableRows = useMemo(() => filteredProjects.map(toProjectRow), [filteredProjects]);
  const breakpoint = useBreakpoint();

  const columns = useMemo(
    () =>
      buildColumns(
        {
          onOpenProject,
          onRequestDelete,
          onRowSelectionChange: setSelectedRows,
          selectedRows,
          rawItems: filteredProjects,
        },
        breakpoint,
      ),
    [onOpenProject, onRequestDelete, setSelectedRows, selectedRows, filteredProjects, breakpoint],
  );

  const table = useReactTable({
    data: tableRows,
    columns,
    state: {
      sorting,
    },
    onSortingChange: (updaterOrValue) => {
      const nextState =
        typeof updaterOrValue === "function" ? updaterOrValue(sorting) : updaterOrValue;
      setSorting(nextState);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rowModel = table.getRowModel();
  const tableDisplayRows = rowModel.rows;

  return (
    <section className="flex h-full w-full min-h-0 flex-1 flex-col" aria-label="Project Manager main content">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <ProjectsTableGrid
          table={table}
          rows={tableDisplayRows}
          selectedRows={selectedRows}
          search={search}
        />
      </div>
      <ProjectManagerFooter
        totalProjects={filteredProjects.length}
        selectedCount={selectedRows.size}
      />
    </section>
  );
}
