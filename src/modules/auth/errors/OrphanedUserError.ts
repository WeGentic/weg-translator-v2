/**
 * Custom error class for orphaned user detection during login flow.
 *
 * Thrown when a user successfully authenticates via Supabase Auth but has no
 * corresponding company/admin records in PostgreSQL database (orphaned state).
 * This indicates an incomplete registration that requires cleanup and re-registration.
 *
 * **Use Cases**:
 * - Case 1.2 (Verified Orphan): User has verified email but no company data
 * - Detected during AuthProvider login flow after successful signInWithPassword()
 *
 * **Handling**:
 * - Immediately sign out user (clear Supabase session)
 * - Initiate cleanup flow by sending verification code to user's email
 * - Redirect to /register/recover route with email and reason parameters
 * - Display user-friendly notification explaining incomplete registration
 *
 * @example
 * ```typescript
 * try {
 *   await login(email, password);
 * } catch (error) {
 *   if (error instanceof OrphanedUserError) {
 *     // User is orphaned - redirect to recovery route
 *     navigate(`/register/recover?email=${encodeURIComponent(error.email)}&reason=orphaned`);
 *   }
 * }
 * ```
 *
 * **Requirements Satisfied**: Req 3 (Enhanced Login Flow with Orphan Detection)
 * **Related Components**: AuthProvider, orphanDetection utility, Recovery Route
 */
export class OrphanedUserError extends Error {
  /**
   * User's email address that was authenticated but has no company data
   */
  public readonly email: string;

  /**
   * Unique correlation ID for tracing this error through logs and recovery flow
   */
  public readonly correlationId: string;

  /**
   * URL to redirect user for recovery (includes email and reason query params)
   */
  public readonly redirectUrl: string;

  /**
   * Creates a new OrphanedUserError instance.
   *
   * @param email - The user's email address (used for cleanup flow and display)
   * @param correlationId - UUID for request tracing across login, cleanup, and recovery
   * @param redirectUrl - Optional custom redirect URL (defaults to /register/recover)
   *
   * @example
   * ```typescript
   * throw new OrphanedUserError(
   *   'user@example.com',
   *   crypto.randomUUID(),
   *   '/register/recover?email=user@example.com&reason=orphaned'
   * );
   * ```
   */
  constructor(email: string, correlationId: string, redirectUrl?: string) {
    // User-friendly message for display in toast notifications
    const message = "Your registration was incomplete. Redirecting you to complete the process.";

    super(message);

    // Set error name for stack traces and error type checking
    this.name = 'OrphanedUserError';

    // Store custom properties
    this.email = email;
    this.correlationId = correlationId;
    this.redirectUrl = redirectUrl || `/register/recover?email=${encodeURIComponent(email)}&reason=orphaned&correlationId=${correlationId}`;

    // Maintains proper stack trace for where error was thrown (V8 engine only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OrphanedUserError);
    }

    // Set prototype explicitly for TypeScript class inheritance
    // See: https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, OrphanedUserError.prototype);
  }

  /**
   * Returns a JSON representation of the error for logging and debugging.
   * Useful for support tickets and error tracking systems.
   *
   * @returns JSON object with all error properties
   *
   * @example
   * ```typescript
   * const errorDetails = orphanError.toJSON();
   * logger.error('Orphaned user detected', errorDetails);
   * ```
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      email: this.email,
      correlationId: this.correlationId,
      redirectUrl: this.redirectUrl,
      stack: this.stack
    };
  }

  /**
   * Returns a user-friendly string representation of the error.
   *
   * @returns Formatted error message with email (for console display)
   */
  toString(): string {
    return `${this.name}: ${this.message} (email: ${this.email}, correlationId: ${this.correlationId})`;
  }
}
