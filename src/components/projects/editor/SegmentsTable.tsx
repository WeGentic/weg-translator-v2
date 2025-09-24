"use no memo";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rankItem } from "@tanstack/match-sorter-utils";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type ExpandedState,
  type Row,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { CheckedState } from "@radix-ui/react-checkbox";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PlaceholderParityStatus, SegmentRow } from "@/lib/jliff";
import { cn } from "@/lib/utils";

import { PlaceholderInspector } from "./PlaceholderInspector";
import { PlaceholderParityBadge } from "./PlaceholderParityBadge";
import { TargetEditor } from "./TargetEditor";
import { TokenLine } from "./TokenLine";

const ROW_HEIGHT_ESTIMATE = 64;
const DETAIL_ROW_HEIGHT_ESTIMATE = 360;
const OVERSCAN_COUNT = 12;

const fuzzyGlobalFilter: FilterFn<SegmentRow> = (row, _columnId, value) => {
  const search = String(value ?? "").trim();
  if (!search) {
    return true;
  }

  const haystacks = [row.original.sourceRaw, row.original.targetRaw, row.original.key].filter(
    (candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0,
  );
  return haystacks.some((candidate) => rankItem(candidate, search).passed);
};

type PlaceholderFilterValue = {
  mismatchesOnly?: boolean;
  hasPlaceholdersOnly?: boolean;
  status?: PlaceholderParityStatus;
};

const STATUS_FILTER_OPTIONS: Array<{ value: PlaceholderParityStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "ok", label: "OK" },
  { value: "missing", label: "Missing" },
  { value: "extra", label: "Extra" },
  { value: "unknown", label: "Unknown" },
];

const placeholderFilter: FilterFn<SegmentRow> = (row, _columnId, value) => {
  if (!value) {
    return true;
  }
  const filter = value as PlaceholderFilterValue;
  if (filter.mismatchesOnly && row.original.status === "ok") {
    return false;
  }
  if (filter.hasPlaceholdersOnly && row.original.placeholders.length === 0) {
    return false;
  }
  if (filter.status && row.original.status !== filter.status) {
    return false;
  }
  return true;
};

