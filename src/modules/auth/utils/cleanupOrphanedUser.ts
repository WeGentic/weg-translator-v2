/**
 * Cleanup Orphaned User API Client
 *
 * This module provides type-safe wrappers for calling the cleanup-orphaned-user edge function.
 * It handles both steps of the cleanup flow:
 * 1. Request verification code (unauthenticated)
 * 2. Validate code and delete orphaned auth user
 *
 * Requirements: Req 1 (Orphaned User Cleanup), Req 2 (Verification Code System)
 * Related: Phase 1 tasks (cleanup edge function), Task 4.4 (Recovery UI integration)
 */

import { supabase } from "@/core/config/supabaseClient";
import { logger } from "@/core/logging/logger";

/**
 * Request body for cleanup edge function - request-code step
 */
interface CleanupRequestCodePayload {
  step: "request-code";
  email: string;
  correlationId?: string;
}

/**
 * Request body for cleanup edge function - validate-and-cleanup step
 */
interface CleanupValidatePayload {
  step: "validate-and-cleanup";
  email: string;
  verificationCode: string;
  correlationId?: string;
}

/**
 * Success response from cleanup edge function - code sent
 */
interface CleanupCodeSentResponse {
  success: true;
  message: string;
  correlationId: string;
  data: {
    step: "code-sent";
  };
}

/**
 * Success response from cleanup edge function - user deleted
 */
interface CleanupUserDeletedResponse {
  success: true;
  message: string;
  correlationId: string;
  data: {
    step: "user-deleted";
    deletedUserId: string;
    orphanClassification: "case_1_1" | "case_1_2";
  };
}

/**
 * Error response from cleanup edge function
 */
interface CleanupErrorResponse {
  error: {
    code: string;
    message: string;
    correlationId: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Error codes from cleanup edge function
 */
export const CLEANUP_ERROR_CODES = {
  EXPIRED_CODE: "ORPHAN_CLEANUP_001",
  INVALID_CODE: "ORPHAN_CLEANUP_002",
  RATE_LIMIT: "ORPHAN_CLEANUP_003",
  USER_NOT_FOUND: "ORPHAN_CLEANUP_004",
  NOT_ORPHANED: "ORPHAN_CLEANUP_005",
  DB_TRANSACTION_FAILED: "ORPHAN_CLEANUP_006",
  INVALID_INPUT: "ORPHAN_CLEANUP_007",
  EMAIL_DELIVERY_FAILED: "ORPHAN_CLEANUP_008",
  OPERATION_IN_PROGRESS: "ORPHAN_CLEANUP_009",
} as const;

/**
 * User-friendly error messages mapped from error codes
 */
export const CLEANUP_ERROR_MESSAGES: Record<string, string> = {
  [CLEANUP_ERROR_CODES.EXPIRED_CODE]:
    "Your verification code has expired. Click 'Resend code' to receive a new one.",
  [CLEANUP_ERROR_CODES.INVALID_CODE]:
    "The verification code you entered is incorrect. Please check and try again.",
  [CLEANUP_ERROR_CODES.RATE_LIMIT]:
    "Too many attempts. Please wait a few minutes before trying again.",
  [CLEANUP_ERROR_CODES.USER_NOT_FOUND]:
    "User account not found. It may have already been cleaned up.",
  [CLEANUP_ERROR_CODES.NOT_ORPHANED]:
    "This account has existing data and cannot be cleaned up automatically. Please contact support.",
  [CLEANUP_ERROR_CODES.DB_TRANSACTION_FAILED]:
    "A database error occurred. Please try again in a few moments.",
  [CLEANUP_ERROR_CODES.INVALID_INPUT]: "Invalid input. Please check your email and code.",
  [CLEANUP_ERROR_CODES.EMAIL_DELIVERY_FAILED]:
    "Failed to send verification email. Please try again.",
  [CLEANUP_ERROR_CODES.OPERATION_IN_PROGRESS]:
    "A cleanup operation is already in progress for this email. Please wait a moment and try again.",
};

/**
 * Custom error class for cleanup operations
 */
export class CleanupError extends Error {
  constructor(
    public code: string,
    message: string,
    public correlationId: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CleanupError";

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CleanupError);
    }
  }

  /**
   * Returns a user-friendly error message
   */
  getUserFriendlyMessage(): string {
    return CLEANUP_ERROR_MESSAGES[this.code] || this.message;
  }
}

/**
 * Request a verification code for orphaned user cleanup
 *
 * @param email - Email address of the orphaned user
 * @param correlationId - Optional correlation ID for request tracing
 * @returns Promise resolving to response with correlationId
 * @throws CleanupError if request fails
 */
