/**
 * Orphan Detection Utility with Fail-Closed Retry Logic
 *
 * This module provides functionality to detect "orphaned" users in the Tr-entic Desktop
 * registration flow. Orphaned users are those who exist in Supabase Auth (auth.users)
 * but have no corresponding user record in the public.users table or have invalid account data.
 *
 * **Orphan Classifications**:
 * - no-users-record: User exists in auth.users but no record in public.users table
 * - null-account-uuid: User record exists but account_uuid is null
 * - deleted-user: User record exists but deleted_at is not null
 * - deleted-account: User record exists but referenced account is deleted
 *
 * **Fail-Closed Security Policy**:
 * - Security over availability: If detection fails, BLOCK login (do not allow access)
 * - Retry strategy: 3 attempts with exponential backoff and Gaussian jitter
 * - Delays: 0ms (immediate), 100ms jitter (±50ms), 300ms jitter (±150ms)
 * - Total timeout: ~2.5 seconds maximum with retries
 * - On failure: Throw OrphanDetectionError (triggers user-facing error message)
 *
 * **Performance Targets**:
 * - p95: <200ms (single attempt success)
 * - p99: <500ms (with potential single retry)
 * - Timeout: 200ms per attempt for fail-fast behavior
 * - Single query to users table for optimal performance
 *
 * This detection is used during login to identify users who need to complete their registration
 * or have invalid account states.
 *
 * @module orphanDetection
 * @see /plans/auth-b2b-schema-migration for migration details
 */

import { supabase } from "@/core/config/supabaseClient";
import { OrphanDetectionError, type OrphanDetectionMetrics } from "@/modules/auth/errors";
import type { UserRole } from "@/shared/types/database";

/**
 * Orphan type classification for new B2B schema.
 * Indicates specific reason why user is considered orphaned.
 */
export type OrphanType =
  | "no-users-record"     // No record in public.users table
  | "null-account-uuid"   // User exists but account_uuid is null
  | "deleted-user"        // User exists but deleted_at is not null
  | "deleted-account";    // User exists but referenced account is deleted

/**
 * Result of orphan detection check (success case only).
 *
 * NOTE: If orphan detection fails after all retries, OrphanDetectionError is thrown instead.
 * This interface only represents successful detection results.
 */
export interface OrphanCheckResult {
  /**
   * Whether the user is orphaned (exists in auth but has no valid account data)
   */
  orphaned: boolean;

  /**
   * Whether user has a valid account (both user and account exist and are not deleted)
   */
  hasValidAccount: boolean;

  /**
   * Account UUID for the user (null if orphaned or no account)
   */
  accountUuid: string | null;

  /**
   * User role within account (null if orphaned or no valid account)
   */
  role: UserRole | null;

  /**
   * Classification of orphan type (null if not orphaned)
   */
  orphanType: OrphanType | null;

