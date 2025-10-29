/**
 * cleanup-orphaned-user Edge Function
 *
 * Purpose: Securely delete orphaned Supabase Auth users after verifying email ownership
 *          through time-limited verification codes stored in Postgres.
 *
 * Security: Unauthenticated endpoint with:
 *   - Multi-tier Postgres-based rate limiting
 *   - 8-character alphanumeric verification codes (1.1T combinations)
 *   - Hash-based code storage with SHA-256 + salt
 *   - Constant-time validation with Gaussian jitter
 *   - PostgreSQL advisory locks for distributed coordination
 *   - Comprehensive audit logging
 *
 * Flow:
 *   Step 1 (request-code): Generate code, store in Postgres, send via email
 *   Step 2 (validate-and-cleanup): Validate code, verify orphan state, delete user
 *
 * Requirements: Req#3 (Cleanup Edge Function), Req#8 (Security), NFR-5/6/7/10/11
 *
 * Author: Claude Code (registration-edge-case-fix Phase 2)
 * Date: 2025-10-28
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";

// Import types and utilities
import {
  cleanupRequestSchema,
  CORS_HEADERS,
  ERROR_CODES,
  type CleanupRequest,
  type CleanupLogEntry,
  type ErrorDefinition,
  type ErrorResponse,
  type OrphanStatusResult,
  type RateLimitResult,
  type RequestCodePayload,
  type SuccessResponse,
  type ValidateCleanupPayload,
  type VerificationCodeRecord,
} from "./types.ts";

import {
  applyConstantTimeResponse,
  createJSONResponse,
  extractClientIP,
  extractCorrelationId,
  formatCodeForDisplay,
  generateCorrelationId,
  generateSecureCode,
  hashEmail,
  hashIP,
  hashVerificationCode,
  normalizeCodeInput,
  sleep,
  validateVerificationCode,
} from "./utils.ts";

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Retrieve Supabase service role key from Vault or environment
 *
 * Priority:
 * 1. Vault (production) - SUPABASE_SERVICE_ROLE_KEY
 * 2. Environment variable (development fallback)
 *
 * @returns Service role key or null if unavailable
 */
function getServiceRoleKey(): string | null {
  const isProduction = Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined;

  // Try Vault first (available as environment variable in production)
  let serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Fallback to development environment variable
  if (!serviceRoleKey && !isProduction) {
    console.warn(
      "[cleanup-orphaned-user] Service role key not found in Vault, using development fallback",
    );
    serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY_DEV");
  }

  if (!serviceRoleKey) {
    console.error(
      "[cleanup-orphaned-user] Service role key not available. " +
        "Ensure SUPABASE_SERVICE_ROLE_KEY is configured in Vault (production) " +
        "or SUPABASE_SERVICE_ROLE_KEY_DEV is set (development)",
    );
  } else {
    console.log(
      "[cleanup-orphaned-user] Service role key loaded from:",
      isProduction ? "Vault" : "Environment Variable (dev)",
    );
  }

  return serviceRoleKey;
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = getServiceRoleKey();

if (!supabaseUrl) {
  console.error("[cleanup-orphaned-user] Missing SUPABASE_URL environment variable");
}

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })
  : null;

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Check rate limit using Postgres function
 *
 * Tiers:
 * - Global: 1000 requests / 60 seconds
 * - Per-IP: 5 requests / 60 seconds
 * - Per-Email: 3 requests / 3600 seconds (1 hour)
 *
 * @param key - Rate limit key (e.g., "global", "ip:<hash>", "email:<hash>")
 * @param limit - Max requests allowed
 * @param windowSeconds - Time window in seconds
 * @returns Rate limit result with allowed flag and retry_after
 */
async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }

  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error("[checkRateLimit] Error calling Postgres function:", error);
    throw error;
  }

  // Postgres function returns single row with (allowed, current_count, retry_after)
  return data[0] as RateLimitResult;
}

/**
 * Enforce multi-tier rate limiting
 *
 * @param email - User email address
 * @param clientIP - Client IP address
 * @returns True if allowed, throws ErrorResponse if rate limited
 */
