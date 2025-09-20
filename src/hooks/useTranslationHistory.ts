import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  clearTranslationHistory as clearHistoryCommand,
  listTranslationHistory,
  subscribeTranslationEvents,
  type TranslationHistoryQuery,
  type TranslationHistoryRecord,
} from "../ipc";
import { logger } from "../logging";

type FetchIntent = "initial" | "refresh";

export interface UseTranslationHistoryOptions {
  limit?: number;
  autoRefresh?: boolean;
}

export interface TranslationHistoryState {
  history: TranslationHistoryRecord[];
  isLoading: boolean;
  isRefreshing: boolean;
  isClearing: boolean;
  error: string | null;
  lastLoadedAt: number | null;
  refresh: () => Promise<void>;
  clearHistory: () => Promise<void>;
}

export function useTranslationHistory(
  options: UseTranslationHistoryOptions = {},
): TranslationHistoryState {
  const { limit = 50, autoRefresh = true } = options;
  const [history, setHistory] = useState<TranslationHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);

  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);
  const pendingRefreshRef = useRef(false);
  const queryRef = useRef<TranslationHistoryQuery>({ limit });

  queryRef.current.limit = limit;

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const runFetch = useCallback(
    async (intent: FetchIntent) => {
      if (isFetchingRef.current) {
        if (intent === "refresh") {
          pendingRefreshRef.current = true;
        }
        return;
      }

      isFetchingRef.current = true;
      if (intent === "initial") {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const records = await listTranslationHistory(queryRef.current);

        if (!isMountedRef.current) {
          return;
        }

        setHistory(records);
        setLastLoadedAt(Date.now());
        setError(null);
      } catch (caught) {
        if (!isMountedRef.current) {
          return;
        }

        const message =
          caught instanceof Error ? caught.message : "Failed to load translation history";
        setError(message);
        void logger.error("Failed to fetch translation history", caught, {
          scope: "useTranslationHistory",
        });
      } finally {
        const isMounted = isMountedRef.current;

        if (!isMounted) {
          isFetchingRef.current = false;
        } else {
          if (intent === "initial") {
            setIsLoading(false);
          } else {
            setIsRefreshing(false);
          }

          isFetchingRef.current = false;

          if (pendingRefreshRef.current) {
            pendingRefreshRef.current = false;
            void runFetch("refresh");
          }
        }
      }
    },
    [],
  );

  useEffect(() => {
    void runFetch("initial");
  }, [runFetch]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      try {
        unsubscribe = await subscribeTranslationEvents({
          onCompleted: () => {
            void runFetch("refresh");
          },
          onFailed: () => {
            void runFetch("refresh");
          },
        });
      } catch (caught) {
        if (cancelled || !isMountedRef.current) {
          return;
        }

        const message =
          caught instanceof Error
            ? caught.message
            : "Failed to subscribe to translation events";
        setError((previous) => previous ?? message);
        void logger.error("Failed to subscribe to translation events", caught, {
          scope: "useTranslationHistory",
        });
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [autoRefresh, runFetch]);

  const refresh = useCallback(async () => {
    await runFetch("refresh");
  }, [runFetch]);

  const clearHistory = useCallback(async () => {
    setIsClearing(true);
    try {
      await clearHistoryCommand();
      await runFetch("refresh");
    } catch (caught) {
      if (!isMountedRef.current) {
        return;
      }

      const message =
        caught instanceof Error ? caught.message : "Failed to clear translation history";
      setError(message);
      void logger.error("Failed to clear translation history", caught, {
        scope: "useTranslationHistory",
      });
      throw caught;
    } finally {
      if (isMountedRef.current) {
        setIsClearing(false);
      }
    }
  }, [runFetch]);

  return useMemo(
    () => ({
      history,
      isLoading,
      isRefreshing,
      isClearing,
      error,
      lastLoadedAt,
      refresh,
      clearHistory,
    }),
    [clearHistory, error, history, isClearing, isLoading, isRefreshing, lastLoadedAt, refresh],
  );
}
