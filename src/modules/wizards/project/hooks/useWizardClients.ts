import { useCallback, useEffect, useState } from "react";

import { listClientRecords } from "@/core/ipc";
import type { ClientRecord } from "@/shared/types/database";

interface UseWizardClientsResult {
  clients: ClientRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  upsert: (client: ClientRecord) => void;
}

export function useWizardClients(): UseWizardClientsResult {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInternal = useCallback(
    async (signal?: AbortSignal) => {
      await Promise.resolve();
      if (signal?.aborted) {
        return;
      }
      setLoading(true);
      setError(null);

      try {
        const records = await listClientRecords();
        if (signal?.aborted) {
          return;
        }
        setClients(records);
      } catch (cause: unknown) {
        if (signal?.aborted) {
          return;
        }
        const message = cause instanceof Error ? cause.message : "Unable to load clients.";
        setError(message);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [],
  );

  const refresh = useCallback(() => {
    void loadInternal();
  }, [loadInternal]);

  useEffect(() => {
    const controller = new AbortController();
    void loadInternal(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadInternal]);

  const upsert = useCallback((client: ClientRecord) => {
    setClients((current) => {
      const next = current.filter((entry) => entry.clientUuid !== client.clientUuid);
      next.push(client);
      next.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      return next;
    });
  }, []);

  return {
    clients,
    loading,
    error,
    refresh,
    upsert,
  };
}