export async function requestCleanupCode(
  email: string,
  correlationId?: string,
): Promise<CleanupCodeSentResponse> {
  try {
    const payload: CleanupRequestCodePayload = {
      step: "request-code",
      email: email.trim().toLowerCase(),
      ...(correlationId && { correlationId }),
    };

    logger.info("Requesting cleanup verification code", {
      email: email.trim().toLowerCase(),
      correlationId,
      operation: "cleanup-request-code",
    });

    const { data, error } = await supabase.functions.invoke<
      CleanupCodeSentResponse | CleanupErrorResponse
    >("cleanup-orphaned-user", {
      body: payload,
      headers: {
        ...(correlationId && { "x-correlation-id": correlationId }),
      },
    });

    // Handle edge function invocation errors
    if (error) {
      logger.error("Cleanup code request failed - invocation error", error, {
        email: email.trim().toLowerCase(),
        correlationId,
        errorName: error.name,
        errorMessage: error.message,
      });

      throw new CleanupError(
        "NETWORK_ERROR",
        "Failed to send verification code. Please check your internet connection and try again.",
        correlationId || crypto.randomUUID(),
        { originalError: error.name },
      );
    }

    // Handle error response from edge function
    if (data && "error" in data) {
      logger.warn("Cleanup code request failed - edge function error", {
        email: email.trim().toLowerCase(),
        errorCode: data.error.code,
        errorMessage: data.error.message,
        correlationId: data.error.correlationId,
      });

      throw new CleanupError(
        data.error.code,
        data.error.message,
        data.error.correlationId,
        data.error.details,
      );
    }

    // Success response
    if (data && "success" in data && data.success) {
      logger.info("Cleanup verification code sent successfully", {
        email: email.trim().toLowerCase(),
        correlationId: data.correlationId,
      });

      return data;
    }

    // Unexpected response format
    logger.error("Cleanup code request failed - unexpected response", {
      email: email.trim().toLowerCase(),
      correlationId,
      response: data,
    });

    throw new CleanupError(
      "UNEXPECTED_RESPONSE",
      "Received unexpected response from server. Please try again.",
      correlationId || crypto.randomUUID(),
      { response: data },
    );
  } catch (error) {
    // Re-throw CleanupError instances
    if (error instanceof CleanupError) {
      throw error;
    }

    // Wrap other errors
    logger.error("Cleanup code request failed - unknown error", error, {
      email: email.trim().toLowerCase(),
      correlationId,
    });

    throw new CleanupError(
      "UNKNOWN_ERROR",
      "An unexpected error occurred. Please try again.",
      correlationId || crypto.randomUUID(),
      { originalError: error instanceof Error ? error.message : String(error) },
    );
  }
}

/**
 * Validate verification code and delete orphaned user
 *
 * @param email - Email address of the orphaned user
 * @param verificationCode - 6-digit verification code sent to email
 * @param correlationId - Optional correlation ID for request tracing
 * @returns Promise resolving to response with deleted user details
 * @throws CleanupError if validation or deletion fails
 */
export async function validateAndCleanup(
  email: string,
  verificationCode: string,
  correlationId?: string,
): Promise<CleanupUserDeletedResponse> {
  try {
    // Validate code format client-side
    const sanitizedCode = verificationCode.replace(/\D/g, "");
    if (sanitizedCode.length !== 6) {
      throw new CleanupError(
        CLEANUP_ERROR_CODES.INVALID_INPUT,
        "Verification code must be exactly 6 digits.",
        correlationId || crypto.randomUUID(),
      );
    }

    const payload: CleanupValidatePayload = {
      step: "validate-and-cleanup",
      email: email.trim().toLowerCase(),
      verificationCode: sanitizedCode,
      ...(correlationId && { correlationId }),
    };

    logger.info("Validating cleanup verification code", {
      email: email.trim().toLowerCase(),
      correlationId,
      operation: "cleanup-validate-and-delete",
    });

    const { data, error } = await supabase.functions.invoke<
      CleanupUserDeletedResponse | CleanupErrorResponse
    >("cleanup-orphaned-user", {
      body: payload,
      headers: {
        ...(correlationId && { "x-correlation-id": correlationId }),
      },
    });

    // Handle edge function invocation errors
    if (error) {
      logger.error("Cleanup validation failed - invocation error", error, {
        email: email.trim().toLowerCase(),
        correlationId,
        errorName: error.name,
        errorMessage: error.message,
      });

      throw new CleanupError(
        "NETWORK_ERROR",
        "Failed to verify code. Please check your internet connection and try again.",
        correlationId || crypto.randomUUID(),
        { originalError: error.name },
      );
    }

    // Handle error response from edge function
    if (data && "error" in data) {
      logger.warn("Cleanup validation failed - edge function error", {
        email: email.trim().toLowerCase(),
        errorCode: data.error.code,
        errorMessage: data.error.message,
        correlationId: data.error.correlationId,
      });

      throw new CleanupError(
        data.error.code,
        data.error.message,
        data.error.correlationId,
        data.error.details,
      );
    }

    // Success response
    if (data && "success" in data && data.success && data.data.step === "user-deleted") {
      logger.info("Cleanup validation and deletion successful", {
        email: email.trim().toLowerCase(),
        correlationId: data.correlationId,
        deletedUserId: data.data.deletedUserId,
        orphanClassification: data.data.orphanClassification,
      });

      return data;
    }

    // Unexpected response format
    logger.error("Cleanup validation failed - unexpected response", {
      email: email.trim().toLowerCase(),
      correlationId,
      response: data,
    });

    throw new CleanupError(
      "UNEXPECTED_RESPONSE",
      "Received unexpected response from server. Please try again.",
      correlationId || crypto.randomUUID(),
      { response: data },
    );
  } catch (error) {
    // Re-throw CleanupError instances
    if (error instanceof CleanupError) {
      throw error;
    }

    // Wrap other errors
    logger.error("Cleanup validation failed - unknown error", error, {
      email: email.trim().toLowerCase(),
      correlationId,
    });

    throw new CleanupError(
      "UNKNOWN_ERROR",
      "An unexpected error occurred. Please try again.",
      correlationId || crypto.randomUUID(),
      { originalError: error instanceof Error ? error.message : String(error) },
    );
  }
}
