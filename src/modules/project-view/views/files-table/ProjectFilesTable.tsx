
import { useCallback, useMemo, useState } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { ArrowUpDown, PencilLine, RotateCcw, Trash2 } from "lucide-react";

import type { ProjectFileBundle, ArtifactRecord, ProjectLanguagePair } from "@/shared/types/database";
import type { AssetFilters, AssetGrouping } from "../ProjectViewAssetFilters";
import type { ProjectFileRoleValue } from "../../constants";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/utils/class-names";

import styles from "./ProjectFilesTable.module.css";

export type ProjectFilesTableProps = {
  files: ProjectFileBundle[];
  filters: AssetFilters;
  grouping: AssetGrouping;
  roleOptions: ReadonlyArray<{ value: ProjectFileRoleValue; label: string }>;
  isBusy?: boolean;
  onOpenFile?: (fileUuid: string) => void;
  onRegenerateFile?: (fileUuid: string) => void | Promise<void>;
  onRegenerateSelection?: (fileUuids: string[]) => void | Promise<void>;
  onRemoveFile?: (fileUuid: string) => void;
  onChangeRole?: (fileUuid: string, nextRole: ProjectFileRoleValue, storedRelPath: string) => void;
};

type FileRow = {
  id: string;
  name: string;
  roleValue: ProjectFileRoleValue;
  roleLabel: string;
  sizeLabel: string;
  languages: string[];
  statusValue: string;
  storedRelPath: string;
};

export function ProjectFilesTable({
  files,
  filters,
  grouping,
  roleOptions,
  isBusy = false,
  onOpenFile,
  onRegenerateFile,
  onRegenerateSelection,
  onRemoveFile,
  onChangeRole: _onChangeRole,
}: ProjectFilesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const rows = useMemo<FileRow[]>(() => buildRows(files, roleOptions), [files, roleOptions]);

  const validIds = useMemo(() => new Set(rows.map((row) => row.id)), [rows]);

  const effectiveSelectedIds = useMemo(() => {
    if (grouping !== "flat" || selectedIds.size === 0) {
      return new Set<string>();
    }
    const next = new Set<string>();
    selectedIds.forEach((id) => {
      if (validIds.has(id)) {
        next.add(id);
      }
    });
    return next.size === selectedIds.size ? selectedIds : next;
  }, [grouping, selectedIds, validIds]);

  const filteredRows = useMemo(() => filterRows(rows, filters), [rows, filters]);

  const selectedCount = useMemo(() => countSelected(filteredRows, effectiveSelectedIds), [
    filteredRows,
    effectiveSelectedIds,
  ]);

  const isSelectionDisabled = grouping !== "flat";
  const isAllSelected = !isSelectionDisabled && filteredRows.every((row) => effectiveSelectedIds.has(row.id)) && filteredRows.length > 0;
  const isSomeSelected = !isSelectionDisabled && selectedCount > 0 && !isAllSelected;

  const toggleRow = useCallback(
    (rowId: string, checked: boolean) => {
      if (grouping !== "flat") return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (checked) {
          next.add(rowId);
        } else {
          next.delete(rowId);
        }
        return next;
      });
    },
    [grouping],
  );

  const toggleAll = useCallback(
    (checked: boolean) => {
      if (grouping !== "flat") return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (checked) {
          filteredRows.forEach((row) => next.add(row.id));
        } else {
          filteredRows.forEach((row) => next.delete(row.id));
        }
        return next;
      });
    },
    [filteredRows, grouping],
  );

  const clearSelection = useCallback(() => {
    if (effectiveSelectedIds.size === 0) return;
    setSelectedIds(new Set());
  }, [effectiveSelectedIds.size]);

  const handleBulkRegenerate = useCallback(() => {
    if (!onRegenerateSelection) {
      return;
    }
    const targets = Array.from(effectiveSelectedIds);
    if (targets.length === 0) {
      return;
    }
    const outcome = onRegenerateSelection(targets);
    if (typeof outcome !== "undefined") {
      void Promise.resolve(outcome).finally(() => {
        setSelectedIds(new Set());
      });
    } else {
      setSelectedIds(new Set());
    }
  }, [effectiveSelectedIds, onRegenerateSelection]);

  if (grouping === "role") {
    return (
      <section aria-label="Project files grouped by role" className="space-y-2">
        <h2 className="text-xs font-semibold text-foreground">Project files</h2>
        <GroupedFilesView rows={filteredRows} onOpenFile={onOpenFile} isBusy={isBusy} roleOptions={roleOptions} />
      </section>
    );
  }

  return (
    <section aria-label="Project files" className="space-y-2">
      <h2 className={`${styles.label} pl-4 pb-4 text-foreground`}>Project files</h2>

      {selectedCount > 0 ? (
        <div className="flex items-center justify-between rounded border border-border/50 bg-muted/10 px-2 py-1 text-[11px] text-foreground">
          <span>
            {selectedCount} file{selectedCount === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={clearSelection}
            >
              Clear
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={handleBulkRegenerate}
              disabled={!onRegenerateSelection || isBusy}
            >
              Regenerate selected
            </Button>
          </div>
        </div>
      ) : null}

      <PlainTable
        rows={filteredRows}
        sorting={sorting}
        onSortingChange={setSorting}
        roleOptions={roleOptions}
        onOpenFile={onOpenFile}
        onRegenerateFile={onRegenerateFile}
        selectedIds={effectiveSelectedIds}
        isAllSelected={isAllSelected}
        isSomeSelected={isSomeSelected}
        onToggleAll={toggleAll}
        onToggleRow={toggleRow}
        onRemoveFile={onRemoveFile}
        isBusy={isBusy}
        selectionDisabled={isSelectionDisabled}
      />
    </section>
  );
}

