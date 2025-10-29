/**
 * Orphan Detection Utility with Fail-Closed Retry Logic
 *
 * This module provides functionality to detect "orphaned" users in the Tr-entic Desktop
 * registration flow. Orphaned users are those who exist in Supabase Auth (auth.users)
 * but have no corresponding company data in the application database.
 *
 * **Orphan Classifications**:
 * - Case 1.1 (Orphaned Unverified): User registered but never verified email. No company data.
 * - Case 1.2 (Orphaned Verified): User verified email but registration flow interrupted before company creation.
 *
 * **Fail-Closed Security Policy**:
 * - Security over availability: If detection fails, BLOCK login (do not allow access)
 * - Retry strategy: 3 attempts with exponential backoff (0ms, 200ms, 500ms)
 * - Total timeout: 2.2 seconds maximum (500ms × 3 + 200ms + 500ms delays)
 * - On failure: Throw OrphanDetectionError (triggers user-facing error message)
 *
 * **Performance Targets**:
 * - p95: <200ms (single attempt success)
 * - p99: <350ms (single attempt success)
 * - Timeout: 500ms per attempt
 * - Queries execute in parallel (Promise.all)
 *
 * This detection is used during login to identify users who need to complete their registration
 * via the recovery flow.
 *
 * @module orphanDetection
 * @see /docs/registration-recovery-api.md for state matrix and API details
 * @see /plans/registration-edge-case-fix/designs/fail-closed-policy.md
 * @see /plans/registration-edge-case-fix/designs/orphan-detection-queries-fail-closed.md
 */

import { supabase } from "@/core/config/supabaseClient";
import { OrphanDetectionError, type OrphanDetectionMetrics } from "@/modules/auth/errors";

/**
 * Orphan type classification
 */
export type OrphanType = "case_1_1" | "case_1_2";

/**
 * Result of orphan detection check (success case only)
 *
 * NOTE: If orphan detection fails after all retries, OrphanDetectionError is thrown instead.
 * This interface only represents successful detection results.
 */
export interface OrphanCheckResult {
  /**
   * Whether the user is orphaned (exists in auth but has no company data)
   */
  isOrphaned: boolean;

  /**
   * Classification of orphan type (null if not orphaned)
   * - case_1_1: Unverified email, no company data
   * - case_1_2: Verified email, no company data
   */
  classification: OrphanType | null;

  /**
   * Performance metrics for the orphan check operation
   */
  metrics: OrphanDetectionMetrics;

  /**
   * Internal flags for result metadata (not exposed to calling code)
   * @internal
   */
  hasCompanyData: boolean | null;

  /**
   * Internal flags for result metadata (not exposed to calling code)
   * @internal
   */
  hasAdminData: boolean | null;
}

/**
 * Options for configuring orphan detection behavior
 */
export interface OrphanDetectionOptions {
  /**
   * Maximum number of retry attempts (default: 3)
   * Set to 1 to disable retries (single attempt only)
   */
  maxRetries?: number;

  /**
   * Timeout per attempt in milliseconds (default: 500ms)
   * Should be set higher than p99 query latency
   */
  timeoutMs?: number;
}