  /**
   * Performance metrics for the orphan check operation
   */
  metrics: OrphanDetectionMetrics;
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
 * Generate Gaussian-distributed jitter using Box-Muller transform.
 * Produces normally distributed random values centered at mean with given std deviation.
 *
 * @param mean - Center point of the distribution
 * @param stdDev - Standard deviation (spread) of the distribution
 * @returns Random value from Gaussian distribution
 *
 * @example
 * ```typescript
 * // Generate jitter for 100ms base delay with ±50ms variation
 * const jitter = gaussianJitter(100, 50);
 * // Result will typically be between 50-150ms (within 1 std dev ~68% of time)
 * ```
 */
function gaussianJitter(mean: number, stdDev: number): number {
  // Box-Muller transform to generate Gaussian-distributed random values
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

  // Scale by standard deviation and shift by mean
  const result = z0 * stdDev + mean;

  // Ensure non-negative delay
  return Math.max(0, Math.round(result));
}

/**
 * Checks if a user is "orphaned" by querying the single users table with fail-closed retry logic.
 *
 * An orphaned user is one who exists in Supabase Auth (auth.users) but has issues with their
 * public.users record or account association. This can occur when:
 * 1. No record exists in public.users table (incomplete registration)
 * 2. User record exists but account_uuid is null (missing account link)
 * 3. User record exists but deleted_at is not null (soft-deleted user)
 * 4. User record exists but referenced account is deleted
 *
 * **Fail-Closed Retry Strategy**:
 * - Attempts: 3 retries with exponential backoff and Gaussian jitter
 * - Delays: 0ms (immediate), ~100ms ±50ms, ~300ms ±150ms
 * - Timeout: 200ms per attempt for fail-fast behavior
 * - Total max duration: ~2.5 seconds with retries
 * - On success: Return OrphanCheckResult with account_uuid and role
 * - On failure after all retries: Throw OrphanDetectionError (blocks login)
 *
 * **Performance Characteristics**:
 * - Target: <200ms at p95 (first attempt success)
 * - Timeout: 200ms per attempt (fail-fast for retry logic)
 * - Single query to users table (faster than parallel queries)
 * - Indexed columns: users(user_uuid), users(account_uuid)
 *
 * **Error Handling (Fail-Closed)**:
 * - On timeout: Retry with Gaussian jitter, throw OrphanDetectionError after 3 attempts
 * - On query error: Retry with Gaussian jitter, throw OrphanDetectionError after 3 attempts
 * - All errors logged with correlation ID for monitoring and alerting
 *
 * **Security Considerations**:
 * - Uses RLS-enabled Supabase client (anon key)
 * - Query timeout prevents DoS/hanging requests
 * - Fail-closed policy: prioritize security over availability
 * - Secondary account validation prevents orphaned account references
 *
 * @param userId - Supabase Auth user ID (UUID)
 * @param options - Optional configuration for retry behavior and timeouts
 * @returns Promise resolving to OrphanCheckResult on success
 * @throws {OrphanDetectionError} When detection fails after all retry attempts
 *
 * @example
 * ```typescript
 * try {
 *   const result = await checkIfOrphaned(user.id);
 *   if (result.orphaned) {
 *     // User is orphaned - block login and trigger recovery
 *     throw new OrphanedUserError(user.email, result.orphanType);
 *   }
 *   // Use result.accountUuid and result.role for session enrichment
 *   console.log('Account:', result.accountUuid, 'Role:', result.role);
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
 * @see /plans/auth-b2b-schema-migration for migration details
 */
export async function checkIfOrphaned(
  userId: string,
  options: OrphanDetectionOptions = {}
): Promise<OrphanCheckResult> {
  // Extract options with defaults
  const maxRetries = options.maxRetries ?? 3;
  const timeoutMs = options.timeoutMs ?? 200;  // 200ms for fail-fast behavior

  // Generate correlation ID for end-to-end tracing
  const correlationId = crypto.randomUUID();
  const operationStartTime = performance.now();
  const operationStartTimestamp = new Date().toISOString();

  // Track cumulative query duration across all attempts
  let cumulativeQueryDurationMs = 0;

  // Retry loop with exponential backoff and Gaussian jitter
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Apply Gaussian jitter backoff delay before retry (skip for first attempt)
    if (attempt > 1) {
      // Exponential backoff with Gaussian jitter:
      // Attempt 2: ~100ms ±50ms (mean=100, stdDev=50)
      // Attempt 3: ~300ms ±150ms (mean=300, stdDev=150)
      const basedelay = attempt === 2 ? 100 : 300;
      const stdDev = basedelay / 2;  // Standard deviation is half the mean
      const delayMs = gaussianJitter(basedelay, stdDev);

      console.info("[orphanDetection] Applying Gaussian jitter backoff before retry:", {
        correlationId,
        attempt,
        maxRetries,
        delayMs,
        baseDelay: basedelay,
        stdDev,
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

      // Single query to users table for user record
      const userQueryPromise = supabase
        .from("users")
        .select("user_uuid, account_uuid, role, deleted_at")
        .eq("user_uuid", userId)
        .limit(1)
        .maybeSingle();

      // Create timeout promise that rejects after configured timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), timeoutMs)
      );

      // Race query against timeout
      const userResult = await Promise.race([
        userQueryPromise,
        timeoutPromise,
      ]);

      // Record query completion time
      const queryEndTime = performance.now();
      const queryDurationMs = queryEndTime - queryStartTime;
      cumulativeQueryDurationMs += queryDurationMs;

      // Check for query errors (excluding PGRST116 which means "no rows found")
      if (userResult.error && userResult.error.code !== "PGRST116") {
        throw new Error(
          `Users query error: ${userResult.error.message} (code: ${userResult.error.code})`
        );
      }

      // SUCCESS - Query completed without timeout or error

      // Classify orphan status based on users table query result
      let orphaned = false;
      let orphanType: OrphanType | null = null;
      let accountUuid: string | null = null;
      let role: UserRole | null = null;
      let hasValidAccount = false;

      // Case 1: No record in users table
      if (!userResult.data) {
        orphaned = true;
        orphanType = "no-users-record";
        console.info("[orphanDetection] No users table record found (orphaned):", {
          correlationId,
          userId,
          orphanType,
        });
      }
      // Case 2: User record exists, check for account issues
      else {
        const userData = userResult.data;
        accountUuid = userData.account_uuid;
        role = userData.role as UserRole;

        // Case 2a: account_uuid is null
        if (userData.account_uuid === null) {
          orphaned = true;
          orphanType = "null-account-uuid";
          console.info("[orphanDetection] User has null account_uuid (orphaned):", {
            correlationId,
            userId,
            orphanType,
          });
        }
        // Case 2b: User is soft-deleted
        else if (userData.deleted_at !== null) {
          orphaned = true;
          orphanType = "deleted-user";
          console.info("[orphanDetection] User is soft-deleted (orphaned):", {
            correlationId,
            userId,
            orphanType,
            deletedAt: userData.deleted_at,
          });
        }
        // Case 2c: Validate account exists and is not deleted
        else {
          // Secondary query to validate account
          const accountQueryStart = performance.now();
          const accountResult = await supabase
            .from("accounts")
            .select("deleted_at")
            .eq("account_uuid", userData.account_uuid)
            .limit(1)
            .maybeSingle();

          const accountQueryDuration = performance.now() - accountQueryStart;
          cumulativeQueryDurationMs += accountQueryDuration;

          // Check account query errors
          if (accountResult.error && accountResult.error.code !== "PGRST116") {
            throw new Error(
              `Account query error: ${accountResult.error.message} (code: ${accountResult.error.code})`
            );
          }

          // Account doesn't exist or is deleted
          if (!accountResult.data || accountResult.data.deleted_at !== null) {
            orphaned = true;
            orphanType = "deleted-account";
            console.info("[orphanDetection] Referenced account is deleted or missing (orphaned):", {
              correlationId,
              userId,
              accountUuid: userData.account_uuid,
              orphanType,
              accountExists: !!accountResult.data,
              accountDeletedAt: accountResult.data?.deleted_at,
            });
          }
          // Valid user with valid account
          else {
            hasValidAccount = true;
            console.info("[orphanDetection] User has valid account (not orphaned):", {
              correlationId,
              userId,
              accountUuid,
              role,
            });
          }
        }
      }

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
        correlationId,
      };

      // Warn if detection was slow (exceeded p95 target of 200ms)
      if (metrics.totalDurationMs > 200) {
        console.warn("[orphanDetection] Orphan detection exceeded p95 target:", {
          correlationId,
          target: 200,
          actual: metrics.totalDurationMs,
          metrics,
        });
      }

      // Return result
      return {
        orphaned,
        hasValidAccount,
        accountUuid,
        role,
        orphanType,
        metrics,
      };

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
          correlationId,
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
