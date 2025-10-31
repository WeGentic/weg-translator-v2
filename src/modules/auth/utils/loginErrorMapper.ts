/**
 * Login Error Mapper Utility
 *
 * Maps Supabase AuthError instances to user-friendly LoginError instances with
 * correlation IDs for debugging and support ticket tracking.
 *
 * This utility follows the error mapping pattern established in the registration flow
 * (useRegistrationSubmission.ts) and provides comprehensive error detection for all
 * common Supabase authentication error types.
 *
 * **Key Features**:
 * - Detects specific error types using status codes and message patterns
 * - Maps technical errors to user-friendly, actionable messages
 * - Generates correlation IDs for error tracking and debugging
 * - Handles unknown/unexpected errors gracefully with fallback messages
 *
 * **Usage Pattern**:
 * ```typescript
 * import { mapAuthError } from '@/modules/auth/utils/loginErrorMapper';
 *
 * try {
 *   const { data, error } = await supabase.auth.signInWithPassword({ email, password });
 *   if (error) {
 *     const loginError = mapAuthError(error);
 *     toast({
 *       description: loginError.getUserMessage(),
 *       variant: "destructive",
 *       duration: 8000
 *     });
 *     logger.error('Login failed', loginError.toJSON());
 *   }
 * } catch (error) {
 *   const loginError = mapUnknownError(error);
 *   // Handle unexpected error...
 * }
 * ```
 *
 * **Requirements Satisfied**: FR-002, FR-005
 * **Related Components**: LoginError, AuthProvider, LoginForm
 */

import type { AuthError } from "@supabase/supabase-js";
import { LoginError } from "@/modules/auth/errors";

/**
 * User-friendly error messages for all login error types.
 *
 * These messages are crafted to be:
 * - Clear and free of technical jargon
 * - Actionable (tell users what to do next)
 * - Under 80 characters for quick readability
 * - Appropriate for toast notification display
 */
const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: "Email or password is incorrect. Please try again.",
  EMAIL_NOT_CONFIRMED: "Please verify your email before signing in. Check your inbox.",
  ACCOUNT_LOCKED: "Account temporarily locked due to multiple failed attempts. Try again later.",
  NETWORK_ERROR: "Network connection failed. Please check your internet.",
  SERVICE_UNAVAILABLE: "Authentication service is temporarily unavailable. Please try again.",
  SESSION_EXPIRED: "Your session has expired. Please log in again.",
  USER_NOT_FOUND: "No account found with this email.",
  UNKNOWN_ERROR: "An unexpected error occurred. Please try again.",
} as const;

/**
 * Error code type derived from ERROR_MESSAGES keys.
 * Ensures type safety when working with error codes.
 */
type ErrorCode = keyof typeof ERROR_MESSAGES;

/**
 * Checks if error is caused by invalid email or password credentials.
 *
 * Detects status 400 errors with messages indicating wrong email or password.
 * This check should be performed AFTER more specific 400 checks (email not confirmed,
 * user not found) to avoid false positives.
 *
 * @param error - Supabase AuthError from signInWithPassword
 * @returns True if error indicates invalid credentials
 *
 * @example
 * ```typescript
 * if (isInvalidCredentialsError(error)) {
 *   console.log('User entered wrong email or password');
 * }
 * ```
 */
function isInvalidCredentialsError(error: AuthError): boolean {
  const status = typeof (error as { status?: number }).status === "number"
    ? (error as { status?: number }).status
    : undefined;

  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";

  // Check for status 400 with invalid credential patterns
  if (status === 400) {
    return (
      message.includes("invalid login credentials") ||
      message.includes("invalid credentials") ||
      message.includes("invalid email or password") ||
      message.includes("incorrect password")
    );
  }

  return false;
}

/**
 * Checks if error is caused by unverified/unconfirmed email address.
 *
 * Detects status 400 errors indicating user has not clicked email verification link.
 * Users should be directed to check their inbox for the confirmation email.
 *
 * @param error - Supabase AuthError from signInWithPassword
 * @returns True if error indicates email not confirmed
 *
 * @example
 * ```typescript
 * if (isEmailNotConfirmedError(error)) {
 *   // Offer to resend verification email
 *   console.log('User needs to verify email first');
 * }
 * ```
 */
