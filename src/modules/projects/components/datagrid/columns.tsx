"use no memo";

import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { ChevronDown, ChevronUp, Trash2, FolderOpen } from "lucide-react";

import { IconTooltipButton } from "@/shared/icons";
import { Checkbox } from "@/shared/ui/checkbox";
import type { ProjectRow } from "../../state/types";
import { StatusBadge, resolveProjectStatusPresentation } from "./presentation";

// Column priority levels for responsive design
export const COLUMN_PRIORITIES = {
  ALWAYS: 1,    // Always visible (name, type, files, status, actions)
  HIDE_FIRST: 2, // Hide Updated column when width insufficient
} as const;

export const DEFAULT_SORT_COLUMN_ID = "updated" as const;

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

function formatDateTimeParts(dateString: string | undefined) {
  if (!dateString) {
    return { dateLabel: "—", timeLabel: "—" };
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return { dateLabel: "—", timeLabel: "—" };
  }

  const dateLabel = date.toLocaleDateString(undefined, {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });

  const timeLabel = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return { dateLabel, timeLabel };
}

export function buildColumns(
  handlers: {
    onOpenProject?: (id: string) => void;
    onRequestDelete?: (id: string, name: string) => void;
    onRowSelectionChange?: (selectedRows: Set<string>) => void;
    selectedRows?: ReadonlySet<string>;
    rawItems?: Array<{ createdAt: string; updatedAt: string; projectId: string }>;
  } = {},
  breakpoint: ResponsiveBreakpoint = { isMobile: false, isTablet: false, isDesktop: true, isWide: true },
): ColumnDef<ProjectRow, unknown>[] {
  const columns: ColumnDef<ProjectRow, unknown>[] = [
    /**
     * Checkbox Selection Column
     *
     * Fixed-width column for row selection with the following features:
     * - Header: "Select All" checkbox with indeterminate state support
     * - Cell: Individual row checkbox
     * - Width: Fixed at 48px (w-12) for consistent alignment
     * - Styling: Centered content with vertical separator
     * - Theme: Uses --color-tr-ring for border (defined in checkbox component)
     *
     * Always visible regardless of breakpoint.
     */
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
                  // Select all visible rows
                  const allIds = new Set(table.getRowModel().rows.map(row => row.original.id));
                  handlers.onRowSelectionChange?.(allIds);
                } else {
                  // Clear all selections
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
        // Fixed width for checkbox column: 40px for compact layout
        // Centered alignment with vertical separator for visual clarity
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
      cell: ({ getValue, row }) => {
        const value = getValue<string>();
        const clientName = row.original.clientName ? row.original.clientName : null;
        const clientLabel = clientName && clientName.trim().length > 0 ? clientName : "N.A.";
        return (
          <div className="min-w-0 max-w-full">
            <div
              className="truncate text-[12px] font-semibold leading-5 text-foreground"
              title={value}
            >
              {value}
            </div>
            <div
              className="truncate text-[10px] font-normal text-muted-foreground"
              title={clientLabel}
            >
              Client: {clientLabel}
            </div>
          </div>
        );
      },
      enableSorting: true,
      meta: {
        priority: COLUMN_PRIORITIES.ALWAYS,
        // Name column stretches/expands to fill available space
        headerClassName: "text-left normal-case relative vertical-separator-partial",
        cellClassName: "text-left relative vertical-separator-partial",
      } satisfies ProjectsColumnMeta,
    }),

    // Primary Subject - Always visible
    columnHelper.accessor("primarySubject", {
      id: "subject",
      header: ({ column }) => {
        const sorted = column.getIsSorted();
        return (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className="group inline-flex select-none items-center gap-1 text-[12px] font-medium text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 hover:text-foreground/80"
            aria-sort={sorted === false ? "none" : sorted === "asc" ? "ascending" : "descending"}
          >
            Subject
            <span className="transition-transform duration-200 group-hover:scale-110">
              <SortIndicator state={sorted} />
            </span>
          </button>
        );
      },
      cell: ({ getValue }) => {
        const subject = getValue<string | null>();
        return (
          <div
            className="min-w-0 max-w-full truncate text-[12px] font-normal leading-5 text-foreground"
            title={subject ?? undefined}
          >
            {subject ?? "—"}
          </div>
        );
      },
      enableSorting: true,
      meta: {
        priority: COLUMN_PRIORITIES.ALWAYS,
        headerClassName: "text-left normal-case relative vertical-separator-partial",
        cellClassName: "text-left relative vertical-separator-partial",
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
        // Files column with fixed width
        headerClassName: "w-20 text-center normal-case relative vertical-separator-partial",
        cellClassName: "w-20 text-center relative vertical-separator-partial",
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
        const createdAt = rawItem?.createdAt ?? "";
        const { dateLabel, timeLabel } = formatDateTimeParts(createdAt);
        return (
          <div className="flex flex-col items-center text-center leading-tight">
            <span
              className="text-[10px] font-normal text-foreground/80 transition-colors duration-200 hover:text-foreground"
              title={createdAt}
            >
              {dateLabel}
            </span>
            <span className="text-[10px] font-normal text-muted-foreground/80">
              {timeLabel}
            </span>
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
        // Created column stretches/expands to fill available space
        headerClassName: "text-center normal-case relative vertical-separator-partial",
        cellClassName: "text-center relative vertical-separator-partial",
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
        const updatedAt = rawItem?.updatedAt ?? "";
        const { dateLabel, timeLabel } = formatDateTimeParts(updatedAt);
        return (
          <div className="flex flex-col items-center text-center leading-tight">
            <span
              className="text-[10px] font-normal text-foreground/80 transition-colors duration-200 hover:text-foreground"
              title={updatedAt}
            >
              {dateLabel}
            </span>
            <span className="text-[10px] font-normal text-muted-foreground/80">
              {timeLabel}
            </span>
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
        // Updated column stretches/expands to fill available space (hidden on smaller screens)
        headerClassName: "hidden lg:table-cell text-center normal-case relative vertical-separator-partial",
        cellClassName: "hidden lg:table-cell text-center relative vertical-separator-partial",
      } satisfies ProjectsColumnMeta,
    }),

    // Status - Always visible
    columnHelper.accessor("status", {
      id: "status",
      header: () => <span className="text-[12px] font-medium text-foreground">Status</span>,
      cell: ({ getValue }) => {
        const status = getValue<string | null>();
        const presentation = resolveProjectStatusPresentation(status);
        return (
          <div className="transition-transform duration-200 hover:scale-105">
            <StatusBadge {...presentation} />
          </div>
        );
      },
      enableSorting: true,
      meta: {
        priority: COLUMN_PRIORITIES.ALWAYS,
        // Status column with fixed width
        headerClassName: "w-28 text-center normal-case relative vertical-separator-partial",
        cellClassName: "w-28 text-center relative vertical-separator-partial",
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
        // Actions column with fixed width, pinned to the right
        headerClassName: "w-24 text-right normal-case sticky right-0 bg-inherit",
        cellClassName: "w-24 text-right sticky right-0 bg-inherit",
      } satisfies ProjectsColumnMeta,
    }),
  ] as ColumnDef<ProjectRow, unknown>[];

  const maxPriority =
    breakpoint.isMobile || (!breakpoint.isDesktop && !breakpoint.isWide)
      ? COLUMN_PRIORITIES.ALWAYS
      : COLUMN_PRIORITIES.HIDE_FIRST;

  return columns.filter((column) => {
    if (column.id === DEFAULT_SORT_COLUMN_ID) {
      return true;
    }
    const priority = (column.meta as ProjectsColumnMeta | undefined)?.priority ?? COLUMN_PRIORITIES.ALWAYS;
    if (priority === COLUMN_PRIORITIES.HIDE_FIRST && maxPriority === COLUMN_PRIORITIES.ALWAYS) {
      return false;
    }
    return true;
  });
}
