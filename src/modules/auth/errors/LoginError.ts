/**
 * Custom error class for login authentication failures.
 *
 * Thrown when a user authentication attempt fails via Supabase Auth, providing
 * rich context including error codes, HTTP status, correlation IDs for tracking,
 * and user-friendly messages suitable for toast notifications.
 *
 * **Use Cases**:
 * - Invalid email or password credentials
 * - Email not verified/confirmed
 * - Account locked due to multiple failed attempts
 * - Network connectivity errors
 * - Service unavailable errors
 *
 * **Handling**:
 * - Display user-friendly message via toast notification using getUserMessage()
 * - Log error details with correlation ID for debugging and support
 * - Provide actionable guidance to users (verify email, reset password, etc.)
 * - Distinguish between credential errors, verification errors, and network errors
 *
 * @example
 * ```typescript
 * // Creating a LoginError
 * throw new LoginError(
 *   'INVALID_CREDENTIALS',
 *   'Invalid login credentials',
 *   400,
 *   'Email or password is incorrect. Please try again.'
 * );
 *
 * // Handling a LoginError
 * try {
 *   await login(email, password);
 * } catch (error) {
 *   if (error instanceof LoginError) {
 *     toast({
 *       title: "Login Failed",
 *       description: error.getUserMessage(),
 *       variant: "destructive",
 *       duration: 8000
 *     });
 *     logger.error('Login failed', error.toJSON());
 *   }
 * }
 * ```
 *
 * **Requirements Satisfied**: FR-001 (Error Notification System for Login Failures)
 * **Related Components**: AuthProvider, LoginForm, loginErrorMapper, Toast System
 */
export class LoginError extends Error {
  /**
   * Error code identifying the type of login failure (e.g., 'INVALID_CREDENTIALS', 'EMAIL_NOT_CONFIRMED')
   */
  public readonly code: string;

  /**
   * HTTP status code from the Supabase authentication error
   */
  public readonly status: number;

  /**
   * Unique correlation ID for tracing this error through logs and support tickets
   */
  public readonly correlationId: string;

  /**
   * User-friendly message suitable for display in toast notifications
   */
  private readonly userMessage: string;

  /**
   * Creates a new LoginError instance.
   *
   * @param code - Error code identifying the failure type (e.g., 'INVALID_CREDENTIALS')
   * @param message - Technical error message for logging and debugging
   * @param status - HTTP status code from Supabase error (100-599)
   * @param userMessage - User-friendly message for toast notification display
   * @param correlationId - Optional UUID for request tracing (auto-generated if not provided)
   *
   * @throws {Error} If required parameters are missing or status code is invalid
   *
   * @example
   * ```typescript
   * // With auto-generated correlation ID
   * const error = new LoginError(
   *   'EMAIL_NOT_CONFIRMED',
   *   'Email not confirmed',
   *   400,
   *   'Please verify your email before signing in. Check your inbox.'
   * );
   *
   * // With explicit correlation ID for request tracing
   * const error = new LoginError(
   *   'NETWORK_ERROR',
   *   'Failed to connect to authentication service',
   *   0,
   *   'Network connection failed. Please check your internet.',
   *   crypto.randomUUID()
   * );
   * ```
   */
  constructor(
    code: string,
    message: string,
    status: number,
    userMessage: string,
    correlationId?: string
  ) {
    // Validate required parameters
    if (!code || !message || !userMessage) {
      throw new Error('LoginError: code, message, and userMessage are required');
    }

    // Validate status code is within valid HTTP range
    if (status < 0 || status > 599) {
      throw new Error('LoginError: status must be a valid HTTP status code (0-599)');
    }

    // Call parent Error constructor with technical message
    super(message);

    // Set error name for stack traces and error type checking
    this.name = 'LoginError';

    // Store custom properties
    this.code = code;
    this.status = status;
    this.userMessage = userMessage;
    this.correlationId = correlationId || crypto.randomUUID();

    // Maintains proper stack trace for where error was thrown (V8 engine only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LoginError);
    }

    // Set prototype explicitly for TypeScript class inheritance
    // See: https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, LoginError.prototype);
  }

  /**
   * Returns the user-friendly error message suitable for toast notification display.
   *
   * This message is crafted to be clear, actionable, and free of technical jargon,
   * providing users with guidance on what went wrong and what they should do next.
   *
   * @returns User-friendly error message for toast display
   *
   * @example
   * ```typescript
   * const error = new LoginError(
   *   'INVALID_CREDENTIALS',
   *   'Invalid login credentials',
   *   400,
   *   'Email or password is incorrect. Please try again.'
   * );
   *
   * console.log(error.getUserMessage());
   * // Output: "Email or password is incorrect. Please try again."
   *
   * toast({
   *   description: error.getUserMessage(),
   *   variant: "destructive"
   * });
   * ```
   */
  getUserMessage(): string {
    return this.userMessage;
  }

  /**
   * Returns a JSON representation of the error for structured logging and debugging.
   *
   * Includes all error properties (name, message, code, status, userMessage, correlationId)
   * plus the stack trace for comprehensive error tracking in logs and support tickets.
   *
   * @returns JSON object with all error properties
   *
   * @example
   * ```typescript
   * const error = new LoginError(
   *   'EMAIL_NOT_CONFIRMED',
   *   'Email not confirmed',
   *   400,
   *   'Please verify your email before signing in.'
   * );
   *
   * const errorDetails = error.toJSON();
   * logger.error('Login authentication failed', errorDetails);
   *
   * // Log output:
   * // {
   * //   name: 'LoginError',
   * //   message: 'Email not confirmed',
   * //   code: 'EMAIL_NOT_CONFIRMED',
   * //   status: 400,
   * //   userMessage: 'Please verify your email before signing in.',
   * //   correlationId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   * //   stack: 'LoginError: Email not confirmed\n    at ...'
   * // }
   * ```
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      userMessage: this.userMessage,
      correlationId: this.correlationId,
      stack: this.stack
    };
  }

  /**
   * Returns a detailed string representation of the error for console display.
   *
   * @returns Formatted error message with code, status, and correlation ID
   */
  toString(): string {
    return `${this.name}: ${this.message} (code: ${this.code}, status: ${this.status}, correlationId: ${this.correlationId})`;
  }
}