function isEmailNotConfirmedError(error: AuthError): boolean {
  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";
  const status = typeof (error as { status?: number }).status === "number"
    ? (error as { status?: number }).status
    : undefined;

  // Check status 400 with "not confirmed" pattern (most reliable)
  if (status === 400 && message.includes("not confirmed")) {
    return true;
  }

  // Fallback to message-only check
  return message.includes("email not confirmed");
}

/**
 * Checks if account is temporarily locked due to too many failed login attempts.
 *
 * Detects status 429 (Too Many Requests) errors indicating rate limiting.
 * User should wait before attempting to login again.
 *
 * @param error - Supabase AuthError from signInWithPassword
 * @returns True if error indicates account locked
 *
 * @example
 * ```typescript
 * if (isAccountLockedError(error)) {
 *   console.log('Account locked - user should wait before retrying');
 * }
 * ```
 */
function isAccountLockedError(error: AuthError): boolean {
  const status = typeof (error as { status?: number }).status === "number"
    ? (error as { status?: number }).status
    : undefined;

  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";

  // Status 429 is the primary indicator
  if (status === 429) {
    return true;
  }

  // Check for rate limit/lockout patterns in message
  return (
    message.includes("too many") ||
    message.includes("rate limit") ||
    message.includes("temporarily locked") ||
    message.includes("account locked")
  );
}

/**
 * Checks if error is caused by network connectivity issues.
 *
 * Detects errors with missing status codes or network-related error messages.
 * Indicates user's internet connection may be down or unstable.
 *
 * @param error - Error object (may be AuthError or generic Error)
 * @returns True if error indicates network failure
 *
 * @example
 * ```typescript
 * if (isNetworkError(error)) {
 *   console.log('Network issue - user should check internet connection');
 * }
 * ```
 */
function isNetworkError(error: unknown): boolean {
  // Check if error has a message property
  if (typeof error !== "object" || error === null || !("message" in error)) {
    return false;
  }

  const message = typeof (error as { message?: unknown }).message === "string"
    ? (error as { message: string }).message.toLowerCase()
    : "";

  const status = "status" in error && typeof (error as { status?: number }).status === "number"
    ? (error as { status?: number }).status
    : undefined;

  // Network errors typically have no status or status 0
  if (status === undefined || status === 0) {
    return (
      message.includes("fetch failed") ||
      message.includes("network") ||
      message.includes("connection failed") ||
      message.includes("network request failed") ||
      message.includes("failed to fetch")
    );
  }

  return false;
}

/**
 * Checks if error is caused by Supabase service being unavailable or experiencing issues.
 *
 * Detects status 500+ errors indicating server-side problems.
 * User should retry later or contact support if issue persists.
 *
 * @param error - Supabase AuthError from signInWithPassword
 * @returns True if error indicates service unavailable
 *
 * @example
 * ```typescript
 * if (isServiceUnavailableError(error)) {
 *   console.log('Supabase service down - user should retry later');
 * }
 * ```
 */
function isServiceUnavailableError(error: AuthError): boolean {
  const status = typeof (error as { status?: number }).status === "number"
    ? (error as { status?: number }).status
    : undefined;

  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";

  // Status 500+ indicates server error
  if (status !== undefined && status >= 500) {
    return true;
  }

  // Check for service unavailable patterns
  return (
    message.includes("server error") ||
    message.includes("service unavailable") ||
    message.includes("internal error") ||
    message.includes("503")
  );
}

/**
 * Checks if error is caused by expired session or token.
 *
 * Detects status 401 errors indicating authentication token has expired.
 * User needs to log in again to get a fresh session.
 *
 * @param error - Supabase AuthError from signInWithPassword
 * @returns True if error indicates session expired
 *
 * @example
 * ```typescript
 * if (isSessionExpiredError(error)) {
 *   console.log('Session expired - redirect to login');
 * }
 * ```
 */
