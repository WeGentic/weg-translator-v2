import type { CheckedState } from "@radix-ui/react-checkbox";
import { Trash2 } from "lucide-react";
import {
  createColumnHelper,
  type CellContext,
  type ColumnDef,
  type HeaderContext,
  type Row,
  type Table,
} from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { ProjectListItem } from "@/ipc";
import { cn } from "@/lib/utils";

import type { ProjectTableMeta } from "./types";

const columnHelper = createColumnHelper<ProjectListItem>();

export type ProjectColumnMeta = {
  headerClassName?: string;
  cellClassName?: string;
  headerAlign?: "left" | "center" | "right";
  cellAlign?: "left" | "center" | "right";
};

const STATUS_BADGE_THEME: Record<string, string> = {
  active: "border-[var(--color-tr-success)] bg-[var(--color-tr-success)]/15 text-[var(--color-tr-success)]",
  archived: "border-[var(--color-tr-muted-foreground)] bg-[var(--color-tr-muted)]/50 text-[var(--color-tr-muted-foreground)]",
  default: "border-[var(--color-tr-border)] bg-[var(--color-tr-muted)]/40 text-[var(--color-tr-muted-foreground)]",
};

const TYPE_BADGE_THEME: Record<string, string> = {
  translation: "border-[var(--color-tr-primary-blue)] bg-[var(--color-tr-primary-blue)]/15 text-[var(--color-tr-primary-blue)]",
  rag: "border-[var(--color-tr-accent)] bg-[var(--color-tr-accent)]/20 text-[var(--color-tr-accent-foreground)]",
  default: "border-[var(--color-tr-border)] bg-[var(--color-tr-muted)]/30 text-[var(--color-tr-muted-foreground)]",
};

function computeHeaderCheckedState(table: Table<ProjectListItem>): CheckedState {
  if (table.getIsAllRowsSelected()) {
    return true;
  }
  if (table.getIsSomeRowsSelected()) {
    return "indeterminate";
  }
  return false;
}

function SelectionHeader({ table }: { table: Table<ProjectListItem> }) {
  return (
    <div className="flex items-center justify-center">
      <Checkbox
        aria-label="Select all projects"
        checked={computeHeaderCheckedState(table)}
        onCheckedChange={(value) => {
          table.toggleAllRowsSelected(Boolean(value));
        }}
      />
    </div>
  );
}

function SelectionCell({
  project,
  row,
  isSelected,
  canSelect,
}: {
  project: ProjectListItem;
  row: Row<ProjectListItem>;
  isSelected: boolean;
  canSelect: boolean;
}) {
  return (
    <div className="flex items-center justify-center">
      <Checkbox
        aria-label={`Select ${project.name}`}
        checked={isSelected}
        disabled={!canSelect}
        onCheckedChange={(value) => {
          row.toggleSelected(Boolean(value));
        }}
      />
    </div>
  );
}

function NameHeader(_: HeaderContext<ProjectListItem, unknown>) {
  return (
    <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-tr-muted-foreground)]">Name</span>
  );
}

function NameCell({ table, row }: CellContext<ProjectListItem, unknown>) {
  const project = row.original;
  const handlers = table.options.meta?.projectManager ?? ({} as ProjectTableMeta);
  const slug = project.slug ?? project.projectId;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={handlers.onOpenProject ? () => handlers.onOpenProject?.(project) : undefined}
        className="line-clamp-1 text-left text-sm font-semibold text-[var(--color-tr-sidebar-foreground)] transition-colors hover:text-[var(--color-tr-primary-blue)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-tr-ring)] focus-visible:ring-offset-2"
      >
        {project.name}
      </button>
      <span className="text-xs text-[var(--color-tr-muted-foreground)]">{slug}</span>
    </div>
  );
}

function StatusHeader(_: HeaderContext<ProjectListItem, unknown>) {
  return (
    <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-tr-muted-foreground)]">
      Status
    </span>
  );
}

