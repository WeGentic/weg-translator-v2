'use no memo';

import type { ColumnDef } from "@tanstack/react-table";

import type { ClientRecord } from "@/shared/types/database";

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

export function buildClientColumns(): ColumnDef<ClientRow>[] {
  return [
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
      header: () => <span className="text-xs font-semibold uppercase tracking-wide">Email</span>,
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
      header: () => <span className="text-xs font-semibold uppercase tracking-wide">Phone</span>,
      cell: ({ getValue }) => <FormatPlaceholder value={getValue<string | null>()} />,
      enableSorting: false,
      meta: {
        headerClassName: "min-w-[140px]",
        cellClassName: "min-w-[140px]",
      } satisfies ColumnMetaShape,
    },
    {
      accessorKey: "address",
      id: "address",
      header: () => <span className="text-xs font-semibold uppercase tracking-wide">Address</span>,
      cell: ({ getValue }) => {
        const value = getValue<string | null>();
        if (!value) {
          return <FormatPlaceholder value={null} />;
        }
        return (
          <span className="line-clamp-2 text-sm text-foreground/90" title={value}>
            {value}
          </span>
        );
      },
      enableSorting: false,
      meta: {
        headerClassName: "min-w-[220px]",
        cellClassName: "min-w-[220px]",
      } satisfies ColumnMetaShape,
    },
    {
      accessorKey: "vatNumber",
      id: "vatNumber",
      header: () => <span className="text-xs font-semibold uppercase tracking-wide">VAT #</span>,
      cell: ({ getValue }) => <FormatPlaceholder value={getValue<string | null>()} />,
      enableSorting: false,
      meta: {
        headerClassName: "min-w-[120px]",
        cellClassName: "min-w-[120px]",
      } satisfies ColumnMetaShape,
    },
    {
      accessorKey: "note",
      id: "note",
      header: () => <span className="text-xs font-semibold uppercase tracking-wide">Note</span>,
      cell: ({ getValue }) => {
        const value = getValue<string | null>();
        if (!value) {
          return <FormatPlaceholder value={null} />;
        }
        return (
          <span className="line-clamp-2 text-sm text-foreground/90" title={value}>
            {value}
          </span>
        );
      },
      enableSorting: false,
      meta: {
        headerClassName: "min-w-[200px]",
        cellClassName: "min-w-[200px]",
      } satisfies ColumnMetaShape,
    },
  ];
}
