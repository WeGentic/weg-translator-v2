import { useCallback, useMemo, useRef, useState } from "react";
import { rankItem } from "@tanstack/match-sorter-utils";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type FilterFn,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SegmentRow } from "@/lib/jliff";
import { cn } from "@/lib/utils";

import { PlaceholderParityBadge } from "./PlaceholderParityBadge";
import { TokenLine } from "./TokenLine";

const ROW_HEIGHT_ESTIMATE = 64;
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

type SegmentsTableProps = {
  rows: SegmentRow[];
  className?: string;
  isLoading?: boolean;
};

export function SegmentsTable({ rows, className, isLoading = false }: SegmentsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
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
          return (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[11px] font-medium text-muted-foreground/80">{value.key}</span>
              <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground/80">
                <span>Unit {value.unitId}</span>
                <span>Segment {value.segmentId || "—"}</span>
              </div>
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
        accessorFn: (row) => row.placeholderCounts.target,
        enableSorting: false,
        meta: {
          align: "center" as const,
          label: "Placeholders",
        },
        cell: ({ row }) => (
          <div className="flex justify-center">
            <PlaceholderParityBadge counts={row.original.placeholderCounts} status={row.original.status} />
          </div>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        meta: {
          align: "right" as const,
          label: "Actions",
        },
        cell: () => (
          <div className="flex justify-end">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Coming soon</span>
          </div>
        ),
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
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: fuzzyGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.key,
  });

  const tableRows = table.getRowModel().rows;
  const columnCount = table.getAllLeafColumns().length;

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    overscan: OVERSCAN_COUNT,
  });

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

  return (
    <section className={cn("flex h-full flex-col", className)} aria-label="Segments table" role="region">
      <div className="flex flex-wrap items-center gap-3">
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
                  const row = tableRows[virtualRow.index];
                  return (
                    <TableRow
                      key={row.id}
                      ref={measureRow}
                      data-index={virtualRow.index}
                      data-virtual-start={virtualRow.start}
                      data-virtual-end={virtualRow.end}
                      className="border-border/60"
                    >
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
                  );
                })}

                {paddingBottom > 0 ? (
                  <TableRow aria-hidden="true">
                    <TableCell colSpan={columnCount} style={{ height: `${paddingBottom}px` }} className="p-0" />
                  </TableRow>
                ) : null}
              </>
            ) : (
              tableRows.map((row) => (
                <TableRow key={row.id} className="border-border/60">
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
              ))
            )}
          </TableBody>
        </table>
      </div>
    </section>
  );
}

export default SegmentsTable;
