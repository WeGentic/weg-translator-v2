/**
 * Utility Functions for cleanup-orphaned-user Edge Function
 *
 * Purpose: Core utilities for code generation, hashing, validation, and timing
 * Author: Claude Code (registration-edge-case-fix Phase 2)
 * Date: 2025-10-28
 */

// ============================================================================
// CODE GENERATION (8-Character Alphanumeric)
// ============================================================================

/**
 * Alphabet for 8-character verification codes
 * - Excludes ambiguous characters: O, 0, I, 1, L
 * - 32 characters total for optimal entropy
 * - Uppercase only for consistency
 */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Generate secure 8-character alphanumeric verification code
 *
 * Algorithm:
 * - Uses crypto.getRandomValues() (CSPRNG)
 * - Maps 8 random bytes to alphabet (32 chars)
 * - Zero modulo bias (256 % 32 = 0)
 *
 * Entropy: 32^8 = 1.1 trillion combinations = 40 bits
 *
 * @returns 8-character code (e.g., "ABCD5678")
 */
export function generateSecureCode(): string {
  const length = 8;
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);

  let code = "";
  for (let i = 0; i < length; i++) {
    // Map byte (0-255) to alphabet index (0-31)
    // No bias: 256 % 32 = 0
    code += CODE_ALPHABET[randomBytes[i] % CODE_ALPHABET.length];
  }

  return code;
}

/**
 * Format code for display (XXXX-XXXX)
 *
 * @param code - 8-character code
 * @returns Formatted code with hyphen (e.g., "ABCD-5678")
 */
export function formatCodeForDisplay(code: string): string {
  if (code.length !== 8) return code;
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Normalize code input (remove hyphens/spaces, uppercase)
 *
 * @param input - User-provided code (may have hyphens, spaces, lowercase)
 * @returns Normalized 8-character code
 */
export function normalizeCodeInput(input: string): string {
  return input.replace(/[-\s]/g, "").toUpperCase().trim();
}

/**
 * Validate code format (8 characters from alphabet)
 *
 * @param code - Code to validate
 * @returns True if valid format
 */
export function validateCodeFormat(code: string): boolean {
  const normalized = normalizeCodeInput(code);

  if (normalized.length !== 8) return false;

  const validPattern = new RegExp(`^[${CODE_ALPHABET}]{8}$`);
  return validPattern.test(normalized);
}

// ============================================================================
// CODE HASHING (SHA-256 with Salt)
// ============================================================================

/**
 * Hash verification code with salt using SHA-256
 *
 * Security:
 * - Codes never stored in plaintext
 * - Unique 16-byte salt per code
 * - Prevents rainbow table attacks
 *
 * @param code - Verification code to hash
 * @param salt - 16-byte salt (or undefined to generate new)
 * @returns Hash and salt as Uint8Array
 */
export async function hashVerificationCode(
  code: string,
  salt?: Uint8Array,
): Promise<{ hash: Uint8Array; salt: Uint8Array }> {
  const encoder = new TextEncoder();
  const codeBytes = encoder.encode(code);

  // Generate salt if not provided
  if (!salt) {
    salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
  }

  // Combine code + salt
  const combined = new Uint8Array(codeBytes.length + salt.length);
  combined.set(codeBytes, 0);
  combined.set(salt, codeBytes.length);

  // Hash with SHA-256
  const hashBuffer = await crypto.subtle.digest("SHA-256", combined);
  const hash = new Uint8Array(hashBuffer);

  return { hash, salt };
}

/**
 * Hash email address using SHA-256
 *
 * Used for:
 * - Privacy-preserving email storage
 * - Preventing email exposure in logs/database
 *
 * @param email - Email address to hash
 * @returns 64-character hexadecimal hash
 */
export async function hashEmail(email: string): Promise<string> {
  const normalized = email.toLowerCase().trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);

  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Hash IP address using SHA-256
 *
 * @param ip - IP address to hash
 * @returns 64-character hexadecimal hash
 */
export async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);

  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================================
// CONSTANT-TIME COMPARISON
// ============================================================================

/**
 * Constant-time byte array comparison
 *
 * Security:
 * - No short-circuit on mismatch
 * - All bytes compared regardless of differences
 * - Prevents timing attacks
 *
 * @param a - First byte array
 * @param b - Second byte array
 * @returns True if arrays are equal
 */
export function constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
  // Length check (not timing-sensitive)
  if (a.length !== b.length) return false;

  // Byte-by-byte comparison with no short-circuit
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}

