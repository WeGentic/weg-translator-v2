import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { listClientRecords } from "@/core/ipc/db/clients";
import type { ClientRecord } from "@/shared/types/database";

import type { ClientsFilterValue } from "@/modules/clients/constants";

export interface UseClientsDataOptions {
  search: string;
  filter: ClientsFilterValue;
}

export interface UseClientsDataResult {
  clients: ClientRecord[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  upsertClient: (record: ClientRecord) => void;
  removeClient: (clientUuid: string) => void;
}

function normalizeOptionalField(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function useClientsData({ search, filter }: UseClientsDataOptions): UseClientsDataResult {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadClients = useCallback(
    async (signal?: AbortSignal) => {
      if (signal?.aborted) return;
      setLoading(true);
      setError(null);

      try {
        const records = await listClientRecords();
        if (signal?.aborted) return;
        setClients(
          records.map((record) => ({
            ...record,
            email: normalizeOptionalField(record.email),
            phone: normalizeOptionalField(record.phone),
            address: normalizeOptionalField(record.address),
            vatNumber: normalizeOptionalField(record.vatNumber),
            note: normalizeOptionalField(record.note),
          })),
        );
      } catch (cause: unknown) {
        if (signal?.aborted) return;
        const message = cause instanceof Error && cause.message
          ? cause.message
          : "Unable to load clients.";
        setError(message);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [],
  );

  const refresh = useCallback(async (): Promise<void> => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    await loadClients(controller.signal);
  }, [loadClients]);

  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    void loadClients(controller.signal);
    return () => {
      controller.abort();
      abortControllerRef.current = null;
    };
  }, [loadClients]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredClients = useMemo(() => {
    const byFilter = clients.filter((client) => {
      if (filter === "with-contact") {
        return Boolean(client.email || client.phone);
      }
      if (filter === "missing-contact") {
        return !client.email && !client.phone;
      }
      return true;
    });

    if (normalizedSearch.length === 0) {
      return byFilter;
    }

    return byFilter.filter((client) => {
      const haystacks = [
        client.name,
        client.email,
        client.phone,
        client.address,
        client.vatNumber,
        client.note,
      ];
      return haystacks
        .filter((value): value is string => Boolean(value && value.trim().length > 0))
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [clients, filter, normalizedSearch]);

  const upsertClient = useCallback((record: ClientRecord) => {
    setClients((current) => {
      const next = current.filter((item) => item.clientUuid !== record.clientUuid);
      next.push({
        ...record,
        email: normalizeOptionalField(record.email),
        phone: normalizeOptionalField(record.phone),
        address: normalizeOptionalField(record.address),
        vatNumber: normalizeOptionalField(record.vatNumber),
        note: normalizeOptionalField(record.note),
      });
      next.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      return next;
    });
  }, []);

  const removeClient = useCallback((clientUuid: string) => {
    setClients((current) => current.filter((client) => client.clientUuid !== clientUuid));
  }, []);

  return {
    clients: filteredClients,
    totalCount: clients.length,
    isLoading,
    error,
    refresh,
    upsertClient,
    removeClient,
  };
}