async function enforceRateLimits(
  email: string,
  clientIP: string,
): Promise<void> {
  const emailHash = await hashEmail(email);
  const ipHash = clientIP !== "unknown" ? await hashIP(clientIP) : "unknown";

  // Tier 1: Global rate limit (1000 req/60s)
  const globalResult = await checkRateLimit("global", 1000, 60);
  if (!globalResult.allowed) {
    throw {
      error: {
        ...ERROR_CODES.ORPHAN_CLEANUP_003,
        retryAfter: globalResult.retry_after,
      },
    } as ErrorResponse;
  }

  // Tier 2: Per-IP rate limit (5 req/60s)
  if (ipHash !== "unknown") {
    const ipResult = await checkRateLimit(`ip:${ipHash}`, 5, 60);
    if (!ipResult.allowed) {
      throw {
        error: {
          ...ERROR_CODES.ORPHAN_CLEANUP_003,
          retryAfter: ipResult.retry_after,
        },
      } as ErrorResponse;
    }
  }

  // Tier 3: Per-Email rate limit (3 req/3600s = 1 hour)
  const emailResult = await checkRateLimit(`email:${emailHash}`, 3, 3600);
  if (!emailResult.allowed) {
    throw {
      error: {
        ...ERROR_CODES.ORPHAN_CLEANUP_003,
        retryAfter: emailResult.retry_after,
      },
    } as ErrorResponse;
  }
}

// ============================================================================
// DISTRIBUTED LOCKING
// ============================================================================

/**
 * Acquire distributed advisory lock for email
 *
 * @param email - Email address to lock
 * @returns True if lock acquired
 */
async function acquireLock(email: string): Promise<boolean> {
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }

  const { data, error } = await supabase.rpc("acquire_cleanup_lock", {
    p_email: email.toLowerCase().trim(),
  });

  if (error) {
    console.error("[acquireLock] Error:", error);
    throw error;
  }

  return data as boolean;
}

/**
 * Release distributed advisory lock for email
 *
 * @param email - Email address to unlock
 * @returns True if lock released
 */
async function releaseLock(email: string): Promise<boolean> {
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }

  const { data, error } = await supabase.rpc("release_cleanup_lock", {
    p_email: email.toLowerCase().trim(),
  });

  if (error) {
    console.error("[releaseLock] Error:", error);
    // Don't throw - lock release is best-effort in finally blocks
    return false;
  }

  return data as boolean;
}

// ============================================================================
// ORPHAN VERIFICATION
// ============================================================================

/**
 * Verify user exists and is orphaned (no company/admin data)
 *
 * @param email - User email address
 * @returns Orphan status result
 */
async function verifyOrphanStatus(email: string): Promise<OrphanStatusResult> {
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }

  // Find user by email
  const { data: { users }, error: userError } = await supabase.auth.admin
    .listUsers();

  if (userError) {
    console.error("[verifyOrphanStatus] Error fetching users:", userError);
    throw userError;
  }

  const emailLower = email.toLowerCase().trim();
  const user = users.find((u) => u.email?.toLowerCase() === emailLower);

  if (!user) {
    throw {
      error: ERROR_CODES.ORPHAN_CLEANUP_004,
    } as ErrorResponse;
  }

  // Check for company and admin data
  const [companiesResult, adminsResult] = await Promise.all([
    supabase
      .from("companies")
      .select("id")
      .eq("owner_admin_uuid", user.id)
      .limit(1),
    supabase
      .from("company_admins")
      .select("id")
      .eq("admin_uuid", user.id)
      .limit(1),
  ]);

  const hasCompanyData = (companiesResult.data?.length ?? 0) > 0;
  const hasAdminData = (adminsResult.data?.length ?? 0) > 0;
  const isOrphaned = !hasCompanyData && !hasAdminData;

  if (!isOrphaned) {
    throw {
      error: ERROR_CODES.ORPHAN_CLEANUP_005,
    } as ErrorResponse;
  }

  return {
    isOrphaned,
    hasCompanyData,
    hasAdminData,
    userId: user.id,
  };
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Log cleanup operation to auth_cleanup_log table
 *
 * @param entry - Log entry data
 */