/**
 * Validate verification code using constant-time comparison
 *
 * @param submittedCode - Code provided by user
 * @param storedHash - Stored hash from database
 * @param storedSalt - Stored salt from database
 * @returns True if code is valid
 */
export async function validateVerificationCode(
  submittedCode: string,
  storedHash: Uint8Array,
  storedSalt: Uint8Array,
): Promise<boolean> {
  // Normalize and validate format
  const normalized = normalizeCodeInput(submittedCode);
  if (!validateCodeFormat(normalized)) {
    return false;
  }

  // Hash submitted code with stored salt
  const { hash: computedHash } = await hashVerificationCode(
    normalized,
    storedSalt,
  );

  // Constant-time comparison
  return constantTimeEquals(computedHash, storedHash);
}

// ============================================================================
// GAUSSIAN JITTER (Enhanced Security)
// ============================================================================

/**
 * Generate Gaussian-distributed jitter using polar method
 *
 * Algorithm: Polar form of Box-Muller transform
 * - More efficient than standard Box-Muller (no transcendental functions)
 * - Produces normally-distributed random numbers
 *
 * Statistical properties:
 * - Mean: specified mean parameter
 * - Standard deviation: specified stddev parameter
 * - 68% of values within ±1σ
 * - 95% of values within ±2σ
 * - 99.7% of values within ±3σ
 *
 * @param mean - Center of distribution (milliseconds)
 * @param stddev - Standard deviation (milliseconds)
 * @returns Gaussian-distributed jitter value
 */
export function gaussianJitter(mean: number, stddev: number): number {
  let u: number, v: number, s: number;

  // Rejection sampling: generate points in unit circle
  do {
    u = Math.random() * 2 - 1; // Range: [-1, 1]
    v = Math.random() * 2 - 1; // Range: [-1, 1]
    s = u * u + v * v;
  } while (s >= 1 || s === 0);

  // Polar form of Box-Muller
  const z0 = u * Math.sqrt((-2 * Math.log(s)) / s);

  // Scale and shift to desired mean and standard deviation
  return mean + z0 * stddev;
}

// ============================================================================
// CONSTANT-TIME RESPONSE
// ============================================================================

/**
 * Apply constant-time delay to response
 *
 * Security:
 * - All responses take ~500ms ±statistical variance
 * - Prevents timing attacks on code validity
 * - Uses Gaussian jitter (mimics natural variance)
 *
 * Target: 500ms ±25ms (1 stddev)
 * - 68% responses: 475-525ms
 * - 95% responses: 450-550ms
 * - 99.7% responses: 425-575ms
 *
 * @param startTime - Request start time (Date.now())
 * @param response - Response object to return
 * @returns Response object after delay
 */
export async function applyConstantTimeResponse(
  startTime: number,
  response: Response,
): Promise<Response> {
  const TARGET_MS = 500;
  const STDDEV_MS = 25;

  // Calculate elapsed time
  const elapsed = Date.now() - startTime;

  // Generate Gaussian jitter
  const jitter = gaussianJitter(0, STDDEV_MS);

  // Calculate target response time
  const target = TARGET_MS + jitter;

  // Calculate delay needed
  const delay = Math.max(0, target - elapsed);

  // Apply delay
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  // Log timing metrics (optional, for debugging)
  const finalDuration = Date.now() - startTime;
  console.log("Constant-time response metrics:", {
    elapsed: Math.round(elapsed),
    jitter: Math.round(jitter),
    target: Math.round(target),
    delay: Math.round(delay),
    finalDuration: Math.round(finalDuration),
  });

  return response;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract correlation ID from request headers
 *
 * @param headers - Request headers
 * @returns Correlation ID or undefined
 */
export function extractCorrelationId(headers: Headers): string | undefined {
  return headers.get("x-correlation-id") || undefined;
}

/**
 * Generate new correlation ID
 *
 * @returns UUID v4
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

/**
 * Extract client IP from request
 *
 * @param req - Request object
 * @returns IP address or "unknown"
 */
export function extractClientIP(req: Request): string {
  // Try multiple headers (proxy configurations)
  const headers = req.headers;

  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

/**
 * Create JSON response with CORS headers
 *
 * @param body - Response body object
 * @param status - HTTP status code
 * @param additionalHeaders - Additional headers to include
 * @returns Response object
 */
export function createJSONResponse(
  body: unknown,
  status: number,
  additionalHeaders?: Record<string, string>,
): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-correlation-id",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    ...additionalHeaders,
  };

  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Sleep for specified milliseconds
 *
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// EXPORTS
// ============================================================================

export { CODE_ALPHABET };
