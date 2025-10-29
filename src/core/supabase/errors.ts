/**
 * Error handling and mapping for Supabase database operations.
 * Maps PostgreSQL error codes to user-friendly messages with correlation ID tracking.
 */

/**
 * PostgreSQL error codes.
 * See: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export enum DatabaseErrorCode {
  // Integrity Constraint Violations
  UNIQUE_VIOLATION = '23505',
  FOREIGN_KEY_VIOLATION = '23503',
  CHECK_VIOLATION = '23514',
  NOT_NULL_VIOLATION = '23502',

  // Insufficient Privilege
  RLS_VIOLATION = '42501',

  // Supabase-specific error codes
  NOT_FOUND = 'PGRST116', // Resource not found
  ROW_NOT_FOUND = 'PGRST301', // Single row not found
}

/**
 * Database error from Supabase/PostgreSQL.
 * Includes error code, details, and optional hint.
 */
export interface DatabaseError extends Error {
  code: string;
  details?: string;
  hint?: string;
  message: string;
}

/**
 * User-friendly error categorization.
 */
export type ErrorType =
  | 'validation' // Input validation error (unique, check, etc.)
  | 'authorization' // RLS policy violation
  | 'not_found' // Resource not found
  | 'foreign_key' // Referenced record does not exist
  | 'unknown'; // Unexpected error

/**
 * User-friendly error structure.
 */
export interface UserFriendlyError {
  type: ErrorType;
  message: string;
  field?: string; // Field name for validation errors
  correlationId?: string; // Correlation ID for tracing
  originalError?: unknown; // Original error for debugging
}

/**
 * Maps Supabase/PostgreSQL errors to user-friendly messages.
 *
 * @param error - The error from Supabase operation
 * @param correlationId - Optional correlation ID for tracing
 * @returns User-friendly error with type and message
 *
 * @example
 * ```typescript
 * try {
 *   await supabase.from('companies').insert(payload);
 * } catch (error) {
 *   const userError = mapSupabaseError(error, correlationId);
 *   console.error('Operation failed:', userError);
 *   throw userError;
 * }
 * ```
 */
