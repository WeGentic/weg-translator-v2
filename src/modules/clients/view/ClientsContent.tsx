'use no memo';

import { useCallback, useMemo, useState } from "react";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
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
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(() => new Set());

  const clientRows = useMemo(() => clients.map(toClientRow), [clients]);
  const totalClients = clientRows.length;

  const isClientSelected = useCallback(
    (clientId: string) => selectedClientIds.has(clientId),
    [selectedClientIds],
  );

  const selectedCount = useMemo(() => {
    if (selectedClientIds.size === 0 || totalClients === 0) {
      return 0;
    }
    let count = 0;
    for (const row of clientRows) {
      if (selectedClientIds.has(row.id)) {
        count += 1;
      }
    }
    return count;
  }, [clientRows, selectedClientIds, totalClients]);

  const isAllSelected = totalClients > 0 && selectedCount === totalClients;
  const isSomeSelected = selectedCount > 0 && !isAllSelected;

  const handleToggleRowSelection = useCallback((clientId: string, checked: boolean) => {
    setSelectedClientIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(clientId);
      } else {
        next.delete(clientId);
      }
      return next;
    });
  }, []);

  const handleToggleAllSelection = useCallback(
    (checked: boolean) => {
      setSelectedClientIds(() => {
        if (!checked) {
          return new Set();
        }
        const next = new Set<string>();
        for (const row of clientRows) {
          next.add(row.id);
        }
        return next;
      });
    },
    [clientRows],
  );

  const columns = useMemo(
    () =>
      buildClientColumns({
        onRequestOpen,
        onRequestEdit,
        onRequestDelete,
        selection: {
          isAllSelected,
          isSomeSelected,
          isRowSelected: isClientSelected,
          onToggleAll: handleToggleAllSelection,
          onToggleRow: handleToggleRowSelection,
        },
      }),
    [
      onRequestOpen,
      onRequestEdit,
      onRequestDelete,
      isAllSelected,
      isSomeSelected,
      isClientSelected,
      handleToggleAllSelection,
      handleToggleRowSelection,
    ],
  );
  const trimmedSearch = search.trim();

  const table = useReactTable({
    data: clientRows,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
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
                  className="ml-3 inline-flex items-center text-sm font-medium text-(--color-primary) underline-offset-2 hover:underline"
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
          selectedRowIds={selectedClientIds}
        />
      </div>
    </section>
  );
}
