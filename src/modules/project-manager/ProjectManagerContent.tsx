"use client";

import { useCallback, useMemo, useState } from "react";
import { getCoreRowModel, getSortedRowModel, useReactTable, type SortingState } from "@tanstack/react-table";

import { useBreakpoint } from "@/shared/hooks/use-media-query";
import { formatDateParts } from "@/shared/utils/datetime";

import { ProjectManagerFooter } from "./components/ProjectManagerFooter";
import { ProjectsTableGrid } from "./components/datagrid/ProjectsTableGrid";
import { createProjectColumns, DEFAULT_SORT_COLUMN_ID } from "./components/datagrid/columns";
import type { ProjectManagerContentProps, ProjectRow } from "./state/types";
import { resolveProjectSubjectLabel } from "./constants";

type ExtendedProps = ProjectManagerContentProps & {
  sorting?: SortingState;
  onSortingChange?: (next: SortingState) => void;
  search?: string;
};

function toProjectRow(item: ProjectManagerContentProps["items"][number]): ProjectRow & {
  createdTimestamp: number;
  updatedTimestamp: number;
} {
  const created = formatDateParts(item.createdAt);
  const updated = formatDateParts(item.updatedAt);
  const status = (item.status ?? "READY").toUpperCase();
  const subjects = Array.isArray(item.subjects) ? item.subjects : [];
  const primarySubjectValue = subjects[0] ?? null;
  const primarySubject = resolveProjectSubjectLabel(primarySubjectValue);
  const clientName = item.clientName ?? null;
  return {
    id: item.projectId,
    name: item.name,
    slug: item.slug,
    projectType: item.projectType,
    status,
    activityStatus: item.activityStatus ?? "pending",
    fileCount: item.fileCount ?? 0,
    subjects,
    primarySubject,
    clientName,
    created,
    updated,
    createdTimestamp: Date.parse(item.createdAt),
    updatedTimestamp: Date.parse(item.updatedAt),
    createdIso: item.createdAt,
    updatedIso: item.updatedAt,
  };
}

const DEFAULT_SORTING: SortingState = [{ id: DEFAULT_SORT_COLUMN_ID, desc: true }];

export function ProjectManagerContent({
  items,
  onOpenProject,
  onRequestDelete,
  selectedRows: controlledSelectedRows,
  onRowSelectionChange: setControlledSelectedRows,
  sorting: controlledSorting,
  onSortingChange: setControlledSorting,
  search: controlledSearch,
}: ExtendedProps) {
  const [localSorting, setLocalSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>([]);

  const controlledSelectedIds = useMemo(
    () => (controlledSelectedRows ? Array.from(controlledSelectedRows) : null),
    [controlledSelectedRows],
  );

  const selectedIds = controlledSelectedIds ?? localSelectedIds;
  // Convert to a Set only where the table API requires it; the source of truth stays immutable.
  const selectedRows = useMemo(() => new Set(selectedIds), [selectedIds]);

  const setSelectedIds = useCallback(
    (nextIds: ReadonlyArray<string>) => {
      if (setControlledSelectedRows) {
        setControlledSelectedRows(new Set(nextIds));
        return;
      }
      setLocalSelectedIds(Array.from(nextIds));
    },
    [setControlledSelectedRows],
  );

  const sorting = controlledSorting ?? localSorting;
  const setSorting = setControlledSorting ?? setLocalSorting;
  const search = controlledSearch ?? "";
  const tableRows = useMemo(() => items.map(toProjectRow), [items]);
  const breakpoint = useBreakpoint();

  const columnHandlers = useMemo(
    () => ({
      onOpenProject,
      onRequestDelete,
      onSelectionChange: setSelectedIds,
      selectedIds,
    }),
    [onOpenProject, onRequestDelete, setSelectedIds, selectedIds],
  );

  const columns = useMemo(
    () =>
      createProjectColumns({
        handlers: columnHandlers,
        breakpoint,
      }),
    [columnHandlers, breakpoint],
  );

  const handleSortingChange = useCallback(
    (updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
      const nextState = typeof updaterOrValue === "function" ? updaterOrValue(sorting) : updaterOrValue;
      setSorting(nextState);
    },
    [sorting, setSorting],
  );

  const table = useReactTable({
    data: tableRows,
    columns,
    state: {
      sorting,
    },
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rowModel = table.getRowModel();
  const tableDisplayRows = rowModel.rows;

  return (
    <section className="flex h-full w-full min-h-0 flex-1 flex-col" aria-label="Project Manager main content">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <ProjectsTableGrid table={table} rows={tableDisplayRows} selectedRows={selectedRows} search={search} />
      </div>
      <ProjectManagerFooter totalProjects={items.length} selectedCount={selectedIds.length} />
    </section>
  );
}