export function mapSupabaseError(
  error: unknown,
  correlationId?: string
): UserFriendlyError {
  // Handle non-Error objects
  if (!(error instanceof Error)) {
    return {
      type: 'unknown',
      message: 'An unexpected error occurred. Please try again.',
      correlationId,
      originalError: error,
    };
  }

  const dbError = error as DatabaseError;

  // Map specific error codes
  switch (dbError.code) {
    case DatabaseErrorCode.UNIQUE_VIOLATION: {
      // Parse constraint name from error message or details
      const constraintMatch =
        dbError.message?.match(/constraint "([^"]+)"/) ||
        dbError.details?.match(/Key \(([^)]+)\)/);

      if (constraintMatch) {
        const constraint = constraintMatch[1];

        // Company VAT ID unique violation
        if (constraint.includes('vat_id') || constraint.includes('companies_vat_id')) {
          return {
            type: 'validation',
            message: 'A company with this VAT ID already exists',
            field: 'vat_id',
            correlationId,
            originalError: error,
          };
        }

        // Company membership unique violation
        if (constraint.includes('company_members_unique_membership')) {
          return {
            type: 'validation',
            message: 'This user is already a member of this company',
            field: 'user_id',
            correlationId,
            originalError: error,
          };
        }

        // Profile ID unique violation (shouldn't happen due to trigger)
        if (constraint.includes('profiles_pkey')) {
          return {
            type: 'validation',
            message: 'A profile already exists for this user',
            field: 'id',
            correlationId,
            originalError: error,
          };
        }
      }

      // Generic unique violation
      return {
        type: 'validation',
        message: 'This record already exists',
        correlationId,
        originalError: error,
      };
    }

    case DatabaseErrorCode.FOREIGN_KEY_VIOLATION: {
      // Parse foreign key constraint name
      const fkMatch =
        dbError.message?.match(/constraint "([^"]+)"/) ||
        dbError.details?.match(/Key \(([^)]+)\)/);

      if (fkMatch) {
        const fkName = fkMatch[1];

        // Company FK violation
        if (fkName.includes('company_id')) {
          return {
            type: 'foreign_key',
            message: 'The specified company does not exist',
            field: 'company_id',
            correlationId,
            originalError: error,
          };
        }

        // User/Profile FK violation
        if (fkName.includes('user_id') || fkName.includes('profiles')) {
          return {
            type: 'foreign_key',
            message: 'The specified user does not exist',
            field: 'user_id',
            correlationId,
            originalError: error,
          };
        }
      }

      // Generic FK violation
      return {
        type: 'foreign_key',
        message: 'Referenced record does not exist',
        correlationId,
        originalError: error,
      };
    }

    case DatabaseErrorCode.CHECK_VIOLATION: {
      // Parse constraint name
      const checkMatch = dbError.message?.match(/constraint "([^"]+)"/);

      if (checkMatch) {
        const constraint = checkMatch[1];

        // Company email check violation
        if (constraint.includes('companies_email_check')) {
          return {
            type: 'validation',
            message: 'Invalid email address format',
            field: 'email',
            correlationId,
            originalError: error,
          };
        }

        // Member role check violation
        if (constraint.includes('company_members_role_check')) {
          return {
            type: 'validation',
            message: "Role must be one of: 'owner', 'admin', 'member'",
            field: 'role',
            correlationId,
            originalError: error,
          };
        }
      }

      // Generic check violation
      return {
        type: 'validation',
        message: 'Invalid value provided',
        correlationId,
        originalError: error,
      };
    }

    case DatabaseErrorCode.NOT_NULL_VIOLATION: {
      // Parse column name
      const columnMatch = dbError.message?.match(/column "([^"]+)"/);
      const column = columnMatch ? columnMatch[1] : undefined;

      return {
        type: 'validation',
        message: `Required field is missing${column ? `: ${column}` : ''}`,
        field: column,
        correlationId,
        originalError: error,
      };
    }

    case DatabaseErrorCode.RLS_VIOLATION: {
      return {
        type: 'authorization',
        message: 'You do not have permission to perform this action',
        correlationId,
        originalError: error,
      };
    }

    case DatabaseErrorCode.NOT_FOUND:
    case DatabaseErrorCode.ROW_NOT_FOUND: {
      return {
        type: 'not_found',
        message: 'The requested resource was not found',
        correlationId,
        originalError: error,
      };
    }

    default: {
      // Check for common error messages
      const errorMessage = dbError.message?.toLowerCase() || '';

      if (errorMessage.includes('permission denied') || errorMessage.includes('insufficient privilege')) {
        return {
          type: 'authorization',
          message: 'You do not have permission to perform this action',
          correlationId,
          originalError: error,
        };
      }

      if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
        return {
          type: 'not_found',
          message: 'The requested resource was not found',
          correlationId,
          originalError: error,
        };
      }

      // Unknown error
      return {
        type: 'unknown',
        message: 'An unexpected error occurred. Please try again.',
        correlationId,
        originalError: error,
      };
    }
  }
}

/**
 * Generates a correlation ID for request tracing.
 * Uses crypto.randomUUID() for unique identifier generation.
 *
 * @returns UUID v4 string
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

/**
 * Logs an error with correlation ID and context.
 *
 * @param operation - The operation that failed (e.g., 'createCompany', 'inviteMember')
 * @param error - The error that occurred
 * @param context - Additional context (userId, companyId, etc.)
 */
export function logOperationError(
  operation: string,
  error: UserFriendlyError,
  context?: Record<string, unknown>
): void {
  console.error('[Supabase Operation Failed]', {
    operation,
    errorType: error.type,
    errorMessage: error.message,
    field: error.field,
    correlationId: error.correlationId,
    context,
    timestamp: new Date().toISOString(),
  });

  // In development, also log the original error for debugging
  if (import.meta.env.DEV && error.originalError) {
    console.error('[Original Error]', error.originalError);
  }
}
