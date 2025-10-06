import { useMemo } from "react";
import { getCoreRowModel, type RowSelectionState, useReactTable, type Table } from "@tanstack/react-table";

import type { ProjectListItem } from "@/ipc";

import { projectsTableColumns } from "./columns";
import type { ProjectTableMeta } from "./types";

export interface UseProjectsTableOptions {
  data: ProjectListItem[];
  selectedIds: ReadonlySet<string>;
  onSelectionChange: (selectedIds: string[]) => void;
  onRequestDelete?: (project: ProjectListItem) => void;
  onOpenProject?: (project: ProjectListItem) => void;
}

function toRowSelectionState(selectedIds: ReadonlySet<string>): RowSelectionState {
  if (selectedIds.size === 0) {
    return {};
  }
  const result: RowSelectionState = {};
  selectedIds.forEach((id) => {
    if (typeof id === "string" && id.length > 0) {
      result[id] = true;
    }
  });
  return result;
}

function resolveSelectedIds(rowSelection: RowSelectionState): string[] {
  const ids: string[] = [];
  for (const [id, isSelected] of Object.entries(rowSelection)) {
    if (isSelected) {
      ids.push(id);
    }
  }
  return ids;
}

export function useProjectsTable({
  data,
  selectedIds,
  onSelectionChange,
  onRequestDelete,
  onOpenProject,
}: UseProjectsTableOptions): Table<ProjectListItem> {
  const rowSelection = useMemo(() => toRowSelectionState(selectedIds), [selectedIds]);

  const meta: ProjectTableMeta = useMemo(
    () => ({
      onRequestDelete,
      onOpenProject,
    }),
    [onRequestDelete, onOpenProject],
  );

  return useReactTable({
    data,
    columns: projectsTableColumns,
    state: { rowSelection },
    enableRowSelection: true,
    enableMultiRowSelection: true,
    getRowId: (project) => project.projectId,
    onRowSelectionChange: (updater) => {
      const nextState = typeof updater === "function" ? updater(rowSelection) : updater;
      onSelectionChange(resolveSelectedIds(nextState));
    },
    getCoreRowModel: getCoreRowModel(),
    meta: { projectManager: meta },
  });
}