async function logCleanupOperation(entry: CleanupLogEntry): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from("auth_cleanup_log").insert(entry);

  if (error) {
    console.error("[logCleanupOperation] Error:", error);
    // Don't throw - logging is best-effort
  }
}

/**
 * Update cleanup log status
 *
 * @param correlationId - Correlation ID to update
 * @param status - New status
 * @param errorCode - Optional error code
 * @param errorMessage - Optional error message
 */
async function updateCleanupLog(
  correlationId: string,
  status: "completed" | "failed",
  errorCode?: string,
  errorMessage?: string,
): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from("auth_cleanup_log")
    .update({
      status,
      error_code: errorCode || null,
      error_message: errorMessage || null,
      updated_at: new Date().toISOString(),
    })
    .eq("correlation_id", correlationId);

  if (error) {
    console.error("[updateCleanupLog] Error:", error);
  }
}

// ============================================================================
// EMAIL SENDING (PLACEHOLDER - To be implemented with Resend/SendGrid)
// ============================================================================

/**
 * Send verification email with code
 *
 * TODO: Implement with Resend/SendGrid integration
 * - Primary: Resend API
 * - Fallback: SendGrid API
 * - Retry: 3 attempts with delays [0, 1000, 2000]ms
 *
 * @param email - Recipient email
 * @param code - Verification code (formatted XXXX-XXXX)
 * @param correlationId - Correlation ID for tracking
 */
async function sendVerificationEmail(
  email: string,
  code: string,
  correlationId: string,
): Promise<void> {
  // Format code for display
  const formattedCode = formatCodeForDisplay(code);

  console.log("[sendVerificationEmail] PLACEHOLDER:", {
    email,
    code: formattedCode,
    correlationId,
    message: "Email sending not yet implemented. Integrate Resend/SendGrid.",
  });

  // TODO: Implement actual email sending
  // - Try Resend API first
  // - Fall back to SendGrid if Resend fails
  // - Retry 3 times with exponential backoff
  // - Throw ERROR_CODES.ORPHAN_CLEANUP_008 if all attempts fail

  // Simulated delay
  await sleep(100);
}

// ============================================================================
// STEP 1: REQUEST-CODE
// ============================================================================

/**
 * Handle Step 1: Generate verification code and send via email
 *
 * Flow:
 * 1. Verify user exists and is orphaned
 * 2. Acquire distributed lock
 * 3. Check for existing valid code (reuse if found)
 * 4. Generate new code, hash, and store in Postgres
 * 5. Send code via email (Resend → SendGrid fallback)
 * 6. Log operation
 * 7. Release lock
 *
 * @param payload - Request payload
 * @param correlationId - Correlation ID
 * @param clientIP - Client IP address
 * @returns Success response
 */