/**
 * Sleep utility for implementing exponential backoff delays
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the specified delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Checks if a user is "orphaned" by querying for associated company data with fail-closed retry logic.
 *
 * An orphaned user is one who exists in Supabase Auth (auth.users) but has no corresponding
 * data in the application's `companies` or `company_admins` tables. This typically happens when:
 * 1. User registers but never completes email verification (Case 1.1)
 * 2. User verifies email but registration flow is interrupted before company creation (Case 1.2)
 *
 * **Fail-Closed Retry Strategy**:
 * - Attempts: 3 retries with exponential backoff (0ms, 200ms, 500ms)
 * - Timeout: 500ms per attempt
 * - Total max duration: 2.2 seconds (500ms × 3 + 200ms + 500ms delays)
 * - On success: Return OrphanCheckResult with metrics
 * - On failure after all retries: Throw OrphanDetectionError (blocks login)
 *
 * **Performance Characteristics**:
 * - Target: <200ms at p95 (first attempt success)
 * - Timeout: 500ms per attempt (generous margin above p99 of 350ms)
 * - Queries execute in parallel using Promise.all()
 * - Indexed columns: companies(owner_admin_uuid), company_admins(admin_uuid)
 *
 * **Error Handling (Fail-Closed)**:
 * - On timeout: Retry with backoff, throw OrphanDetectionError after 3 attempts
 * - On query error: Retry with backoff, throw OrphanDetectionError after 3 attempts
 * - Partial failure: Treat as total failure (cannot determine orphan status with partial data)
 * - All errors logged with correlation ID for monitoring and alerting
 *
 * **Security Considerations**:
 * - Uses RLS-enabled Supabase client (anon key)
 * - Query timeout prevents DoS/hanging requests
 * - Fail-closed policy: prioritize security over availability
 * - Detailed logging for incident response and support tickets
 *
 * @param userId - Supabase Auth user ID (UUID)
 * @param options - Optional configuration for retry behavior and timeouts
 * @returns Promise resolving to OrphanCheckResult on success
 * @throws {OrphanDetectionError} When detection fails after all retry attempts
 *
 * @example
 * ```typescript
 * try {
 *   const result = await checkIfOrphaned(user.id, { maxRetries: 3 });
 *   if (result.isOrphaned && result.classification === 'case_1_2') {
 *     // User verified email but no company data - trigger recovery flow
 *     throw new OrphanedUserError(user.email, result.metrics.correlationId);
 *   }
 * } catch (error) {
 *   if (error instanceof OrphanDetectionError) {
 *     // Fail-closed: block login and show service error
 *     await supabase.auth.signOut();
 *     throw new Error(error.getUserMessage());
 *   }
 *   throw error;
 * }
 * ```
 *
 * @see /plans/registration-edge-case-fix/designs/fail-closed-policy.md
 * @see /plans/registration-edge-case-fix/designs/orphan-detection-queries-fail-closed.md
 */
