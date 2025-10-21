'use no memo';

import { useMemo, useState } from "react";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";

import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import type { ClientRecord } from "@/shared/types/database";

import { ClientsTable } from "./components/ClientsTable";
import { DEFAULT_SORT_COLUMN_ID, buildClientColumns, toClientRow, type ClientRow } from "./components/columns";

export interface ClientsContentProps {
  clients: ClientRecord[];
  search: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRequestOpen?: (client: ClientRow) => void;
  onRequestEdit?: (client: ClientRow) => void;
  onRequestDelete?: (client: ClientRow) => void;
}

const DEFAULT_SORTING: SortingState = [{ id: DEFAULT_SORT_COLUMN_ID, desc: false }];

export function ClientsContent({
  clients,
  search,
  isLoading = false,
  error = null,
  onRetry,
  onRequestOpen,
  onRequestEdit,
  onRequestDelete,
}: ClientsContentProps) {
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const clientRows = useMemo(() => clients.map(toClientRow), [clients]);

  const columns = useMemo(
    () =>
      buildClientColumns({
        onRequestOpen,
        onRequestEdit,
        onRequestDelete,
      }),
    [onRequestOpen, onRequestEdit, onRequestDelete],
  );
  const trimmedSearch = search.trim();

  const table = useReactTable({
    data: clientRows,
    columns,
    state: {
      sorting,
      rowSelection,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
  });

  const tableRows = table.getRowModel().rows;

  return (
    <section className="flex h-full w-full min-h-0 flex-1 flex-col" aria-label="Clients main content">
      {error ? (
        <div className="px-6 pb-4">
          <Alert variant="destructive">
            <AlertTitle>Unable to load clients</AlertTitle>
            <AlertDescription>
              {error}
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="ml-3 inline-flex items-center text-sm font-medium text-[var(--color-primary)] underline-offset-2 hover:underline"
                >
                  Try again
                </button>
              ) : null}
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <ClientsTable
          table={table}
          rows={tableRows}
          searchTerm={trimmedSearch}
          isLoading={isLoading}
        />
      </div>
    </section>
  );
}
