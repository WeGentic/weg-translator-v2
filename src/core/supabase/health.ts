/**
 * Supabase Health Check Service
 *
 * Provides database connectivity validation with timeout handling and latency tracking.
 * Uses a lightweight query against the health_check table to verify Supabase is accessible.
 */

import { supabase } from "@/core/config";
import type {
  SupabaseHealthResult,
  SupabaseHealthCheckOptions,
} from "./types";

/**
 * Default timeout for health check queries (3 seconds)
 */
const DEFAULT_TIMEOUT_MS = 3000;

/**
 * Checks Supabase database health and connectivity
 *
 * @remarks
 * Performs a lightweight SELECT query against the health_check table to validate:
 * - Database is accessible
 * - Network connectivity is working
 * - Query responses are timely
 *
 * The health_check table has RLS disabled to allow unauthenticated access,
 * making this suitable for use on the login page before authentication.
 *
 * Implementation details:
 * - Uses Promise.race to enforce timeout
 * - Tracks query latency using performance.now()
 * - Returns structured result with status, timestamp, latency, and error
 * - Handles network errors, timeouts, and Supabase errors gracefully
 *
 * @param options - Configuration options for timeout and polling behavior
 * @returns Promise resolving to health check result with status and metrics
 *
 * @example
 * ```typescript
 * // Basic health check with default 3-second timeout
 * const result = await checkSupabaseHealth();
 * if (result.status === 'connected') {
 *   console.log(`Connected in ${result.latency}ms`);
 * }
 *
 * // Custom timeout for slower networks
 * const result = await checkSupabaseHealth({ timeoutMs: 5000 });
 * ```
 */
export async function checkSupabaseHealth(
  options: SupabaseHealthCheckOptions = {}
): Promise<SupabaseHealthResult> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const startTime = performance.now();
  const timestamp = new Date().toISOString();

  // Check if supabase client exists
  if (!supabase) {
    return {
      status: "disconnected",
      timestamp,
      latency: null,
      error: "Supabase client not initialized",
    };
  }

  // Create timeout promise that rejects after specified duration
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Health check timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  // Create health check query promise
  // Query the health_check table which has a single row and RLS disabled
  const queryPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from("health_check")
        .select("id")
        .limit(1)
        .single();

      if (error) {
        throw new Error(
          `Supabase query error: ${error.message} (code: ${error.code || "unknown"})`
        );
      }

      return data;
    } catch (err) {
      // Catch any synchronous errors from the query
      throw err instanceof Error ? err : new Error(String(err));
    }
  })();

  try {
    // Race between query completion and timeout
    // If timeout wins, Promise.race rejects with timeout error
    // If query wins, we proceed to calculate latency
    await Promise.race([queryPromise, timeoutPromise]);

    // Query succeeded - calculate latency
    const endTime = performance.now();
    const latency = Math.round(endTime - startTime);

    return {
      status: "connected",
      timestamp,
      latency,
      error: null,
    };
  } catch (error) {
    // Handle timeout, network errors, or Supabase errors
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return {
      status: "disconnected",
      timestamp,
      latency: null,
      error: errorMessage,
    };
  }
}

/**
 * Checks if a health result indicates a healthy connection
 *
 * @remarks
 * Helper utility for determining if the database is accessible.
 * Useful for conditional logic based on health status.
 *
 * @param result - The health check result to evaluate
 * @returns true if status is 'connected', false otherwise
 *
 * @example
 * ```typescript
 * const result = await checkSupabaseHealth();
 * if (isHealthy(result)) {
 *   // Proceed with database operations
 * } else {
 *   // Show error message to user
 *   console.error(result.error);
 * }
 * ```
 */
export function isHealthy(result: SupabaseHealthResult): boolean {
  return result.status === "connected";
}

/**
 * Formats health result latency for display
 *
 * @remarks
 * Converts latency number to human-readable string with units.
 * Returns "—" for null latency (disconnected state).
 *
 * @param latency - Latency in milliseconds or null
 * @returns Formatted string like "45ms" or "—" if null
 *
 * @example
 * ```typescript
 * const result = await checkSupabaseHealth();
 * console.log(`Latency: ${formatLatency(result.latency)}`);
 * // Output: "Latency: 45ms" or "Latency: —"
 * ```
 */
export function formatLatency(latency: number | null): string {
  if (latency === null) {
    return "—";
  }
  return `${latency}ms`;
}