function normalizePlaceholderFilter(
  value?: PlaceholderFilterValue | null,
): PlaceholderFilterValue | undefined {
  if (!value) {
    return undefined;
  }
  const next: PlaceholderFilterValue = {};
  if (value.mismatchesOnly) {
    next.mismatchesOnly = true;
  }
  if (value.hasPlaceholdersOnly) {
    next.hasPlaceholdersOnly = true;
  }
  if (value.status) {
    next.status = value.status;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

type VirtualRowEntry = {
  key: string;
  row: Row<SegmentRow>;
  type: "data" | "detail";
};

function buildFlatRows(rows: Row<SegmentRow>[]): VirtualRowEntry[] {
  const entries: VirtualRowEntry[] = [];
  for (const row of rows) {
    entries.push({ key: row.id, row, type: "data" });
    if (row.getCanExpand() && row.getIsExpanded()) {
      entries.push({ key: `${row.id}-detail`, row, type: "detail" });
    }
  }
  return entries;
}

type TargetSavePayload = {
  rowKey: string;
  transunitId: string;
  newTarget: string;
  updatedAt: string;
};

type SegmentsTableProps = {
  rows: SegmentRow[];
  projectId: string;
  jliffRelPath: string;
  onTargetSave: (payload: TargetSavePayload) => Promise<void> | void;
  className?: string;
  isLoading?: boolean;
  activeFileId?: string;
};

export function SegmentsTable({
  rows,
  projectId,
  jliffRelPath,
  onTargetSave,
  className,
  isLoading = false,
  activeFileId,
}: SegmentsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const columns = useMemo<ColumnDef<SegmentRow>[]>(
    () => [
      {
        id: "segment",
        header: "Segment",
        accessorFn: (row) => row.key,
        enableSorting: true,
        meta: {
          label: "Segment",
        },
        cell: ({ row }) => {
          const value = row.original;
          const canExpand = row.getCanExpand();
          const isExpanded = row.getIsExpanded();
          const inspectorId = `placeholder-inspector-${row.id}`;
          const segmentLabelId = `segment-label-${row.id}`;

          return (
            <div className="flex flex-col gap-1">
              <span
                id={segmentLabelId}
                className="font-mono text-[11px] font-medium text-muted-foreground/80"
              >
                {value.key}
              </span>
              <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground/80">
                <span>Unit {value.unitId}</span>
                <span>Segment {value.segmentId || "—"}</span>
              </div>
              {canExpand ? (
                <button
                  type="button"
                  onClick={row.getToggleExpandedHandler()}
                  aria-expanded={isExpanded}
                  aria-controls={inspectorId}
                  className="inline-flex w-fit items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{isExpanded ? "Hide details" : "Inspect placeholders"}</span>
                </button>
              ) : (
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
                  No placeholder metadata
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "source",
        header: "Source",
        accessorFn: (row) => row.sourceRaw,
        enableSorting: false,
        meta: {
          label: "Source",
        },
        cell: ({ row }) => (
          <TokenLine tokens={row.original.sourceTokens} direction="source" className="max-w-2xl" />
        ),
      },
      {
        id: "target",
        header: "Target",
        accessorFn: (row) => row.targetRaw,
        enableSorting: false,
        meta: {
          label: "Target",
        },
        cell: ({ row }) => (
          <TokenLine tokens={row.original.targetTokens} direction="target" className="max-w-2xl" />
        ),
      },
      {
        id: "parity",
        header: "Placeholders",
        accessorFn: (row) => row.status,
        enableSorting: false,
        meta: {
          align: "center" as const,
          label: "Placeholders",
        },
        filterFn: "placeholder",
        cell: ({ row }) => {
          const hasIssues = Boolean(row.original.issues);
          return (
            <div className="flex items-center justify-center gap-2">
              <PlaceholderParityBadge counts={row.original.placeholderCounts} status={row.original.status} />
              {hasIssues ? (
                <span
                  className="inline-flex items-center text-amber-600"
                  title="Placeholder quality issues detected"
                  aria-label="Placeholder quality issues detected"
                >
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        meta: {
          align: "right" as const,
          label: "Actions",
        },
        cell: ({ row }) => {
          const canExpand = row.getCanExpand();
          const isExpanded = row.getIsExpanded();
          const toggle = row.getToggleExpandedHandler();
          const canEdit = Boolean(row.original.segmentId);

          return (
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={toggle}
                disabled={!canExpand}
              >
                {isExpanded ? "Close" : canEdit ? "Edit" : "Inspect"}
              </Button>
            </div>
          );
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      globalFilter,
      expanded,
      columnFilters,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onExpandedChange: setExpanded,
    onColumnFiltersChange: setColumnFilters,
    filterFns: {
      placeholder: placeholderFilter,
    },
    globalFilterFn: fuzzyGlobalFilter,
    getRowCanExpand: (row) => Boolean(row.original.segmentId),
    getExpandedRowModel: getExpandedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.key,
    enableExpanding: true,
  });

  const updatePlaceholderFilter = useCallback(
    (updater: (prev: PlaceholderFilterValue | undefined) => PlaceholderFilterValue | undefined) => {
      const column = table.getColumn("parity");
      if (!column) {
        return;
      }
      column.setFilterValue((previous) => {
        const prevValue = normalizePlaceholderFilter(previous as PlaceholderFilterValue | undefined);
        const nextValue = updater(prevValue);
        return normalizePlaceholderFilter(nextValue);
      });
    },
    [table],
  );

  const placeholderFilterValue = table.getColumn("parity")?.getFilterValue() as
    | PlaceholderFilterValue
    | undefined;
  const mismatchOnly = Boolean(placeholderFilterValue?.mismatchesOnly);
  const hasPlaceholdersOnly = Boolean(placeholderFilterValue?.hasPlaceholdersOnly);
  const statusFilter = placeholderFilterValue?.status ?? "all";

  const tableRows = table.getRowModel().rows;
  const flatRows = useMemo(() => buildFlatRows(tableRows), [tableRows]);
  const columnCount = table.getAllLeafColumns().length;

  const rowVirtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) =>
      flatRows[index]?.type === "detail" ? DETAIL_ROW_HEIGHT_ESTIMATE : ROW_HEIGHT_ESTIMATE,
    overscan: OVERSCAN_COUNT,
    getItemKey: (index) => flatRows[index]?.key ?? index,
  });

  const scrollToTop = useCallback(() => {
    const scrollElement = scrollContainerRef.current;
    if (scrollElement) {
      if (typeof scrollElement.scrollTo === "function") {
        scrollElement.scrollTo({ top: 0, behavior: "auto" });
      } else {
        scrollElement.scrollTop = 0;
      }
    }
    rowVirtualizer.scrollToOffset(0, { behavior: "auto" });
  }, [rowVirtualizer]);

  useEffect(() => {
    if (!activeFileId) {
      return;
    }
    scrollToTop();
  }, [activeFileId, scrollToTop]);

  const handleMismatchToggle = useCallback(
    (checked: CheckedState) => {
      updatePlaceholderFilter((prev) => ({
        ...(prev ?? {}),
        mismatchesOnly: checked === true ? true : undefined,
      }));
    },
    [updatePlaceholderFilter],
  );

  const handleHasPlaceholdersToggle = useCallback(
    (checked: CheckedState) => {
      updatePlaceholderFilter((prev) => ({
        ...(prev ?? {}),
        hasPlaceholdersOnly: checked === true ? true : undefined,
      }));
    },
    [updatePlaceholderFilter],
  );

  const handleStatusChange = useCallback(
    (nextValue: string) => {
      updatePlaceholderFilter((prev) => ({
        ...(prev ?? {}),
        status: nextValue === "all" ? undefined : (nextValue as PlaceholderParityStatus),
      }));
    },
    [updatePlaceholderFilter],
  );

  const virtualRows = rowVirtualizer.getVirtualItems();
  const hasVirtualRows = virtualRows.length > 0;
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = hasVirtualRows ? virtualRows[0].start : 0;
  const paddingBottom = hasVirtualRows ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

  const measureRow = useCallback(
    (node: HTMLTableRowElement | null) => {
      if (!node) {
        return;
      }
      rowVirtualizer.measureElement(node);
    },
    [rowVirtualizer],
  );

  const mismatchLabelId = "segments-filter-mismatches-label";
  const hasPlaceholdersLabelId = "segments-filter-placeholders-label";
  const statusLabelId = "segments-filter-status-label";
  const statusSelectId = "segments-filter-status";

  return (
    <section className={cn("flex h-full flex-col", className)} aria-label="Segments table" role="region">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <Input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder="Search segments"
            className="max-w-sm"
            aria-label="Search segments"
          />
          {isLoading ? (
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading rows…
            </span>
          ) : null}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Checkbox
              id="segments-filter-mismatches"
              checked={mismatchOnly}
              onCheckedChange={handleMismatchToggle}
              aria-labelledby={mismatchLabelId}
            />
            <Label
              id={mismatchLabelId}
              htmlFor="segments-filter-mismatches"
              className="cursor-pointer text-xs font-medium"
            >
              Only mismatches
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="segments-filter-placeholders"
              checked={hasPlaceholdersOnly}
              onCheckedChange={handleHasPlaceholdersToggle}
              aria-labelledby={hasPlaceholdersLabelId}
            />
            <Label
              id={hasPlaceholdersLabelId}
              htmlFor="segments-filter-placeholders"
              className="cursor-pointer text-xs font-medium"
            >
              Has placeholders
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Label
              id={statusLabelId}
              htmlFor={statusSelectId}
              className="text-xs font-medium"
            >
              Status
            </Label>
            <Select value={statusFilter} onValueChange={handleStatusChange} aria-labelledby={statusLabelId}>
              <SelectTrigger
                id={statusSelectId}
                className="h-8 w-[150px] rounded-md border-border/70 bg-background/80 text-xs"
              >
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-xs">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="relative mt-3 flex-1 overflow-auto rounded-xl border border-border/60 bg-background/95"
        style={{ minHeight: "24rem" }}
        data-testid="segments-table-scroll"
      >
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-10 bg-background/98 backdrop-blur">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-transparent">
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as { align?: string; label?: string } | undefined;
                  const canSort = header.column.getCanSort();
                  const sortDirection = header.column.getIsSorted();
                  const SortingIcon =
                    sortDirection === "asc" ? ArrowUp : sortDirection === "desc" ? ArrowDown : ArrowUpDown;
                  const headerLabel = meta?.label ?? header.column.columnDef.header ?? header.column.id;

                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        meta?.align === "center" && "text-center",
                        meta?.align === "right" && "text-right",
                      )}
                      aria-sort={
                        canSort
                          ? sortDirection === "asc"
                            ? "ascending"
                            : sortDirection === "desc"
                              ? "descending"
                              : "none"
                          : undefined
                      }
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          aria-label={`Sort by ${String(headerLabel)}`}
                        >
                          <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                          <SortingIcon className="h-3 w-3" aria-hidden="true" />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {tableRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-32 text-center text-sm text-muted-foreground">
                  {globalFilter ? "No segments match the current search." : "No segments available for this file."}
                </TableCell>
              </TableRow>
            ) : hasVirtualRows ? (
              <>
                {paddingTop > 0 ? (
                  <TableRow aria-hidden="true">
                    <TableCell colSpan={columnCount} style={{ height: `${paddingTop}px` }} className="p-0" />
                  </TableRow>
                ) : null}

                {virtualRows.map((virtualRow) => {
                  const item = flatRows[virtualRow.index];
                  if (!item) {
                    return null;
                  }

                  if (item.type === "detail") {
                    const inspectorId = `placeholder-inspector-${item.row.id}`;
                    const segmentLabelId = `segment-label-${item.row.id}`;

                    return (
                      <TableRow
                        key={item.key}
                        ref={measureRow}
                        data-index={virtualRow.index}
                        data-virtual-start={virtualRow.start}
                        data-virtual-end={virtualRow.end}
                        className="border-border/60 bg-muted/40"
                        data-expanded-detail
                      >
                        <TableCell colSpan={columnCount} className="p-0">
                          <div
                            id={inspectorId}
                            role="region"
                            aria-labelledby={segmentLabelId}
                            className="border-t border-border/60 p-4 space-y-6"
                          >
                            <TargetEditor
                              key={`target-editor-${item.row.id}`}
                              row={item.row.original}
                              projectId={projectId}
                              jliffRelPath={jliffRelPath}
                              onSaveSuccess={onTargetSave}
                            />
                            <PlaceholderInspector row={item.row.original} />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  return (
                    <TableRow
                      key={item.key}
                      ref={measureRow}
                      data-index={virtualRow.index}
                      data-virtual-start={virtualRow.start}
                      data-virtual-end={virtualRow.end}
                      className="border-border/60"
                    >
                      {item.row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            cell.column.columnDef.meta?.align === "center" && "text-center",
                            cell.column.columnDef.meta?.align === "right" && "text-right",
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}

                {paddingBottom > 0 ? (
                  <TableRow aria-hidden="true">
                    <TableCell colSpan={columnCount} style={{ height: `${paddingBottom}px` }} className="p-0" />
                  </TableRow>
                ) : null}
              </>
            ) : (
              tableRows.map((row) => {
                const inspectorId = `placeholder-inspector-${row.id}`;
                const segmentLabelId = `segment-label-${row.id}`;

                return (
                  <Fragment key={row.id}>
                    <TableRow className="border-border/60">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            cell.column.columnDef.meta?.align === "center" && "text-center",
                            cell.column.columnDef.meta?.align === "right" && "text-right",
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                    {row.getIsExpanded() ? (
                      <TableRow className="border-border/60 bg-muted/40" data-expanded-detail>
                        <TableCell colSpan={columnCount} className="p-0">
                          <div
                            id={inspectorId}
                            role="region"
                            aria-labelledby={segmentLabelId}
                            className="border-t border-border/60 p-4 space-y-6"
                          >
                            <TargetEditor
                              key={`target-editor-${row.id}`}
                              row={row.original}
                              projectId={projectId}
                              jliffRelPath={jliffRelPath}
                              onSaveSuccess={onTargetSave}
                            />
                            <PlaceholderInspector row={row.original} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </table>
      </div>
    </section>
  );
}

export default SegmentsTable;

export const __TEST_ONLY__ = {
  placeholderFilter,
  normalizePlaceholderFilter,
};