type PlainTableProps = {
  rows: FileRow[];
  sorting: SortingState;
  onSortingChange: (state: SortingState) => void;
  onOpenFile?: (fileUuid: string) => void;
  onRegenerateFile?: (fileUuid: string) => void | Promise<void>;
  onRemoveFile?: (fileUuid: string) => void;
  roleOptions: ReadonlyArray<{ value: ProjectFileRoleValue; label: string }>;
  isBusy: boolean;
  selectedIds: Set<string>;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  onToggleAll: (checked: boolean) => void;
  onToggleRow: (rowId: string, checked: boolean) => void;
  selectionDisabled: boolean;
};

function PlainTable({
  rows,
  sorting,
  onSortingChange,
  onOpenFile,
  onRegenerateFile,
  onRemoveFile,
  roleOptions,
  isBusy,
  selectedIds,
  isAllSelected,
  isSomeSelected,
  onToggleAll,
  onToggleRow,
  selectionDisabled,
}: PlainTableProps) {
  const columns = useMemo<ColumnDef<FileRow>[]>(
    () => [
      {
        id: "selection",
        header: () => (
          <Checkbox
            aria-label="Select all files"
            checked={isAllSelected ? true : isSomeSelected ? "indeterminate" : false}
            onCheckedChange={(value) => onToggleAll(value !== false)}
            disabled={selectionDisabled || isBusy || rows.length === 0}
            className="translate-y-[1px]"
          />
        ),
        cell: ({ row }) => {
          const isSelected = selectedIds.has(row.original.id);
          return (
            <Checkbox
              aria-label={`Select ${row.original.name}`}
              checked={isSelected}
              onCheckedChange={(value) => onToggleRow(row.original.id, value === true)}
              disabled={selectionDisabled || isBusy}
              className="translate-y-[1px]"
            />
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 text-left text-[12px] font-medium text-foreground normal-case"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Name
            <ArrowUpDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
          </button>
        ),
        cell: ({ row }) => {
          const original = row.original;
          const canOpen = Boolean(onOpenFile) && !isBusy;
          return (
            <div className="flex flex-col">
              <button
                type="button"
                className={cn(
                  "text-[13px] font-medium text-foreground",
                  canOpen ? "hover:underline" : "text-muted-foreground",
                )}
                onClick={canOpen ? () => onOpenFile?.(original.id) : undefined}
                disabled={!canOpen}
              >
                {original.name}
              </button>
              <span className="text-[11px] text-muted-foreground">{original.sizeLabel}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "role",
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 text-left text-[12px] font-medium text-foreground normal-case"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Role
            <ArrowUpDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
          </button>
        ),
        cell: ({ row }) => {
          const currentRole = row.original.roleValue;
          const disabled = isBusy || !onChangeRole;
          return (
            <Select
              value={currentRole}
              disabled={disabled}
              onValueChange={(value) => {
                if (!onChangeRole) return;
                if (value === currentRole) return;
                onChangeRole(row.original.id, value as ProjectFileRoleValue, row.original.storedRelPath);
              }}
            >
              <SelectTrigger
                className="w-[150px] justify-between text-[12px]"
                aria-label={`Change file role for ${row.original.name}`}
              >
                <SelectValue placeholder={row.original.roleLabel} />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
      },
      {
        accessorKey: "languages",
        header: () => <span className="text-[12px] font-medium text-foreground normal-case">Language pairs</span>,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-x-2 gap-y-[2px] text-[10px] leading-4 text-muted-foreground">
            {row.original.languages.length > 0 ? (
              row.original.languages.map((lang) => <span key={lang}>{lang}</span>)
            ) : (
              <span>—</span>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <span className="text-[12px] font-medium text-foreground normal-case">Actions</span>,
        cell: ({ row }) => (
          <div className="flex items-center gap-1" aria-label={`Actions for ${row.original.name}`}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onOpenFile?.(row.original.id)}
                  disabled={!onOpenFile || isBusy}
                >
                  <PencilLine className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">Open in editor</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in editor</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    if (!onRegenerateFile) return;
                    void onRegenerateFile(row.original.id);
                  }}
                  disabled={!onRegenerateFile || isBusy}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">Regenerate XLIFF</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{onRegenerateFile ? "Regenerate XLIFF" : "Regeneration coming soon"}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onRemoveFile?.(row.original.id)}
                  disabled={!onRemoveFile || isBusy}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">Remove file</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{onRemoveFile ? "Remove file" : "Removal flow coming soon"}</TooltipContent>
            </Tooltip>
          </div>
        ),
      },
    ],
    [
      isAllSelected,
      isBusy,
      isSomeSelected,
      onOpenFile,
      onRegenerateFile,
      onRemoveFile,
      onToggleAll,
      onToggleRow,
      roleOptions,
      rows,
      selectedIds,
      selectionDisabled,
    ],
  );

  const table = useReactTable<FileRow>({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      onSortingChange(next);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div>
      <Table className="w-full border-collapse text-[13px]">
        <TableHeader className="bg-transparent">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-b border-border/40">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="h-8 px-2 py-1 text-left text-[12px] font-medium text-foreground normal-case tracking-normal"
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
          {table.getRowModel().rows.length === 0 ? (
            <TableRow className="border-none">
              <TableCell colSpan={columns.length} className="px-2 py-2 text-center text-[12px] text-muted-foreground">
                No files match the current filters.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(
                  "border-b border-border/40 text-[13px]",
                  selectedIds.has(row.original.id) && "bg-muted/10",
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-2 py-1 align-middle text-[12px] text-foreground">
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

type GroupedFilesViewProps = {
  rows: FileRow[];
  onOpenFile?: (fileUuid: string) => void;
  isBusy: boolean;
  roleOptions: ReadonlyArray<{ value: ProjectFileRoleValue; label: string }>;
};

function GroupedFilesView({ rows, onOpenFile, isBusy, roleOptions }: GroupedFilesViewProps) {
  const grouped = useMemo(() => {
    const buckets = new Map<string, FileRow[]>();
    rows.forEach((row) => {
      const key = row.roleValue || "processable";
      const bucket = buckets.get(key) ?? [];
      bucket.push(row);
      buckets.set(key, bucket);
    });
    return Array.from(buckets.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  return (
    <div className="space-y-2">
      {grouped.map(([role, entries]) => (
        <div key={role} className="space-y-1">
          <h3 className="text-[12px] font-medium text-foreground">
            {resolveRoleLabel(role, roleOptions)} <span className="text-[10px] text-muted-foreground">({entries.length})</span>
          </h3>
          <ul className="space-y-1">
            {entries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded px-2 py-1 text-left text-[12px] text-foreground",
                    onOpenFile && !isBusy ? "hover:bg-muted/10" : "text-muted-foreground",
                  )}
                  onClick={onOpenFile && !isBusy ? () => onOpenFile(entry.id) : undefined}
                  disabled={!onOpenFile || isBusy}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{entry.name}</span>
                    <div className="flex flex-wrap gap-x-2 gap-y-[2px] text-[10px] text-muted-foreground">
                      {entry.languages.length > 0 ? entry.languages.map((lang) => <span key={lang}>{lang}</span>) : <span>—</span>}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {grouped.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">No files match the current filters.</p>
      ) : null}
    </div>
  );
}

function buildRows(
  files: ProjectFileBundle[],
  roleOptions: ReadonlyArray<{ value: ProjectFileRoleValue; label: string }>,
): FileRow[] {
  return files.map((bundle) => {
    const statusValue = deriveStatusValue(bundle.artifacts ?? []);
    const roleValue = normalizeProjectFileRole(bundle.file.type);
    return {
      id: bundle.file.fileUuid,
      name: bundle.file.filename,
      roleValue,
      roleLabel: resolveRoleLabel(roleValue, roleOptions),
      sizeLabel: formatSize(bundle.info?.sizeBytes),
      languages: deriveLanguages(bundle.languagePairs ?? []),
      statusValue,
      storedRelPath: bundle.file.storedAt,
    };
  });
}

function filterRows(rows: FileRow[], filters: AssetFilters) {
  const searchTerm = filters.search.trim().toLowerCase();
  return rows.filter((row) => {
    const matchesSearch = searchTerm.length === 0 || row.name.toLowerCase().includes(searchTerm);
    const matchesRole = filters.role === "all" || row.roleValue === filters.role;
    const matchesStatus = filters.status === "all" || row.statusValue === filters.status;
    return matchesSearch && matchesRole && matchesStatus;
  });
}

function countSelected(rows: FileRow[], selectedIds: Set<string>) {
  if (selectedIds.size === 0) return 0;
  let count = 0;
  rows.forEach((row) => {
    if (selectedIds.has(row.id)) {
      count += 1;
    }
  });
  return count;
}

function deriveStatusValue(artifacts: ArtifactRecord[]) {
  if (!artifacts || artifacts.length === 0) {
    return "pending";
  }

  const priority: Record<string, number> = {
    failed: 4,
    error: 3,
    running: 2,
    pending: 1,
    completed: 0,
    success: 0,
  };

  const sorted = [...artifacts].sort((a, b) => {
    const aPriority = priority[a.status.toLowerCase()] ?? -1;
    const bPriority = priority[b.status.toLowerCase()] ?? -1;
    return bPriority - aPriority;
  });

  const primary = sorted[0];
  const status = primary.status.toLowerCase();

  if (status === "failed" || status === "error") {
    return "failed";
  }
  if (status === "running") {
    return "running";
  }
  if (status === "completed" || status === "success") {
    return "completed";
  }
  return "pending";
}

function deriveLanguages(pairs: ProjectLanguagePair[]) {
  if (!pairs || pairs.length === 0) {
    return [];
  }
  return pairs.map((pair) => `${pair.sourceLang} → ${pair.targetLang}`);
}

function normalizeProjectFileRole(value: string | null | undefined): ProjectFileRoleValue {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    case "reference":
    case "instructions":
    case "image":
      return normalized;
    case "processable":
    case "source":
    case "xliff":
    case "translation":
      return "processable";
    default:
      return "processable";
  }
}

function resolveRoleLabel(
  role: string,
  options: ReadonlyArray<{ value: ProjectFileRoleValue; label: string }>,
) {
  const match = options.find((option) => option.value === role);
  if (match) return match.label;
  return formatRole(role) || role;
}

function formatRole(role: string | undefined) {
  if (!role) return "";
  const lower = role.toLowerCase();
  return lower.replace(/[_-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatSize(size?: number | null) {
  if (typeof size !== "number" || Number.isNaN(size) || size <= 0) {
    return "—";
  }
  const units = ["B", "KB", "MB", "GB"];
  let index = 0;
  let value = size;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

// DATE_FORMATTER retained for potential future metadata but unused currently.

export default ProjectFilesTable;