function isSessionExpiredError(error: AuthError): boolean {
  const status = typeof (error as { status?: number }).status === "number"
    ? (error as { status?: number }).status
    : undefined;

  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";

  // Status 401 typically indicates expired session
  if (status === 401) {
    return true;
  }

  // Check for session/token expiration patterns
  return (
    message.includes("session expired") ||
    message.includes("token expired") ||
    message.includes("jwt expired") ||
    message.includes("expired token")
  );
}

/**
 * Checks if error is caused by user account not existing in database.
 *
 * Detects status 400 errors indicating no user found with provided email.
 * User may need to register first or check for typos in email.
 *
 * @param error - Supabase AuthError from signInWithPassword
 * @returns True if error indicates user not found
 *
 * @example
 * ```typescript
 * if (isUserNotFoundError(error)) {
 *   console.log('No account found - suggest registration');
 * }
 * ```
 */
function isUserNotFoundError(error: AuthError): boolean {
  const status = typeof (error as { status?: number }).status === "number"
    ? (error as { status?: number }).status
    : undefined;

  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";

  // Check for status 400 with user not found patterns
  if (status === 400) {
    return (
      message.includes("user not found") ||
      message.includes("no user found") ||
      message.includes("user does not exist") ||
      message.includes("couldn't find your account")
    );
  }

  return false;
}

/**
 * Returns user-friendly error message for given error code.
 *
 * Maps machine-readable error codes to clear, actionable messages suitable
 * for display in toast notifications. Falls back to generic unknown error
 * message if code not recognized.
 *
 * @param code - Error code (e.g., 'INVALID_CREDENTIALS', 'EMAIL_NOT_CONFIRMED')
 * @returns User-friendly error message
 *
 * @example
 * ```typescript
 * const message = getErrorMessage('INVALID_CREDENTIALS');
 * console.log(message); // "Email or password is incorrect. Please try again."
 * ```
 */
