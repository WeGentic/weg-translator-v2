"use no memo";

import type { ColumnDef } from "@tanstack/react-table";
import { FolderOpen, Pencil, Trash2 } from "lucide-react";

import type { ClientRecord } from "@/shared/types/database";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

import "./clients-table.css";

export interface ClientRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  vatNumber: string | null;
  note: string | null;
  hasPrimaryContact: boolean;
}

export const DEFAULT_SORT_COLUMN_ID = "name" as const;

type ColumnMetaShape = {
  headerClassName?: string;
  cellClassName?: string;
};

function FormatPlaceholder({ value }: { value: string | null }) {
  if (!value) {
    return <span className="text-muted-foreground/70">—</span>;
  }
  return <span title={value}>{value}</span>;
}

function SortIndicator({ state }: { state: false | "asc" | "desc" }) {
  if (state === "asc") {
    return <span aria-hidden className="ml-1 inline-block text-[10px] text-muted-foreground">▲</span>;
  }
  if (state === "desc") {
    return <span aria-hidden className="ml-1 inline-block text-[10px] text-muted-foreground">▼</span>;
  }
  return null;
}

export function toClientRow(record: ClientRecord): ClientRow {
  const clean = (value?: string | null) => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
  };

  const email = clean(record.email);
  const phone = clean(record.phone);

  return {
    id: record.clientUuid,
    name: record.name,
    email,
    phone,
    address: clean(record.address),
    vatNumber: clean(record.vatNumber),
    note: clean(record.note),
    hasPrimaryContact: Boolean(email || phone),
  };
}

export interface ClientColumnOptions {
  onRequestOpen?: (client: ClientRow) => void;
  onRequestEdit?: (client: ClientRow) => void;
  onRequestDelete?: (client: ClientRow) => void;
  selection?: {
    isAllSelected: boolean;
    isSomeSelected: boolean;
    isRowSelected: (clientId: string) => boolean;
    onToggleAll: (checked: boolean) => void;
    onToggleRow: (clientId: string, checked: boolean) => void;
  };
}

export function buildClientColumns(options: ClientColumnOptions = {}): ColumnDef<ClientRow>[] {
  const selection = options.selection;
  return [
    {
      id: "select",
      header: () => {
        const checkedState = selection
          ? selection.isAllSelected
            ? true
            : selection.isSomeSelected
              ? "indeterminate"
              : false
          : false;

        return (
          <Checkbox
            aria-label="Select all clients"
            checked={checkedState}
            onCheckedChange={(value) => {
              selection?.onToggleAll(value !== false);
            }}
            className="clients-table-checkbox"
          />
        );
      },
      cell: ({ row }) => {
        const clientId = row.original.id;
        const isSelected = selection?.isRowSelected(clientId) ?? false;
        const checkedState = isSelected ? true : false;
        const trimmedName = row.original.name.trim();
        const nameLabel = trimmedName.length > 0 ? trimmedName : "client";

        return (
          <Checkbox
            aria-label={`Select ${nameLabel}`}
            checked={checkedState}
            onCheckedChange={(value) => {
              selection?.onToggleRow(clientId, value === true);
            }}
            className="clients-table-checkbox"
          />
        );
      },
      enableSorting: false,
      enableHiding: false,
      meta: {
        headerClassName: "w-12 px-3 text-center",
        cellClassName: "w-12 px-3 text-center",
      } satisfies ColumnMetaShape,
    },
    {
      accessorKey: "name",
      id: "name",
      header: ({ column }) => {
        const sorted = column.getIsSorted();
        return (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className="group inline-flex items-center gap-1 text-xs font-semibold text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-sort={sorted === false ? "none" : sorted === "asc" ? "ascending" : "descending"}
          >
            Client
            <SortIndicator state={sorted} />
          </button>
        );
      },
      cell: ({ getValue }) => {
        const value = getValue<string>();
        return (
          <span className="font-medium text-foreground" title={value}>
            {value}
          </span>
        );
      },
      enableSorting: true,
      meta: {
        headerClassName: "min-w-[160px]",
        cellClassName: "min-w-[160px]",
      } satisfies ColumnMetaShape,
    },
    {
      accessorKey: "email",
      id: "email",
      header: () => <span className="text-xs font-semibold text-foreground">Email</span>,
      cell: ({ getValue }) => <FormatPlaceholder value={getValue<string | null>()} />,
      enableSorting: false,
      meta: {
        headerClassName: "min-w-[180px]",
        cellClassName: "min-w-[180px]",
      } satisfies ColumnMetaShape,
    },
    {
      accessorKey: "phone",
      id: "phone",
      header: () => <span className="text-xs font-semibold text-foreground">Phone</span>,
      cell: ({ getValue }) => <FormatPlaceholder value={getValue<string | null>()} />,
      enableSorting: false,
      meta: {
        headerClassName: "min-w-[140px]",
        cellClassName: "min-w-[140px]",
      } satisfies ColumnMetaShape,
    },
    {
      id: "actions",
      header: () => <span className="text-xs font-semibold text-foreground">Actions</span>,
      cell: ({ row }) => (
        <ClientActionsCell
          client={row.original}
          onRequestOpen={options.onRequestOpen}
          onRequestEdit={options.onRequestEdit}
          onRequestDelete={options.onRequestDelete}
        />
      ),
      enableSorting: false,
      meta: {
        headerClassName: "min-w-[160px] text-center",
        cellClassName: "min-w-[160px] text-right",
      } satisfies ColumnMetaShape,
    },
  ];
}

function ClientActionsCell({
  client,
  onRequestOpen,
  onRequestEdit,
  onRequestDelete,
}: {
  client: ClientRow;
  onRequestOpen?: (client: ClientRow) => void;
  onRequestEdit?: (client: ClientRow) => void;
  onRequestDelete?: (client: ClientRow) => void;
}) {
  const trimmedName = client.name.trim();
  const nameLabel = trimmedName.length > 0 ? trimmedName : "client";

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Open ${nameLabel}`}
            onClick={() => {
              onRequestOpen?.(client);
            }}
          >
            <FolderOpen className="size-4" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end">
          Open client
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Edit ${nameLabel}`}
            onClick={() => {
              onRequestEdit?.(client);
            }}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="center">
          Edit client
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Delete ${nameLabel}`}
            onClick={() => {
              onRequestDelete?.(client);
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start">
          Delete client
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