function StatusCell({ project }: { project: ProjectListItem }) {
  const statusLabel = formatBadgeLabel(project.status);
  const typeLabel = formatBadgeLabel(project.projectType);
  const statusClassName = STATUS_BADGE_THEME[normalizeBadgeKey(project.status)] ?? STATUS_BADGE_THEME.default;
  const typeClassName = TYPE_BADGE_THEME[normalizeBadgeKey(project.projectType)] ?? TYPE_BADGE_THEME.default;
  return (
    <div className="flex flex-wrap gap-2">
      <Badge
        variant="outline"
        className={cn(
          "border text-[0.7rem] uppercase tracking-wide shadow-sm",
          statusClassName,
        )}
      >
        {statusLabel}
      </Badge>
      <Badge
        variant="outline"
        className={cn(
          "border text-[0.65rem] uppercase tracking-wide",
          typeClassName,
        )}
      >
        {typeLabel}
      </Badge>
    </div>
  );
}

function FilesHeader(_: HeaderContext<ProjectListItem, unknown>) {
  return (
    <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-tr-muted-foreground)]">
      Files
    </span>
  );
}

function FilesCell({ project }: { project: ProjectListItem }) {
  const fileCount = Number.isFinite(project.fileCount) ? project.fileCount : 0;
  return <span className="text-sm text-[var(--color-tr-muted-foreground)]">{fileCount}</span>;
}

function ActionsHeader(_: HeaderContext<ProjectListItem, unknown>) {
  return <span className="sr-only">Actions</span>;
}

function ActionsCell({ table, project }: { table: Table<ProjectListItem>; project: ProjectListItem }) {
  const handlers = table.options.meta?.projectManager ?? ({} as ProjectTableMeta);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="text-[var(--color-tr-muted-foreground)] transition-colors hover:text-[var(--color-tr-destructive)]"
      onClick={handlers.onRequestDelete ? () => handlers.onRequestDelete?.(project) : undefined}
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">Delete {project.name}</span>
    </Button>
  );
}

export const projectsTableColumns: ColumnDef<ProjectListItem, unknown>[] = [
  columnHelper.display({
    id: "selection",
    enableHiding: false,
    enableSorting: false,
    header: ({ table }) => <SelectionHeader table={table} />,
    cell: ({ row }) => (
      <SelectionCell
        project={row.original}
        row={row}
        isSelected={row.getIsSelected()}
        canSelect={row.getCanSelect()}
      />
    ),
    meta: {
      headerClassName: cn("w-12", "text-center"),
      cellClassName: cn("w-12", "text-center"),
      headerAlign: "center",
      cellAlign: "center",
    } satisfies ProjectColumnMeta,
    size: 48,
    minSize: 48,
    maxSize: 48,
  }),
  columnHelper.accessor("name", {
    id: "name",
    enableSorting: false,
    header: (context) => <NameHeader {...context} />,
    cell: ({ table, row }) => <NameCell table={table} row={row} />,
    meta: {
      headerClassName: "text-left",
      cellClassName: "text-left",
      headerAlign: "left",
      cellAlign: "left",
    } satisfies ProjectColumnMeta,
  }),
  columnHelper.display({
    id: "status",
    enableSorting: false,
    header: (context) => <StatusHeader {...context} />,
    cell: ({ row }) => <StatusCell project={row.original} />,
    meta: {
      headerClassName: "text-left",
      cellClassName: "text-left",
      headerAlign: "left",
      cellAlign: "left",
    } satisfies ProjectColumnMeta,
  }),
  columnHelper.display({
    id: "files",
    enableSorting: false,
    header: (context) => <FilesHeader {...context} />,
    cell: ({ row }) => <FilesCell project={row.original} />,
    meta: {
      headerClassName: "text-right",
      cellClassName: "text-right",
      headerAlign: "right",
      cellAlign: "right",
    } satisfies ProjectColumnMeta,
  }),
  columnHelper.display({
    id: "actions",
    enableSorting: false,
    enableHiding: false,
    header: (context) => <ActionsHeader {...context} />,
    cell: ({ table, row }) => <ActionsCell table={table} project={row.original} />,
    meta: {
      headerClassName: "text-right",
      cellClassName: "text-right",
      headerAlign: "right",
      cellAlign: "right",
    } satisfies ProjectColumnMeta,
    size: 64,
  }),
];

function normalizeBadgeKey(value: string | undefined): string {
  if (!value) {
    return "default";
  }
  return value.toLowerCase();
}

function formatBadgeLabel(value: string | undefined): string {
  if (!value) {
    return "Unknown";
  }
  const normalized = value.replace(/[_-]+/g, " ").trim();
  if (!normalized) {
    return "Unknown";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