function getErrorMessage(code: string): string {
  // Type-safe lookup with fallback to unknown error
  return ERROR_MESSAGES[code as ErrorCode] ?? ERROR_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Maps Supabase AuthError to LoginError with user-friendly message and correlation ID.
 *
 * Detects specific error types (invalid credentials, email not confirmed, account locked,
 * network errors, service unavailable, session expired, user not found) and returns
 * appropriate user-facing messages. All errors include correlation IDs for debugging
 * and support ticket tracking.
 *
 * **Error Detection Order**:
 * 1. Email not confirmed (specific 400 check)
 * 2. User not found (specific 400 check)
 * 3. Session expired (401 check)
 * 4. Account locked (429 check)
 * 5. Service unavailable (500+ check)
 * 6. Network error (no status check)
 * 7. Invalid credentials (generic 400 fallback)
 * 8. Unknown error (final fallback)
 *
 * Order matters because multiple error types share status 400, so we check more
 * specific patterns before falling back to generic invalid credentials.
 *
 * @param error - Supabase AuthError from signInWithPassword
 * @param correlationId - Optional correlation ID for request tracing (auto-generated if not provided)
 * @returns LoginError instance with code, message, status, userMessage, and correlationId
 *
 * @example
 * ```typescript
 * // Basic usage
 * try {
 *   const { data, error } = await supabase.auth.signInWithPassword({ email, password });
 *   if (error) {
 *     const loginError = mapAuthError(error);
 *     toast({
 *       description: loginError.getUserMessage(),
 *       variant: "destructive",
 *       duration: 8000
 *     });
 *     logger.error('Login failed', loginError.toJSON());
 *   }
 * } catch (error) {
 *   if (error instanceof AuthError) {
 *     const loginError = mapAuthError(error);
 *     // Handle error...
 *   }
 * }
 *
 * // With explicit correlation ID for request tracing
 * const requestId = crypto.randomUUID();
 * const loginError = mapAuthError(authError, requestId);
 * logger.error('Login failed', { ...loginError.toJSON(), requestId });
 * ```
 */
export function mapAuthError(error: AuthError, correlationId?: string): LoginError {
  // Generate or use provided correlation ID for error tracking
  const id = correlationId ?? crypto.randomUUID();

  // Extract status code from error (default to 0 if missing)
  const status: number = typeof (error as { status?: number }).status === "number"
    ? (error as { status?: number }).status!
    : 0;

  // Extract technical error message for logging
  const technicalMessage = typeof error.message === "string" && error.message.trim().length > 0
    ? error.message
    : "Authentication failed";

  // Detect error type using detection functions in specific order
  // Order matters! Check more specific patterns before generic ones
  let code: ErrorCode;

  if (isEmailNotConfirmedError(error)) {
    code = "EMAIL_NOT_CONFIRMED";
  } else if (isUserNotFoundError(error)) {
    code = "USER_NOT_FOUND";
  } else if (isSessionExpiredError(error)) {
    code = "SESSION_EXPIRED";
  } else if (isAccountLockedError(error)) {
    code = "ACCOUNT_LOCKED";
  } else if (isServiceUnavailableError(error)) {
    code = "SERVICE_UNAVAILABLE";
  } else if (isNetworkError(error)) {
    code = "NETWORK_ERROR";
  } else if (isInvalidCredentialsError(error)) {
    code = "INVALID_CREDENTIALS";
  } else {
    code = "UNKNOWN_ERROR";
  }

  // Get user-friendly message for detected error type
  const userMessage = getErrorMessage(code);

  // Create and return LoginError instance
  return new LoginError(
    code,
    technicalMessage,
    status,
    userMessage,
    id
  );
}

/**
 * Maps unknown/unexpected errors to LoginError with generic fallback message.
 *
 * Handles errors that are not Supabase AuthError instances (e.g., network errors,
 * JavaScript errors, etc.). Provides a safe fallback with generic user message
 * while preserving technical details for debugging.
 *
 * **Use Cases**:
 * - Network fetch failures
 * - JavaScript runtime errors
 * - Unexpected error types from third-party libraries
 * - Any non-AuthError thrown during authentication
 *
 * @param error - Unknown error object from catch block
 * @returns LoginError instance with generic message and correlation ID
 *
 * @example
 * ```typescript
 * // Handling unknown errors in catch block
 * try {
 *   await login(email, password);
 * } catch (error) {
 *   let loginError: LoginError;
 *
 *   if (error instanceof AuthError) {
 *     loginError = mapAuthError(error);
 *   } else {
 *     loginError = mapUnknownError(error);
 *   }
 *
 *   toast({
 *     description: loginError.getUserMessage(),
 *     variant: "destructive"
 *   });
 *   logger.error('Login error', loginError.toJSON());
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Handling network errors
 * try {
 *   const response = await fetch('/api/login');
 *   if (!response.ok) throw new Error('Network error');
 * } catch (error) {
 *   const loginError = mapUnknownError(error);
 *   // loginError.code === 'UNKNOWN_ERROR'
 *   // loginError.getUserMessage() === 'An unexpected error occurred. Please try again.'
 * }
 * ```
 */
export function mapUnknownError(error: unknown): LoginError {
  // Generate correlation ID for error tracking
  const correlationId = crypto.randomUUID();

  // Extract message from error if available
  let technicalMessage = "An unexpected error occurred during authentication";

  if (typeof error === "object" && error !== null && "message" in error) {
    const errorMessage = (error as { message: unknown }).message;
    if (typeof errorMessage === "string" && errorMessage.trim().length > 0) {
      technicalMessage = errorMessage;
    }
  }

  // Get user-friendly message for unknown error
  const userMessage = getErrorMessage("UNKNOWN_ERROR");

  // Create LoginError with generic unknown error code
  return new LoginError(
    "UNKNOWN_ERROR",
    technicalMessage,
    0, // No HTTP status for unknown errors
    userMessage,
    correlationId
  );
}
