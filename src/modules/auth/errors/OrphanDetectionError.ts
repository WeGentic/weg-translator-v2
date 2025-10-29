/**
 * Custom error class for orphan detection failures in fail-closed mode.
 *
 * Thrown when orphan detection cannot complete successfully after all retry attempts
 * (due to database timeouts, connection errors, or query failures). This error triggers
 * fail-closed behavior: block login and display service unavailability message.
 *
 * **Fail-Closed Policy**:
 * - Security over availability: block access rather than allow potentially orphaned users
 * - Retry strategy: 3 attempts with exponential backoff (0ms, 200ms, 500ms)
 * - Total timeout: 2.2 seconds maximum
 * - User message: "Authentication system temporarily unavailable"
 *
 * **Use Cases**:
 * - Database timeout (queries exceed 500ms per attempt)
 * - Database connection failure (Postgres unreachable)
 * - Partial query failure (one of companies/company_admins queries fails)
 * - Network partition (edge function cannot reach database)
 *
 * **Handling**:
 * - Sign out user immediately (clear Supabase session)
 * - Log detailed metrics with correlation ID for monitoring/alerting
 * - Display user-friendly error: "try again in a few minutes, contact support if persists"
 * - Do NOT allow login (fail-closed security policy)
 *
 * @example
 * ```typescript
 * try {
 *   const result = await checkIfOrphaned(userId, { maxRetries: 3 });
 * } catch (error) {
 *   if (error instanceof OrphanDetectionError) {
 *     // Fail-closed: block login and show error
 *     await supabase.auth.signOut();
 *     logger.error('Orphan detection failed (fail-closed)', {
 *       correlationId: error.correlationId,
 *       metrics: error.metrics,
 *       attemptCount: error.attemptCount
 *     });
 *     throw new Error('Authentication system temporarily unavailable. Please try again.');
 *   }
 * }
 * ```
 *
 * **Requirements Satisfied**:
 * - Req#2 (Orphan Detection Case 1.2)
 * - Req#4 (Enhanced Login Flow)
 * - NFR-21 (Fail-closed edge function errors)
 *
 * **Related Components**:
 * - orphanDetection utility (throws this error)
 * - AuthProvider (catches and handles this error)
 * - fail-closed-policy.md design document
 *
 * @see /plans/registration-edge-case-fix/designs/fail-closed-policy.md
 * @see /plans/registration-edge-case-fix/designs/orphan-detection-queries-fail-closed.md
 */

/**
 * Performance and diagnostic metrics for orphan detection operations
 */
export interface OrphanDetectionMetrics {
  /**
   * Timestamp when operation started (ISO 8601 format)
   */
  startedAt: string;

  /**
   * Timestamp when operation completed (ISO 8601 format)
   */
  completedAt: string;

  /**
   * Total duration including retries and backoff delays (milliseconds)
   */
  totalDurationMs: number;

  /**
   * Duration of actual database query execution only (milliseconds)
   * Excludes retry delays, only counts time spent waiting for database
   */
  queryDurationMs: number;

  /**
   * Number of retry attempts made (1-3)
   * - 1: succeeded on first attempt
   * - 2: first attempt failed, succeeded on second
   * - 3: failed all attempts
   */
  attemptCount: number;

  /**
   * Whether any attempt timed out (exceeded 500ms timeout)
   */
  timedOut: boolean;

  /**
   * Whether any attempt had an error (database error, connection failure, etc.)
   */
  hadError: boolean;
}

/**
 * Error thrown when orphan detection fails after all retry attempts.
 * Triggers fail-closed behavior: block login for security.
 */
export class OrphanDetectionError extends Error {
  /**
   * Unique correlation ID for tracing this operation through logs and monitoring
   */
  public readonly correlationId: string;

  /**
   * Performance and diagnostic metrics from the failed detection operation
   */
  public readonly metrics: OrphanDetectionMetrics;

  /**
   * Number of retry attempts made before giving up (typically 3)
   */
  public readonly attemptCount: number;

  /**
   * Creates a new OrphanDetectionError instance.
   *
   * @param message - Error message (e.g., "Orphan detection failed after all retry attempts")
   * @param correlationId - UUID for request tracing across login flow
   * @param metrics - Performance metrics from the detection operation
   *
   * @example
   * ```typescript
   * throw new OrphanDetectionError(
   *   'Orphan detection failed after all retry attempts',
   *   crypto.randomUUID(),
   *   {
   *     startedAt: '2025-01-15T10:30:00.000Z',
   *     completedAt: '2025-01-15T10:30:02.200Z',
   *     totalDurationMs: 2200,
   *     queryDurationMs: 1500,
   *     attemptCount: 3,
   *     timedOut: true,
   *     hadError: false
   *   }
   * );
   * ```
   */
  constructor(message: string, correlationId: string, metrics: OrphanDetectionMetrics) {
    super(message);

    // Set error name for stack traces and error type checking
    this.name = 'OrphanDetectionError';

    // Store custom properties
    this.correlationId = correlationId;
    this.metrics = metrics;
    this.attemptCount = metrics.attemptCount;

    // Maintains proper stack trace for where error was thrown (V8 engine only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OrphanDetectionError);
    }

    // Set prototype explicitly for TypeScript class inheritance
    // See: https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, OrphanDetectionError.prototype);
  }

  /**
   * Returns a JSON representation of the error for logging and monitoring.
   * Use this for structured logging in alerting systems.
   *
   * @returns JSON object with all error properties and metrics
   *
   * @example
   * ```typescript
   * logger.error('Orphan detection failed (fail-closed)', orphanDetectionError.toJSON());
   * ```
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      correlationId: this.correlationId,
      attemptCount: this.attemptCount,
      metrics: {
        startedAt: this.metrics.startedAt,
        completedAt: this.metrics.completedAt,
        totalDurationMs: this.metrics.totalDurationMs,
        queryDurationMs: this.metrics.queryDurationMs,
        attemptCount: this.metrics.attemptCount,
        timedOut: this.metrics.timedOut,
        hadError: this.metrics.hadError
      },
      stack: this.stack
    };
  }

  /**
   * Returns a detailed string representation for debugging.
   *
   * @returns Formatted error message with key metrics
   */
  toString(): string {
    return `${this.name}: ${this.message} (correlationId: ${this.correlationId}, attempts: ${this.attemptCount}, duration: ${this.metrics.totalDurationMs}ms, timedOut: ${this.metrics.timedOut}, hadError: ${this.metrics.hadError})`;
  }

  /**
   * Returns user-friendly error message for display in UI.
   * Does not expose technical details or security-sensitive information.
   *
   * @returns User-facing error message
   *
   * @example
   * ```typescript
   * toast.error(orphanDetectionError.getUserMessage());
   * ```
   */
  getUserMessage(): string {
    return `Authentication system is temporarily unavailable. Please try again in a few minutes. If this problem persists, please contact support with reference ID: ${this.correlationId}`;
  }
}
