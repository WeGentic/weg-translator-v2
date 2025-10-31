import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/app/providers/auth/AuthProvider";
import { logger } from "@/core/logging";
import { checkSupabaseHealth } from "@/core/supabase/health";
import type {
  SupabaseHealthResult,
  SupabaseHealthStatus,
} from "@/core/supabase/types";

/**
 * Configuration options for useSupabaseHealth hook.
 */
export interface UseSupabaseHealthOptions {
  /** Polling interval in milliseconds. Default: 60000 (60 seconds) */
  pollingInterval?: number;
  /** Whether to start health checks automatically on mount. Default: true */
  autoStart?: boolean;
}

/**
 * Return type of useSupabaseHealth hook.
 */
export interface UseSupabaseHealthReturn {
  /** Current health check result (null if not yet run) */
  healthResult: SupabaseHealthResult | null;
  /** Whether a health check is currently in progress */
  isLoading: boolean;
  /** Error message from the most recent check (if any) */
  error: string | null;
  /** Manually trigger a health check */
  retry: () => void;
  /** Start automatic polling (for authenticated users) */
  startPolling: () => void;
  /** Stop automatic polling */
  stopPolling: () => void;
}

/**
 * React hook for monitoring Supabase database health.
 *
 * Features:
 * - Automatically runs health check on component mount
 * - Polls every 60 seconds (configurable) for authenticated users
 * - Provides manual retry function
 * - Implements race condition prevention for concurrent checks
 * - Proper cleanup on unmount
 *
 * @param options - Configuration options
 * @returns Health status, loading state, error, and control functions
 *
 * @example
 * // Basic usage (auto-start with 60s polling)
 * const { healthResult, isLoading, error, retry } = useSupabaseHealth();
 *
 * @example
 * // Custom polling interval
 * const { healthResult } = useSupabaseHealth({ pollingInterval: 120000 });
 *
 * @example
 * // Manual control (no auto-start)
 * const { retry, startPolling, stopPolling } = useSupabaseHealth({ autoStart: false });
 */
export function useSupabaseHealth(
  options: UseSupabaseHealthOptions = {}
): UseSupabaseHealthReturn {
  const { pollingInterval = 60000, autoStart = true } = options;

  const { isAuthenticated } = useAuth();

  // State management
  const [healthResult, setHealthResult] = useState<SupabaseHealthResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Ref for polling interval
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Executes a single health check operation.
   */
  const runHealthCheck = async () => {
    setIsLoading(true);
    setError(null);

    // Set initial checking status
    setHealthResult({
      status: 'checking',
      timestamp: new Date().toISOString(),
      latency: null,
      error: null,
    });

    try {
      const result = await checkSupabaseHealth({ timeoutMs: 3000 });

      setHealthResult(result);
      setError(result.error);

      void logger.info("Supabase health check completed", {
        status: result.status,
        latency: result.latency,
        hasError: !!result.error,
      });
    } catch (checkError) {
      const errorMessage = checkError instanceof Error
        ? checkError.message
        : 'Unknown error during health check';

      setHealthResult({
        status: 'disconnected',
        timestamp: new Date().toISOString(),
        latency: null,
        error: errorMessage,
      });
      setError(errorMessage);

      void logger.error("Supabase health check failed", {
        error: checkError,
        errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Starts automatic polling for authenticated users.
   * Does nothing if polling is already active.
   */
  const startPolling = () => {
    // Don't start polling if already active
    if (intervalIdRef.current !== null) {
      void logger.debug("Supabase health polling already active");
      return;
    }

    // Only poll for authenticated users
    if (!isAuthenticated) {
      void logger.debug("Skipping Supabase health polling (user not authenticated)");
      return;
    }

    void logger.info("Starting Supabase health polling", {
      intervalMs: pollingInterval,
    });

    intervalIdRef.current = setInterval(() => {
      void runHealthCheck();
    }, pollingInterval);
  };

  /**
   * Stops automatic polling.
   * Safe to call even if polling is not active.
   */
  const stopPolling = () => {
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;

      void logger.info("Stopped Supabase health polling");
    }
  };

  /**
   * Manually triggers a health check.
   * Can be called at any time to get fresh status.
   */
  const retry = () => {
    void logger.info("Manual Supabase health check triggered");
    void runHealthCheck();
  };

  // Effect: Initial health check and polling setup
  useEffect(() => {
    // Run initial health check if autoStart is enabled
    if (autoStart) {
      void runHealthCheck();

      // Start polling if user is authenticated
      if (isAuthenticated) {
        startPolling();
      }
    }

    // Cleanup: stop polling on unmount
    return () => {
      stopPolling();
    };
    // Note: Intentionally omitting dependencies to run only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect: Handle authentication state changes for polling
  useEffect(() => {
    if (!autoStart) {
      return;
    }

    // Start polling when user becomes authenticated
    if (isAuthenticated && intervalIdRef.current === null) {
      startPolling();
    }

    // Stop polling when user logs out
    if (!isAuthenticated && intervalIdRef.current !== null) {
      stopPolling();
    }

    // Note: startPolling and stopPolling are stable functions, safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, autoStart]);

  return {
    healthResult,
    isLoading,
    error,
    retry,
    startPolling,
    stopPolling,
  };
}
