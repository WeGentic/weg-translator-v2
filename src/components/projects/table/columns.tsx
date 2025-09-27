import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { ChevronDown, ChevronUp, Trash2, FolderOpen } from "lucide-react";

import { IconTooltipButton } from "@/components/IconTooltipButton";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge, TYPE_PRESENTATION, PROGRESS_PRESENTATION } from "./presentation";
import type { ProjectRow, ProjectType } from "./types";
import type { ProgressStatus } from "./presentation";

// Custom compact date formatter for MM/DD/YY HH:mm
function formatCompactDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(2);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}/${day}/${year} ${hours}:${minutes}`;
  } catch {
    return 'Invalid Date';
  }
}

// Column priority levels for responsive design
export const COLUMN_PRIORITIES = {
  ALWAYS: 1,    // Always visible (name, type, files, status, actions)
  HIDE_FIRST: 2, // Hide Updated column when width insufficient
} as const;

export type ResponsiveBreakpoint = {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWide: boolean;
  is2xl?: boolean;
};

const columnHelper = createColumnHelper<ProjectRow>();

type ProjectsColumnMeta = {
  priority: (typeof COLUMN_PRIORITIES)[keyof typeof COLUMN_PRIORITIES];
  headerClassName?: string;
  cellClassName?: string;
};

function SortIndicator({ state }: { state: false | "asc" | "desc" }) {
  if (state === "asc") return <ChevronUp className="ml-1 h-3.5 w-3.5 opacity-70" aria-hidden />;
  if (state === "desc") return <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" aria-hidden />;
  return null;
}

export function buildColumns(
  handlers: {
    onOpenProject?: (id: string) => void;
    onRequestDelete?: (id: string, name: string) => void;
    onRowSelectionChange?: (selectedRows: Set<string>) => void;
    selectedRows?: Set<string>;
    rawItems?: Array<{ createdAt: string; updatedAt: string; projectId: string }>;
  } = {},
  breakpoint: ResponsiveBreakpoint = { isMobile: false, isTablet: false, isDesktop: true, isWide: true },
): ColumnDef<ProjectRow, unknown>[] {
  const columns: ColumnDef<ProjectRow, unknown>[] = [
    // Checkbox Selection - Always visible
    columnHelper.display({
      id: "select",
      header: ({ table }) => {
        const isAllSelected = table.getIsAllRowsSelected();
        const isSomeSelected = table.getIsSomeRowsSelected();
        return (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={isAllSelected || (isSomeSelected ? "indeterminate" : false)}
              onCheckedChange={(checked) => {
                if (checked) {
                  const allIds = new Set(table.getRowModel().rows.map(row => row.original.id));
                  handlers.onRowSelectionChange?.(allIds);
                } else {
                  handlers.onRowSelectionChange?.(new Set());
                }
              }}
              aria-label="Select all projects"
            />
          </div>
        );
      },
      cell: ({ row }) => {
        const isSelected = handlers.selectedRows?.has(row.original.id) ?? false;
        return (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => {
                const currentSelection = new Set(handlers.selectedRows);
                if (checked) {
                  currentSelection.add(row.original.id);
                } else {
                  currentSelection.delete(row.original.id);
                }
                handlers.onRowSelectionChange?.(currentSelection);
              }}
              aria-label={`Select project ${row.original.name}`}
            />
          </div>
        );
      },
      meta: {
        priority: COLUMN_PRIORITIES.ALWAYS,
        headerClassName: "w-10 text-center relative vertical-separator-partial",
        cellClassName: "w-10 text-center relative vertical-separator-partial",
      } satisfies ProjectsColumnMeta,
    }),

    // Project Name - Always visible
    columnHelper.accessor("name", {
      id: "name",
      header: ({ column }) => {
        const sorted = column.getIsSorted();
        return (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className="group inline-flex select-none items-center gap-1 text-[12px] font-medium text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 hover:text-foreground/80"
            aria-sort={sorted === false ? "none" : sorted === "asc" ? "ascending" : "descending"}
          >
            Project Name
            <span className="transition-transform duration-200 group-hover:scale-110">
              <SortIndicator state={sorted} />
            </span>
          </button>
        );
      },
      cell: ({ getValue }) => {
        const value = getValue<string>();
        return (
          <div
            className="min-w-0 max-w-full truncate text-[12px] font-normal leading-5 text-foreground"
            title={value}
          >
            {value}
          </div>
        );
      },
      enableSorting: true,
      meta: {
        priority: COLUMN_PRIORITIES.ALWAYS,
        headerClassName: "w-[20%] lg:w-[25%] text-left normal-case relative vertical-separator-partial",
        cellClassName: "w-[20%] lg:w-[25%] text-left relative vertical-separator-partial",
      } satisfies ProjectsColumnMeta,
    }),

    // Project Type - Always visible
    columnHelper.accessor("projectType", {
      id: "projectType",
      header: ({ column }) => {
        const sorted = column.getIsSorted();
        return (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className="group inline-flex select-none items-center gap-1 text-[12px] font-medium text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 hover:text-foreground/80"
            aria-sort={sorted === false ? "none" : sorted === "asc" ? "ascending" : "descending"}
          >
            Type
            <span className="transition-transform duration-200 group-hover:scale-110">
              <SortIndicator state={sorted} />
            </span>
          </button>
        );
      },
      cell: ({ getValue }) => {
        const type = getValue<ProjectType>();
        const meta = TYPE_PRESENTATION[type];
        const Icon = meta.icon;
        return (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-normal text-foreground transition-colors duration-200 hover:text-foreground/80">
            <Icon className="h-4 w-4 text-muted-foreground/80 transition-colors duration-200" aria-hidden />
            <span className="whitespace-nowrap text-foreground">{meta.label}</span>
          </span>
        );
      },
      enableSorting: true,
      meta: {
        priority: COLUMN_PRIORITIES.ALWAYS,
        headerClassName: "w-[12%] text-left normal-case relative vertical-separator-partial",
        cellClassName: "w-[12%] text-left relative vertical-separator-partial",
      } satisfies ProjectsColumnMeta,
    }),

    // File Count - Always visible
    columnHelper.accessor("fileCount", {
      id: "fileCount",
      header: ({ column }) => {
        const sorted = column.getIsSorted();
        return (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className="group inline-flex w-full select-none items-center justify-center gap-1 text-[12px] font-medium text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 hover:text-foreground/80"
            aria-sort={sorted === false ? "none" : sorted === "asc" ? "ascending" : "descending"}
          >
            Files
            <span className="transition-transform duration-200 group-hover:scale-110">
              <SortIndicator state={sorted} />
            </span>
          </button>
        );
      },
      cell: ({ getValue }) => {
        const count = getValue<number>();
        return (
          <div className="flex justify-center">
            <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 tabular-nums text-[12px] font-medium text-foreground bg-muted/60 rounded-full border border-border/40 transition-all duration-200 hover:bg-muted/80 hover:scale-105">
              {count}
            </span>
          </div>
        );
      },
      enableSorting: true,
      meta: {
        priority: COLUMN_PRIORITIES.ALWAYS,
        headerClassName: "w-[8%] text-center normal-case relative vertical-separator-partial",
        cellClassName: "w-[8%] text-center relative vertical-separator-partial",
      } satisfies ProjectsColumnMeta,
    }),

    // Created Date - Always visible
    columnHelper.accessor((row) => row.created, {
      id: "created",
      header: ({ column }) => {
        const sorted = column.getIsSorted();
        return (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className="group inline-flex w-full select-none items-center justify-center gap-1 text-[11px] font-medium text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 hover:text-foreground/80"
            aria-sort={sorted === false ? "none" : sorted === "asc" ? "ascending" : "descending"}
          >
            Created
            <span className="transition-transform duration-200 group-hover:scale-110">
              <SortIndicator state={sorted} />
            </span>
          </button>
        );
      },
      cell: ({ row }) => {
        const rawItem = handlers.rawItems?.find(item => item.projectId === row.original.id);
        const createdAt = rawItem?.createdAt || '';
        const displayText = formatCompactDate(createdAt);
        const fullDate = createdAt ? new Date(createdAt).toLocaleString() : '';
        return (
          <div className="flex justify-center">
            <time className="text-[10px] font-normal text-foreground/80 transition-colors duration-200 hover:text-foreground" title={fullDate}>
              {displayText}
            </time>
          </div>
        );
      },
      sortingFn: (a, b) => {
        const va = (a.original as ProjectRow & { createdRaw: number }).createdRaw;
        const vb = (b.original as ProjectRow & { createdRaw: number }).createdRaw;
        if (typeof va === "number" && typeof vb === "number") return va - vb;
        const av = a.original.created.label;
        const bv = b.original.created.label;
        return av < bv ? -1 : 1;
      },
      enableSorting: true,
      meta: {
        priority: COLUMN_PRIORITIES.ALWAYS,
        headerClassName: "w-[12%] text-center normal-case relative vertical-separator-partial",
        cellClassName: "w-[12%] text-center relative vertical-separator-partial",
      } satisfies ProjectsColumnMeta,
    }),

    // Updated Date - Always visible
    columnHelper.accessor((row) => row.updated, {
      id: "updated",
      header: ({ column }) => {
        const sorted = column.getIsSorted();
        return (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className="group inline-flex w-full select-none items-center justify-center gap-1 text-[11px] font-medium text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 hover:text-foreground/80"
            aria-sort={sorted === false ? "none" : sorted === "asc" ? "ascending" : "descending"}
          >
            Updated
            <span className="transition-transform duration-200 group-hover:scale-110">
              <SortIndicator state={sorted} />
            </span>
          </button>
        );
      },
      cell: ({ row }) => {
        const rawItem = handlers.rawItems?.find(item => item.projectId === row.original.id);
        const updatedAt = rawItem?.updatedAt || '';
        const displayText = formatCompactDate(updatedAt);
        const fullDate = updatedAt ? new Date(updatedAt).toLocaleString() : '';
        return (
          <div className="flex justify-center">
            <time className="text-[10px] font-normal text-foreground/80 transition-colors duration-200 hover:text-foreground" title={fullDate}>
              {displayText}
            </time>
          </div>
        );
      },
      sortingFn: (a, b) => {
        const va = (a.original as ProjectRow & { updatedRaw: number }).updatedRaw;
        const vb = (b.original as ProjectRow & { updatedRaw: number }).updatedRaw;
        if (typeof va === "number" && typeof vb === "number") return va - vb;
        const av = a.original.updated.label;
        const bv = b.original.updated.label;
        return av < bv ? -1 : 1;
      },
      enableSorting: true,
      meta: {
        priority: COLUMN_PRIORITIES.HIDE_FIRST,
        headerClassName: "hidden lg:table-cell w-[12%] text-center normal-case relative vertical-separator-partial",
        cellClassName: "hidden lg:table-cell w-[12%] text-center relative vertical-separator-partial",
      } satisfies ProjectsColumnMeta,
    }),

    // Status - Always visible
    columnHelper.accessor("activityStatus", {
      id: "activityStatus",
      header: () => <span className="text-[12px] font-medium text-foreground">Status</span>,
      cell: ({ getValue }) => {
        const meta = PROGRESS_PRESENTATION[getValue<ProgressStatus>()];
        return (
          <div className="transition-transform duration-200 hover:scale-105">
            <StatusBadge {...meta} />
          </div>
        );
      },
      enableSorting: true,
      meta: {
        priority: COLUMN_PRIORITIES.ALWAYS,
        headerClassName: "w-[10%] text-center normal-case relative vertical-separator-partial",
        cellClassName: "w-[10%] text-center relative vertical-separator-partial",
      } satisfies ProjectsColumnMeta,
    }),

    // Actions - Always visible
    columnHelper.display({
      id: "actions",
      header: () => <span className="text-[12px] font-medium text-foreground">Actions</span>,
      cell: ({ row }) => {
        return (
          <div className="flex items-center justify-end gap-1.5">
            <div className="transition-transform duration-200 hover:scale-105">
              <IconTooltipButton
                label="Open project"
                ariaLabel={`Open project ${row.original.name}`}
                onClick={() => handlers.onOpenProject?.(row.original.id)}
              >
                <FolderOpen className="h-4 w-4" aria-hidden />
              </IconTooltipButton>
            </div>
            <div className="transition-transform duration-200 hover:scale-105">
              <IconTooltipButton
                tone="destructive"
                label="Delete project"
                ariaLabel={`Delete project ${row.original.name}`}
                onClick={() => handlers.onRequestDelete?.(row.original.id, row.original.name)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </IconTooltipButton>
            </div>
          </div>
        );
      },
      meta: {
        priority: COLUMN_PRIORITIES.ALWAYS,
        headerClassName: "w-[12%] text-right normal-case",
        cellClassName: "w-[12%] text-right",
      } satisfies ProjectsColumnMeta,
    }),
  ] as ColumnDef<ProjectRow, unknown>[];

  return columns;
}