async function handleRequestCode(
  payload: RequestCodePayload,
  correlationId: string,
  clientIP: string,
): Promise<SuccessResponse> {
  const { email } = payload;
  const emailLower = email.toLowerCase().trim();
  const emailHash = await hashEmail(emailLower);
  const ipHash = clientIP !== "unknown" ? await hashIP(clientIP) : null;

  // Verify user is orphaned
  const orphanStatus = await verifyOrphanStatus(emailLower);

  // Acquire distributed lock
  const lockAcquired = await acquireLock(emailLower);
  if (!lockAcquired) {
    throw {
      error: ERROR_CODES.ORPHAN_CLEANUP_009,
    } as ErrorResponse;
  }

  try {
    // Check for existing valid code
    const { data: existingCodes } = await supabase!
      .from("verification_codes")
      .select("*")
      .eq("email_hash", emailHash)
      .gt("expires_at", new Date().toISOString())
      .limit(1);

    if (existingCodes && existingCodes.length > 0) {
      const existing = existingCodes[0] as VerificationCodeRecord;
      console.log("[handleRequestCode] Reusing existing valid code");

      return {
        data: {
          message:
            "A verification code was already sent to your email. Please check your inbox.",
          correlationId: existing.correlation_id,
          expiresAt: existing.expires_at,
        },
      };
    }

    // Generate new code
    const code = generateSecureCode();
    const { hash: codeHash, salt: codeSalt } = await hashVerificationCode(
      code,
    );

    // Calculate expiry (5 minutes from now)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Store in Postgres (upsert to handle rare race conditions)
    const { error: insertError } = await supabase!
      .from("verification_codes")
      .upsert({
        email_hash: emailHash,
        code_hash: codeHash,
        code_salt: codeSalt,
        correlation_id: correlationId,
        expires_at: expiresAt.toISOString(),
      }, {
        onConflict: "email_hash",
      });

    if (insertError) {
      console.error("[handleRequestCode] Error storing code:", insertError);
      throw {
        error: ERROR_CODES.ORPHAN_CLEANUP_006,
      } as ErrorResponse;
    }

    // Send verification email
    await sendVerificationEmail(emailLower, code, correlationId);

    // Log operation
    await logCleanupOperation({
      email_hash: emailHash,
      ip_hash: ipHash,
      correlation_id: correlationId,
      status: "pending",
      error_code: null,
      error_message: null,
    });

    console.log("[handleRequestCode] Success:", {
      email: emailLower,
      correlationId,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      data: {
        message: "Verification code sent to your email. Check your inbox.",
        correlationId,
        expiresAt: expiresAt.toISOString(),
      },
    };
  } finally {
    // Always release lock
    await releaseLock(emailLower);
  }
}

// ============================================================================
// STEP 2: VALIDATE-AND-CLEANUP
// ============================================================================

/**
 * Handle Step 2: Validate code and delete orphaned user
 *
 * Flow:
 * 1. Acquire distributed lock
 * 2. Retrieve verification code from Postgres
 * 3. Validate submitted code (constant-time comparison)
 * 4. Re-verify orphan status (prevent TOCTOU)
 * 5. Delete user via admin API
 * 6. Delete verification code
 * 7. Update log
 * 8. Release lock
 *
 * @param payload - Request payload
 * @param correlationId - Correlation ID
 * @param clientIP - Client IP address
 * @returns Success response
 */
async function handleValidateAndCleanup(
  payload: ValidateCleanupPayload,
  correlationId: string,
  clientIP: string,
): Promise<SuccessResponse> {
  const { email, verificationCode } = payload;
  const emailLower = email.toLowerCase().trim();
  const emailHash = await hashEmail(emailLower);

  // Acquire distributed lock
  const lockAcquired = await acquireLock(emailLower);
  if (!lockAcquired) {
    throw {
      error: ERROR_CODES.ORPHAN_CLEANUP_009,
    } as ErrorResponse;
  }

  try {
    // Retrieve verification code from Postgres
    const { data: codes, error: fetchError } = await supabase!
      .from("verification_codes")
      .select("*")
      .eq("email_hash", emailHash)
      .gt("expires_at", new Date().toISOString())
      .limit(1);

    if (fetchError || !codes || codes.length === 0) {
      console.error("[handleValidateAndCleanup] Code not found or expired");
      throw {
        error: ERROR_CODES.ORPHAN_CLEANUP_001,
      } as ErrorResponse;
    }

    const storedCode = codes[0] as VerificationCodeRecord;

    // Validate code (constant-time comparison)
    const isValid = await validateVerificationCode(
      normalizeCodeInput(verificationCode),
      new Uint8Array(storedCode.code_hash),
      new Uint8Array(storedCode.code_salt),
    );

    if (!isValid) {
      console.error("[handleValidateAndCleanup] Invalid verification code");
      throw {
        error: ERROR_CODES.ORPHAN_CLEANUP_002,
      } as ErrorResponse;
    }

    // Re-verify orphan status (TOCTOU protection)
    const orphanStatus = await verifyOrphanStatus(emailLower);

    // Delete user via admin API
    const { error: deleteError } = await supabase!.auth.admin.deleteUser(
      orphanStatus.userId,
    );

    if (deleteError) {
      console.error(
        "[handleValidateAndCleanup] Error deleting user:",
        deleteError,
      );
      throw {
        error: ERROR_CODES.ORPHAN_CLEANUP_006,
      } as ErrorResponse;
    }

    // Delete verification code
    await supabase!
      .from("verification_codes")
      .delete()
      .eq("email_hash", emailHash);

    // Update log
    await updateCleanupLog(
      storedCode.correlation_id,
      "completed",
    );

    console.log("[handleValidateAndCleanup] Success:", {
      email: emailLower,
      userId: orphanStatus.userId,
      correlationId: storedCode.correlation_id,
    });

    return {
      data: {
        message:
          "Your account has been successfully deleted. You can now register with a new organization.",
        correlationId: storedCode.correlation_id,
      },
    };
  } finally {
    // Always release lock
    await releaseLock(emailLower);
  }
}

// ============================================================================
// MAIN REQUEST HANDLER
// ============================================================================

/**
 * Main request handler with constant-time response
 */
serve(async (req: Request) => {
  const requestStartTime = Date.now();

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Only allow POST
  if (req.method !== "POST") {
    const response = createJSONResponse(
      { error: { code: "METHOD_NOT_ALLOWED", message: "Only POST is allowed" } },
      405,
    );
    return await applyConstantTimeResponse(requestStartTime, response);
  }

  // Extract correlation ID from header or generate new one
  const correlationId = extractCorrelationId(req.headers) ||
    generateCorrelationId();

  // Extract client IP
  const clientIP = extractClientIP(req);

  try {
    // Check if Supabase client initialized
    if (!supabase) {
      throw {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Service is temporarily unavailable",
        },
      } as ErrorResponse;
    }

    // Parse and validate request body
    const body = await req.json();
    const parseResult = cleanupRequestSchema.safeParse(body);

    if (!parseResult.success) {
      throw {
        error: {
          ...ERROR_CODES.ORPHAN_CLEANUP_007,
          correlationId,
        },
      } as ErrorResponse;
    }

    const payload: CleanupRequest = parseResult.data;

    // Enforce rate limiting
    await enforceRateLimits(payload.email, clientIP);

    // Route to appropriate handler
    let result: SuccessResponse;

    if (payload.step === "request-code") {
      result = await handleRequestCode(payload, correlationId, clientIP);
    } else {
      result = await handleValidateAndCleanup(payload, correlationId, clientIP);
    }

    const response = createJSONResponse(result, 200);
    return await applyConstantTimeResponse(requestStartTime, response);
  } catch (error) {
    // Handle known error responses
    if (typeof error === "object" && error !== null && "error" in error) {
      const errorResponse = error as ErrorResponse;
      const errorDef = errorResponse.error;

      // Determine HTTP status
      let httpStatus = 500;
      const errorCode = errorDef.code;

      // Find matching error definition
      for (const [_, def] of Object.entries(ERROR_CODES)) {
        if ((def as ErrorDefinition).code === errorCode) {
          httpStatus = (def as ErrorDefinition).httpStatus;
          break;
        }
      }

      // Add Retry-After header if rate limited
      const additionalHeaders: Record<string, string> = {};
      if (errorCode === "ORPHAN_CLEANUP_003" && errorDef.retryAfter) {
        additionalHeaders["Retry-After"] = String(errorDef.retryAfter);
      }

      const response = createJSONResponse(
        { error: { ...errorDef, correlationId } },
        httpStatus,
        additionalHeaders,
      );

      return await applyConstantTimeResponse(requestStartTime, response);
    }

    // Handle unexpected errors
    console.error("[cleanup-orphaned-user] Unexpected error:", error);

    const response = createJSONResponse(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred. Please try again later.",
          correlationId,
        },
      },
      500,
    );

    return await applyConstantTimeResponse(requestStartTime, response);
  }
});

console.log("[cleanup-orphaned-user] Edge function initialized successfully");
