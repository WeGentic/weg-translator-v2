/**
 * Type Definitions for cleanup-orphaned-user Edge Function
 *
 * Purpose: Centralized type definitions for the two-step cleanup verification flow
 * Author: Claude Code (registration-edge-case-fix Phase 2)
 * Date: 2025-10-28
 */

import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

/**
 * Step 1: Request verification code
 * User provides email to initiate cleanup process
 */
export const requestCodeSchema = z.object({
  step: z.literal("request-code"),
  email: z.string().email().max(255),
  correlationId: z.string().uuid().optional(),
});

/**
 * Step 2: Validate code and perform cleanup
 * User provides verification code to authorize deletion
 */
export const validateCleanupSchema = z.object({
  step: z.literal("validate-and-cleanup"),
  email: z.string().email().max(255),
  verificationCode: z.string().length(8).regex(/^[A-Z2-9]{8}$/),
  correlationId: z.string().uuid().optional(),
});

/**
 * Discriminated union of request types
 */
export const cleanupRequestSchema = z.discriminatedUnion("step", [
  requestCodeSchema,
  validateCleanupSchema,
]);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type RequestCodePayload = z.infer<typeof requestCodeSchema>;
export type ValidateCleanupPayload = z.infer<typeof validateCleanupSchema>;
export type CleanupRequest = z.infer<typeof cleanupRequestSchema>;

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Success response structure
 */
export interface SuccessResponse {
  data: {
    message: string;
    correlationId: string;
    expiresAt?: string; // ISO timestamp for code expiry (Step 1 only)
  };
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    correlationId?: string;
    retryAfter?: number; // Seconds (rate limiting)
  };
}

// ============================================================================
// VERIFICATION CODE STORAGE
// ============================================================================

/**
 * Verification code record in Postgres
 */
export interface VerificationCodeRecord {
  id: string; // UUID
  email_hash: string; // SHA-256 hash of email
  code_hash: Uint8Array; // SHA-256 hash of code + salt
  code_salt: Uint8Array; // 16-byte random salt
  correlation_id: string; // UUID
  expires_at: string; // ISO timestamp
  created_at: string; // ISO timestamp
}

/**
 * Verification code with plaintext (temporary, for email sending)
 */
export interface VerificationCodeWithPlaintext {
  code: string; // 8-character alphanumeric
  hash: Uint8Array; // SHA-256 of code + salt
  salt: Uint8Array; // 16-byte random salt
  expiresAt: Date; // Expiry timestamp
}

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Rate limit check result from Postgres function
 */
export interface RateLimitResult {
  allowed: boolean;
  current_count: number;
  retry_after: number; // Seconds until next allowed request
}

/**
 * Rate limit tier configuration
 */
export interface RateLimitTier {
  key: string; // e.g., "global", "ip:<hash>", "email:<hash>"
  limit: number; // Max requests
  windowSeconds: number; // Time window in seconds
}

// ============================================================================
// ORPHAN VERIFICATION
// ============================================================================

/**
 * Orphan status check result
 */
export interface OrphanStatusResult {
  isOrphaned: boolean;
  hasCompanyData: boolean;
  hasAdminData: boolean;
  userId: string;
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Cleanup log entry structure
 */
export interface CleanupLogEntry {
  email_hash: string; // SHA-256 of email
  ip_hash: string | null; // SHA-256 of IP
  correlation_id: string; // UUID
  status: "pending" | "completed" | "failed";
  error_code: string | null;
  error_message: string | null;
  created_at?: string; // ISO timestamp (set by DB)
  updated_at?: string; // ISO timestamp (set by DB)
}

// ============================================================================
// DISTRIBUTED LOCKING
// ============================================================================

/**
 * Advisory lock acquisition result
 */
export interface LockAcquisitionResult {
  acquired: boolean;
  lockId: bigint; // PostgreSQL advisory lock ID
}

// ============================================================================
// EMAIL SENDING
// ============================================================================

/**
 * Email provider configuration
 */
export interface EmailProvider {
  name: "resend" | "sendgrid";
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

/**
 * Email send result
 */
export interface EmailSendResult {
  success: boolean;
  provider: "resend" | "sendgrid";
  messageId?: string;
  error?: string;
  attemptCount: number;
}

// ============================================================================
// CONSTANT-TIME RESPONSE
// ============================================================================

/**
 * Constant-time response metrics
 */
export interface ConstantTimeMetrics {
  startTime: number; // Date.now() at request start
  elapsed: number; // Milliseconds elapsed
  jitter: number; // Gaussian jitter applied (milliseconds)
  target: number; // Target response time (milliseconds)
  delay: number; // Artificial delay added (milliseconds)
  finalDuration: number; // Total response time (milliseconds)
}

// ============================================================================
// ERROR DEFINITIONS
// ============================================================================

/**
 * Error code definition
 */
export interface ErrorDefinition {
  code: string;
  message: string;
  httpStatus: number;
}

/**
 * All error codes
 */
export const ERROR_CODES = {
  ORPHAN_CLEANUP_001: {
    code: "ORPHAN_CLEANUP_001",
    message: "Your verification code has expired. Request a new code to continue.",
    httpStatus: 403,
  },
  ORPHAN_CLEANUP_002: {
    code: "ORPHAN_CLEANUP_002",
    message: "Invalid verification code. Please check and try again.",
    httpStatus: 403,
  },
  ORPHAN_CLEANUP_003: {
    code: "ORPHAN_CLEANUP_003",
    message: "Rate limit exceeded. Please wait before trying again.",
    httpStatus: 429,
  },
  ORPHAN_CLEANUP_004: {
    code: "ORPHAN_CLEANUP_004",
    message: "User not found in authentication system.",
    httpStatus: 404,
  },
  ORPHAN_CLEANUP_005: {
    code: "ORPHAN_CLEANUP_005",
    message: "User is not orphaned - account has company data and cannot be deleted.",
    httpStatus: 400,
  },
  ORPHAN_CLEANUP_006: {
    code: "ORPHAN_CLEANUP_006",
    message: "Database transaction failed. Please try again or contact support.",
    httpStatus: 500,
  },
  ORPHAN_CLEANUP_007: {
    code: "ORPHAN_CLEANUP_007",
    message: "Invalid request format. Please check your input.",
    httpStatus: 400,
  },
  ORPHAN_CLEANUP_008: {
    code: "ORPHAN_CLEANUP_008",
    message: "Failed to send verification email. Please try again or contact support.",
    httpStatus: 503,
  },
  ORPHAN_CLEANUP_009: {
    code: "ORPHAN_CLEANUP_009",
    message: "Cleanup operation already in progress for this email. Please wait.",
    httpStatus: 409,
  },
} as const;

// ============================================================================
// CORS CONFIGURATION
// ============================================================================

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json",
};