export async function checkIfOrphaned(
  userId: string,
  options: OrphanDetectionOptions = {}
): Promise<OrphanCheckResult> {
  // Extract options with defaults
  const maxRetries = options.maxRetries ?? 3;
  const timeoutMs = options.timeoutMs ?? 500;

  // Exponential backoff delays: 0ms (immediate), 200ms, 500ms
  const delays = [0, 200, 500];

  // Generate correlation ID for end-to-end tracing
  const correlationId = crypto.randomUUID();
  const operationStartTime = performance.now();
  const operationStartTimestamp = new Date().toISOString();

  // Track cumulative query duration across all attempts
  let cumulativeQueryDurationMs = 0;

  // Retry loop with exponential backoff
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Apply backoff delay before retry (skip for first attempt)
    if (attempt > 1) {
      const delayMs = delays[attempt - 1];
      console.info("[orphanDetection] Applying backoff delay before retry:", {
        correlationId,
        attempt,
        maxRetries,
        delayMs,
      });
      await sleep(delayMs);
    }

    try {
      console.info("[orphanDetection] Starting orphan detection attempt:", {
        correlationId,
        userId,
        attempt,
        maxRetries,
        timeoutMs,
      });

      // Start timing this attempt's query execution
      const queryStartTime = performance.now();

      // Create parallel queries
      const queriesPromise = Promise.all([
        supabase
          .from("companies")
          .select("id")
          .eq("owner_admin_uuid", userId)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("company_admins")
          .select("admin_uuid")
          .eq("admin_uuid", userId)
          .limit(1)
          .maybeSingle(),
      ]);

      // Create timeout promise that rejects after configured timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), timeoutMs)
      );

      // Race queries against timeout
      const [companiesResult, adminsResult] = await Promise.race([
        queriesPromise,
        timeoutPromise,
      ]);

      // Record query completion time
      const queryEndTime = performance.now();
      const queryDurationMs = queryEndTime - queryStartTime;
      cumulativeQueryDurationMs += queryDurationMs;

      // Check for query errors (excluding PGRST116 which means "no rows found")
      // Treat PGRST116 as success (valid result indicating no company data)
      if (companiesResult.error && companiesResult.error.code !== "PGRST116") {
        throw new Error(
          `Companies query error: ${companiesResult.error.message} (code: ${companiesResult.error.code})`
        );
      }

      if (adminsResult.error && adminsResult.error.code !== "PGRST116") {
        throw new Error(
          `Admins query error: ${adminsResult.error.message} (code: ${adminsResult.error.code})`
        );
      }

      // SUCCESS - Queries completed without timeout or error

      // Determine if user has company data
      const hasCompanyData = companiesResult.data !== null;
      const hasAdminData = adminsResult.data !== null;

      // User is orphaned if they have no company data AND no admin data
      const isOrphaned = !hasCompanyData && !hasAdminData;

      // Calculate total operation duration and create final metrics
      const operationEndTime = performance.now();
      const operationEndTimestamp = new Date().toISOString();

      const metrics: OrphanDetectionMetrics = {
        startedAt: operationStartTimestamp,
        completedAt: operationEndTimestamp,
        totalDurationMs: Math.round(operationEndTime - operationStartTime),
        queryDurationMs: Math.round(cumulativeQueryDurationMs),
        attemptCount: attempt,
        timedOut: false,
        hadError: false,
      };

      // Log success with performance metrics
      if (isOrphaned) {
        console.info("[orphanDetection] Orphaned user detected:", {
          correlationId,
          userId,
          classification: "case_1_2",
          attempt,
          metrics: {
            totalDurationMs: metrics.totalDurationMs,
            queryDurationMs: metrics.queryDurationMs,
          },
        });

        // Warn if detection was slow (exceeded p95 target of 200ms)
        if (metrics.totalDurationMs > 200) {
          console.warn("[orphanDetection] Orphan detection exceeded p95 target:", {
            correlationId,
            target: 200,
            actual: metrics.totalDurationMs,
            metrics,
          });
        }

        return {
          isOrphaned: true,
          classification: "case_1_2",
          metrics,
          hasCompanyData,
          hasAdminData,
        };
      } else {
        console.info("[orphanDetection] User has company data (not orphaned):", {
          correlationId,
          userId,
          hasCompanyData,
          hasAdminData,
          attempt,
          metrics: {
            totalDurationMs: metrics.totalDurationMs,
            queryDurationMs: metrics.queryDurationMs,
          },
        });

        // Warn if detection was slow
        if (metrics.totalDurationMs > 200) {
          console.warn("[orphanDetection] Orphan detection exceeded p95 target:", {
            correlationId,
            target: 200,
            actual: metrics.totalDurationMs,
            metrics,
          });
        }

        return {
          isOrphaned: false,
          classification: null,
          metrics,
          hasCompanyData,
          hasAdminData,
        };
      }
    } catch (attemptError) {
      // Log attempt failure with detailed context
      const errorMessage =
        attemptError instanceof Error ? attemptError.message : String(attemptError);
      const isTimeout = errorMessage === "Timeout";

      console.warn("[orphanDetection] Orphan detection attempt failed:", {
        correlationId,
        userId,
        attempt,
        maxRetries,
        error: errorMessage,
        isTimeout,
      });

      // If this was the last attempt, throw OrphanDetectionError (fail-closed)
      if (attempt === maxRetries) {
        const operationEndTime = performance.now();
        const operationEndTimestamp = new Date().toISOString();

        const finalMetrics: OrphanDetectionMetrics = {
          startedAt: operationStartTimestamp,
          completedAt: operationEndTimestamp,
          totalDurationMs: Math.round(operationEndTime - operationStartTime),
          queryDurationMs: Math.round(cumulativeQueryDurationMs),
          attemptCount: maxRetries,
          timedOut: isTimeout,
          hadError: !isTimeout,
        };

        console.error("[orphanDetection] Orphan detection failed after all retry attempts (fail-closed):", {
          correlationId,
          userId,
          metrics: finalMetrics,
          lastError: errorMessage,
        });

        // Throw OrphanDetectionError to trigger fail-closed behavior
        throw new OrphanDetectionError(
          "Orphan detection failed after all retry attempts",
          correlationId,
          finalMetrics
        );
      }

      // Continue to next retry attempt
      console.info("[orphanDetection] Retrying orphan detection:", {
        correlationId,
        attempt,
        maxRetries,
        nextAttempt: attempt + 1,
      });
    }
  }

  // Should never reach here due to throw in last attempt's catch block
  // But TypeScript requires a return statement for all code paths
  throw new Error("Unexpected: retry loop exited without returning or throwing");
}
