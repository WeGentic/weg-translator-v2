/**
 * Supabase Health Check Types
 *
 * Type definitions for Supabase database health monitoring.
 * Used to validate connectivity and measure response latency.
 */

/**
 * Supabase health check status states
 *
 * @remarks
 * - `checking`: Health check is in progress
 * - `connected`: Successfully connected to Supabase database with valid response
 * - `disconnected`: Failed to connect, query timed out, or database is unreachable
 */
export type SupabaseHealthStatus = "checking" | "connected" | "disconnected";

/**
 * Result of a Supabase health check operation
 *
 * @remarks
 * Contains the health status, timestamp, latency metrics, and error information.
 * Latency is null when status is 'disconnected'.
 *
 * @example
 * ```typescript
 * // Successful health check
 * const result: SupabaseHealthResult = {
 *   status: 'connected',
 *   timestamp: '2025-10-30T12:00:00.000Z',
 *   latency: 45,
 *   error: null
 * };
 *
 * // Failed health check
 * const result: SupabaseHealthResult = {
 *   status: 'disconnected',
 *   timestamp: '2025-10-30T12:00:00.000Z',
 *   latency: null,
 *   error: 'Health check timeout after 3000ms'
 * };
 * ```
 */
export interface SupabaseHealthResult {
  /**
   * Current health status of the Supabase connection
   */
  status: SupabaseHealthStatus;

  /**
   * ISO 8601 timestamp when the health check was performed
   */
  timestamp: string;

  /**
   * Query latency in milliseconds
   *
   * @remarks
   * - Measures round-trip time from query start to completion
   * - null when status is 'disconnected' (no successful query)
   * - Should typically be < 500ms under normal conditions
   */
  latency: number | null;

  /**
   * Error message if health check failed
   *
   * @remarks
   * - null when status is 'connected'
   * - Contains descriptive error message for debugging when disconnected
   * - Examples: timeout errors, network errors, RLS policy errors
   */
  error: string | null;
}

/**
 * Configuration options for health check behavior
 *
 * @remarks
 * Allows customization of timeout duration and polling intervals
 * for different use cases (login page vs authenticated workspace).
 *
 * @example
 * ```typescript
 * // Custom timeout for slower networks
 * const options: SupabaseHealthCheckOptions = {
 *   timeoutMs: 5000
 * };
 *
 * // Polling configuration for workspace footer
 * const options: SupabaseHealthCheckOptions = {
 *   timeoutMs: 3000,
 *   pollingIntervalMs: 60000 // Check every 60 seconds
 * };
 * ```
 */
export interface SupabaseHealthCheckOptions {
  /**
   * Timeout duration in milliseconds
   *
   * @remarks
   * - Default: 3000ms (3 seconds)
   * - Health check will abort and return 'disconnected' if exceeded
   * - Should be long enough for typical queries but short enough to avoid blocking UI
   */
  timeoutMs?: number;

  /**
   * Polling interval in milliseconds for continuous monitoring
   *
   * @remarks
   * - Default: 60000ms (60 seconds)
   * - Used by useSupabaseHealth hook for periodic health checks
   * - Only relevant for authenticated users in workspace
   * - Set to 0 to disable polling
   */
  pollingIntervalMs?: number;
}
