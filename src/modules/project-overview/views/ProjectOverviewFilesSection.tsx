import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { ArrowUpDown, PencilLine, RotateCcw, Trash2 } from "lucide-react";

import type { ProjectFileBundle, ArtifactRecord, ProjectLanguagePair } from "@/shared/types/database";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Checkbox } from "@/shared/ui/checkbox";
import { cn } from "@/shared/utils/class-names";

import type { AssetFilters, AssetGrouping } from "./ProjectOverviewAssetFilters";
import type { ProjectFileRoleValue } from "../constants";

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

type ProjectOverviewFilesSectionProps = {
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
  statusLabel: string;
  statusVariant: "default" | "secondary" | "destructive" | "outline";
  updatedLabel: string;
  statusValue: string;
  storedRelPath: string;
};

export function ProjectOverviewFilesSection({
  files,
  filters,
  grouping,
  roleOptions,
  isBusy = false,
  onOpenFile,
  onRegenerateFile,
  onRegenerateSelection,
  onRemoveFile,
  onChangeRole,
}: ProjectOverviewFilesSectionProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const rows = useMemo<FileRow[]>(() => {
    return files.map((bundle) => {
      const { statusLabel, statusVariant, rawStatus } = deriveStatus(bundle.artifacts ?? []);
      const roleValue = normalizeProjectFileRole(bundle.file.type);
      return {
        id: bundle.file.fileUuid,
        name: bundle.file.filename,
        roleValue,
        roleLabel: resolveRoleLabel(roleValue, roleOptions),
        sizeLabel: formatSize(bundle.info?.sizeBytes),
        languages: deriveLanguages(bundle.languagePairs ?? []),
        statusLabel,
        statusVariant,
        updatedLabel: formatUpdated(bundle.file.storedAt),
        statusValue: rawStatus,
        storedRelPath: bundle.file.storedAt,
      };
    });
  }, [files, roleOptions]);

  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }
      const validIds = new Set(rows.map((row) => row.id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        }
      });
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  useEffect(() => {
    if (grouping !== "flat") {
      setSelectedIds(new Set());
    }
  }, [grouping]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesSearch =
        filters.search.trim().length === 0 ||
        row.name.toLowerCase().includes(filters.search.trim().toLowerCase());

      const matchesRole = filters.role === "all" || row.roleValue === filters.role;

      const matchesStatus = filters.status === "all" || row.statusValue === filters.status;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [rows, filters]);

  const visibleSelectedCount = useMemo(() => {
    let count = 0;
    filteredRows.forEach((row) => {
      if (selectedIds.has(row.id)) {
        count += 1;
      }
    });
    return count;
  }, [filteredRows, selectedIds]);

  const isAllSelected = filteredRows.length > 0 && visibleSelectedCount === filteredRows.length;
  const isSomeSelected = visibleSelectedCount > 0 && visibleSelectedCount < filteredRows.length;

  const toggleRow = useCallback((rowId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(rowId);
      } else {
        next.delete(rowId);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
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
    [filteredRows],
  );

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleBulkRegenerate = useCallback(() => {
    if (!onRegenerateSelection || selectedIds.size === 0) {
      return;
    }
    const targetIds = Array.from(selectedIds);
    const outcome = onRegenerateSelection(targetIds);
    void Promise.resolve(outcome).finally(() => {
      setSelectedIds(new Set());
    });
  }, [onRegenerateSelection, selectedIds]);

  const selectedCount = selectedIds.size;
  const isBulkRegenerateDisabled =
    !onRegenerateSelection || selectedCount === 0 || isBusy;

  if (grouping === "role") {
    return (
      <GroupedFilesView
        rows={filteredRows}
        onOpenFile={onOpenFile}
        isBusy={isBusy}
        roleOptions={roleOptions}
      />
    );
  }

  return (
    <section className="project-overview__files">
      {selectedCount > 0 ? (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm text-foreground">
          <span>
            {selectedCount} file{selectedCount === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBulkRegenerate}
              disabled={isBulkRegenerateDisabled}
            >
              Regenerate selected
            </Button>
          </div>
        </div>
      ) : null}
      <div className="project-overview__table-wrapper">
        <PlainTable
          rows={filteredRows}
          sorting={sorting}
          onSortingChange={setSorting}
          roleOptions={roleOptions}
          onOpenFile={onOpenFile}
          onRegenerateFile={onRegenerateFile}
          selectedIds={selectedIds}
          isAllSelected={isAllSelected}
          isSomeSelected={isSomeSelected}
          onToggleAll={toggleAll}
          onToggleRow={toggleRow}
          onRemoveFile={onRemoveFile}
          isBusy={isBusy}
          onChangeRole={onChangeRole}
        />
      </div>
    </section>
  );
}

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
  onChangeRole,
}: {
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
  onChangeRole?: (fileUuid: string, nextRole: ProjectFileRoleValue, storedRelPath: string) => void;
}) {
  const columns = useMemo<ColumnDef<FileRow>[]>(
    () => [
      {
        id: "selection",
        header: () => (
          <Checkbox
            aria-label="Select all files"
            checked={isAllSelected ? true : isSomeSelected ? "indeterminate" : false}
            onCheckedChange={(value) => onToggleAll(value !== false)}
            disabled={isBusy || rows.length === 0}
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
              disabled={isBusy}
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
            className="project-overview__table-heading"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Name
            <ArrowUpDown className="h-4 w-4 opacity-60" aria-hidden />
          </button>
        ),
        cell: ({ row }) => {
          const original = row.original;
          const canOpen = Boolean(onOpenFile) && !isBusy;
          return (
            <div className="project-overview__file-cell">
              <button
                type="button"
                className={canOpen ? "project-overview__file-link" : "project-overview__file-link project-overview__file-link--disabled"}
                onClick={canOpen ? () => onOpenFile?.(original.id) : undefined}
                disabled={!canOpen}
              >
                {original.name}
              </button>
              <span className="text-xs text-muted-foreground">{original.sizeLabel}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "role",
        header: ({ column }) => (
          <button
            type="button"
            className="project-overview__table-heading"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Role
            <ArrowUpDown className="h-4 w-4 opacity-60" aria-hidden />
          </button>
        ),
        cell: ({ row }) => {
          const currentRole = row.original.roleValue;
          const available = roleOptions;
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
                className="w-[160px] justify-between"
                aria-label={`Change file role for ${row.original.name}`}
              >
                <SelectValue placeholder={row.original.roleLabel} />
              </SelectTrigger>
              <SelectContent>
                {available.map((option) => (
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
        header: () => <span className="project-overview__table-heading-static">Language pairs</span>,
        cell: ({ row }) => (
          <div className="project-overview__language-list">
            {row.original.languages.length > 0 ? (
              row.original.languages.map((lang) => (
                <Badge key={lang} variant="ghost" className="uppercase tracking-wide">
                  {lang}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "statusLabel",
        header: ({ column }) => (
          <button
            type="button"
            className="project-overview__table-heading"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Status
            <ArrowUpDown className="h-4 w-4 opacity-60" aria-hidden />
          </button>
        ),
        cell: ({ row }) => (
          <Badge variant={row.original.statusVariant}>{row.original.statusLabel}</Badge>
        ),
      },
      {
        accessorKey: "updatedLabel",
        header: ({ column }) => (
          <button
            type="button"
            className="project-overview__table-heading"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Updated
            <ArrowUpDown className="h-4 w-4 opacity-60" aria-hidden />
          </button>
        ),
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.updatedLabel}</span>,
      },
      {
        id: "actions",
        header: () => <span className="project-overview__table-heading-static">Actions</span>,
        cell: ({ row }) => (
          <div className="project-overview__file-actions" aria-label={`Actions for ${row.original.name}`}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenFile?.(row.original.id)}
                  disabled={!onOpenFile || isBusy}
                >
                  <PencilLine className="h-4 w-4" aria-hidden />
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
                  onClick={() => {
                    void onRegenerateFile?.(row.original.id);
                  }}
                  disabled={!onRegenerateFile || isBusy}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
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
                  onClick={() => onRemoveFile?.(row.original.id)}
                  disabled={!onRemoveFile || isBusy}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
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
      onChangeRole,
      onOpenFile,
      onRegenerateFile,
      onRemoveFile,
      onToggleAll,
      onToggleRow,
      roleOptions,
      rows,
      selectedIds,
    ],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      const nextState = typeof updater === "function" ? updater(sorting) : updater;
      onSortingChange(nextState);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>
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
          <TableRow>
            <TableCell colSpan={columns.length} className="project-overview__table-empty">
              No files match the current filters.
            </TableCell>
          </TableRow>
        ) : (
          table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className={cn(selectedIds.has(row.original.id) && "bg-muted/20")}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function GroupedFilesView({
  rows,
  onOpenFile,
  isBusy,
  roleOptions,
}: {
  rows: FileRow[];
  onOpenFile?: (fileUuid: string) => void;
  isBusy: boolean;
  roleOptions: ReadonlyArray<{ value: ProjectFileRoleValue; label: string }>;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, FileRow[]>();
    rows.forEach((row) => {
      const key = row.roleValue || "processable";
      const bucket = map.get(key) ?? [];
      bucket.push(row);
      map.set(key, bucket);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  return (
    <section className="project-overview__grouped">
      {grouped.map(([role, entries]) => (
        <div key={role} className="project-overview__group">
          <header className="project-overview__group-header">
            <h3>{resolveRoleLabel(role, roleOptions)}</h3>
            <Badge variant="outline">{entries.length}</Badge>
          </header>
          <ul className="project-overview__group-list">
            {entries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className={
                    onOpenFile && !isBusy
                      ? "project-overview__group-link"
                      : "project-overview__group-link project-overview__group-link--disabled"
                  }
                  onClick={onOpenFile && !isBusy ? () => onOpenFile(entry.id) : undefined}
                  disabled={!onOpenFile || isBusy}
                >
                  <span className="project-overview__group-name">{entry.name}</span>
                  <span className="project-overview__group-meta">{entry.updatedLabel}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {grouped.length === 0 ? (
        <div className="project-overview__table-empty">No files match the current filters.</div>
      ) : null}
    </section>
  );
}

function deriveStatus(artifacts: ArtifactRecord[]) {
  if (!artifacts || artifacts.length === 0) {
    return { statusLabel: "Pending", statusVariant: "outline" as const, rawStatus: "pending" };
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
    return { statusLabel: "Failed", statusVariant: "destructive" as const, rawStatus: "failed" };
  }
  if (status === "running") {
    return { statusLabel: "Running", statusVariant: "secondary" as const, rawStatus: "running" };
  }
  if (status === "completed" || status === "success") {
    return { statusLabel: "Ready", statusVariant: "default" as const, rawStatus: "completed" };
  }
  return { statusLabel: "Pending", statusVariant: "outline" as const, rawStatus: "pending" };
}

function deriveLanguages(pairs: ProjectLanguagePair[]) {
  if (!pairs || pairs.length === 0) {
    return [];
  }
  return pairs.map((pair) => `${pair.sourceLang} → ${pair.targetLang}`);
}

function formatRole(role: string | undefined) {
  if (!role) return "";
  const lower = role.toLowerCase();
  return lower.replace(/[_-]/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
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

function formatUpdated(iso: string) {
  if (!iso) return "—";
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return "—";
  }
  return DATE_FORMATTER.format(new Date(parsed));
}
