/**
 * 8-Character Alphanumeric Verification Code Utilities
 *
 * Purpose: Secure generation, formatting, and validation of verification codes
 * for orphaned user cleanup operations.
 *
 * Security Features:
 * - CSPRNG-based generation (crypto.getRandomValues)
 * - 40-bit entropy (32^8 = 1.1 trillion combinations)
 * - Hash-based storage with unique salts
 * - Constant-time comparison for validation
 * - Ambiguous characters excluded (O, 0, I, 1, L)
 *
 * Requirements: Req#3 (Cleanup Edge Function), Req#8 (Security),
 *               NFR-10 (Hash storage), NFR-11 (Constant-time comparison)
 *
 * @module verificationCode
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Verification code alphabet (32 characters)
 * Excludes ambiguous characters: O, 0, I, 1, L
 * - No 'O' (letter) or '0' (zero) - confusable
 * - No 'I' (letter), '1' (one), or 'L' (letter) - confusable
 */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Code length (8 characters)
 * Provides 32^8 = 1,099,511,627,776 combinations (40-bit entropy)
 */
export const CODE_LENGTH = 8;

/**
 * Code expiry duration (5 minutes in milliseconds)
 * Reduced from 10 minutes per UserQA security recommendation
 */
export const CODE_EXPIRY_MS = 5 * 60 * 1000; // 300000ms

/**
 * Maximum validation attempts per code
 * Prevents brute force attacks even with high entropy
 */
export const MAX_VALIDATION_ATTEMPTS = 3;

/**
 * Salt length for code hashing (16 bytes / 128 bits)
 * Unique salt per code prevents rainbow table attacks
 */
export const SALT_LENGTH = 16;

// ============================================================================
// Code Generation
// ============================================================================

/**
 * Generates a secure 8-character alphanumeric verification code
 * using cryptographically secure random number generator (CSPRNG).
 *
 * Algorithm:
 * 1. Generate 8 random bytes using crypto.getRandomValues()
 * 2. Map each byte to alphabet character using modulo
 * 3. Return 8-character code
 *
 * Security Properties:
 * - CSPRNG ensures unpredictability
 * - Zero modulo bias (256 % 32 = 0, evenly divisible)
 * - Uniform distribution across all characters
 * - 40-bit entropy (1.1 trillion combinations)
 *
 * @returns {string} 8-character uppercase code (e.g., "ABCD5678")
 *
 * @example
 * const code = generateSecureCode();
 * console.log(code); // "F8KM3H7P"
 */
export function generateSecureCode(): string {
  // Generate 8 random bytes using CSPRNG
  const randomBytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(randomBytes);

  // Map each byte to alphabet character
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    // Modulo operation: 256 % 32 = 0 (no bias)
    const index = randomBytes[i] % CODE_ALPHABET.length;
    code += CODE_ALPHABET[index];
  }

  return code;
}

// ============================================================================
// Code Formatting
// ============================================================================

/**
 * Formats code for display with hyphen separator (XXXX-XXXX).
 * Improves readability in emails and UI.
 *
 * @param {string} code - 8-character code (raw format)
 * @returns {string} Formatted code with hyphen (e.g., "ABCD-5678")
 *
 * @example
 * formatCodeForDisplay('ABCD5678'); // Returns: "ABCD-5678"
 */
export function formatCodeForDisplay(code: string): string {
  if (code.length === CODE_LENGTH) {
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  }
  return code;
}

/**
 * Normalizes user input by removing hyphens/spaces and converting to uppercase.
 * Prepares input for validation and comparison.
 *
 * @param {string} input - Raw user input (may contain hyphens, spaces, lowercase)
 * @returns {string} Normalized code (uppercase, no separators)
 *
 * @example
 * normalizeCodeInput('abcd-5678'); // Returns: "ABCD5678"
 * normalizeCodeInput('ABCD 5678'); // Returns: "ABCD5678"
 * normalizeCodeInput('  abcd5678  '); // Returns: "ABCD5678"
 */
export function normalizeCodeInput(input: string): string {
  return input
    .replace(/[-\s]/g, '') // Remove hyphens and spaces
    .toUpperCase() // Convert to uppercase
    .trim(); // Remove leading/trailing whitespace
}

// ============================================================================
// Code Validation
// ============================================================================

/**
 * Validates code format (length and character set).
 * Does NOT verify code correctness (use hash comparison for that).
 *
 * @param {string} code - Code to validate (will be normalized first)
 * @returns {boolean} True if format is valid, false otherwise
 *
 * @example
 * validateCodeFormat('ABCD-5678'); // Returns: true
 * validateCodeFormat('ABCD5678'); // Returns: true
 * validateCodeFormat('ABCD567'); // Returns: false (too short)
 * validateCodeFormat('ABCD5678O'); // Returns: false (contains 'O')
 * validateCodeFormat('ABCD56781'); // Returns: false (contains '1')
 */
export function validateCodeFormat(code: string): boolean {
  const normalized = normalizeCodeInput(code);

  // Must be exactly 8 characters
  if (normalized.length !== CODE_LENGTH) {
    return false;
  }

  // Must contain only valid alphabet characters
  // Regex ensures no excluded chars: O, 0, I, 1, L
  const validPattern = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);
  return validPattern.test(normalized);
}

// ============================================================================
// Hash-Based Storage
// ============================================================================

/**
 * Generates random salt for code hashing.
 * Each code should have a unique salt to prevent rainbow table attacks.
 *
 * @returns {Uint8Array} 16-byte random salt
 *
 * @example
 * const salt = generateSalt();
 * console.log(salt.length); // 16
 */
export function generateSalt(): Uint8Array {
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * Hashes verification code with salt using SHA-256.
 * Never store codes in plaintext - always use this hashing function.
 *
 * @param {string} code - 8-character code to hash
 * @param {Uint8Array} salt - 16-byte salt (must be stored alongside hash)
 * @returns {Promise<Uint8Array>} 32-byte SHA-256 hash
 *
 * @example
 * const code = 'ABCD5678';
 * const salt = generateSalt();
 * const hash = await hashVerificationCode(code, salt);
 * // Store both hash and salt in database
 */
export async function hashVerificationCode(
  code: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const codeBytes = encoder.encode(code);

  // Combine code + salt
  const combined = new Uint8Array(codeBytes.length + salt.length);
  combined.set(codeBytes, 0);
  combined.set(salt, codeBytes.length);

  // Hash with SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  return new Uint8Array(hashBuffer);
}

/**
 * Constant-time comparison of two Uint8Arrays.
 * Prevents timing attacks that could reveal partial hash information.
 *
 * **Security Critical**: Must not short-circuit on first mismatch.
 * All bytes must be compared regardless of early mismatches.
 *
 * @param {Uint8Array} a - First array (e.g., computed hash)
 * @param {Uint8Array} b - Second array (e.g., stored hash)
 * @returns {boolean} True if arrays are equal, false otherwise
 *
 * @example
 * const hash1 = new Uint8Array([1, 2, 3]);
 * const hash2 = new Uint8Array([1, 2, 3]);
 * constantTimeEquals(hash1, hash2); // Returns: true
 */
export function constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
  // Length check (constant time, always performed)
  if (a.length !== b.length) {
    return false;
  }

  // Byte-by-byte comparison using XOR accumulator
  // Result is 0 if all bytes match, non-zero if any differ
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i]; // XOR: 0 if equal, non-zero if different
  }

  // Return true only if accumulator is 0 (all bytes matched)
  return result === 0;
}

/**
 * Validates submitted verification code against stored hash.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @param {string} submittedCode - Code entered by user
 * @param {Uint8Array} storedHash - Hash stored in database
 * @param {Uint8Array} storedSalt - Salt stored in database
 * @returns {Promise<boolean>} True if code matches, false otherwise
 *
 * @example
 * const userInput = 'ABCD-5678';
 * const isValid = await validateVerificationCode(
 *   userInput,
 *   storedHash,
 *   storedSalt
 * );
 * if (isValid) {
 *   // Code is correct, proceed with cleanup
 * }
 */
export async function validateVerificationCode(
  submittedCode: string,
  storedHash: Uint8Array,
  storedSalt: Uint8Array,
): Promise<boolean> {
  // Normalize input (remove hyphens, uppercase)
  const normalized = normalizeCodeInput(submittedCode);

  // Validate format first (fast fail for malformed input)
  if (!validateCodeFormat(normalized)) {
    return false;
  }

  // Hash submitted code with stored salt
  const submittedHash = await hashVerificationCode(normalized, storedSalt);

  // Constant-time comparison (prevents timing attacks)
  return constantTimeEquals(submittedHash, storedHash);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculates expiry timestamp for a new verification code.
 * Code expires 5 minutes after creation.
 *
 * @returns {Date} Expiry timestamp (NOW + 5 minutes)
 *
 * @example
 * const expiresAt = calculateExpiryTimestamp();
 * console.log(expiresAt); // Date object 5 minutes in future
 */
export function calculateExpiryTimestamp(): Date {
  return new Date(Date.now() + CODE_EXPIRY_MS);
}

/**
 * Checks if a code has expired based on expiry timestamp.
 *
 * @param {Date} expiresAt - Expiry timestamp from database
 * @returns {boolean} True if expired, false if still valid
 *
 * @example
 * const expired = isCodeExpired(codeRecord.expires_at);
 * if (expired) {
 *   throw new Error('ORPHAN_CLEANUP_001: Verification code expired');
 * }
 */
export function isCodeExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() < Date.now();
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Verification code record structure (matches database schema)
 */
export interface VerificationCodeRecord {
  id: string; // UUID
  email_hash: string; // SHA-256 hex (64 chars)
  code_hash: number[]; // SHA-256 bytes (32 bytes as array)
  code_salt: number[]; // Random salt (16 bytes as array)
  correlation_id: string; // UUID for tracing
  expires_at: string; // ISO timestamp
  created_at: string; // ISO timestamp
}

/**
 * Code generation result (for storage in database)
 */
export interface GeneratedCodeData {
  code: string; // Plaintext code (send to user via email)
  hash: Uint8Array; // Hash (store in database)
  salt: Uint8Array; // Salt (store in database)
  expiresAt: Date; // Expiry timestamp
}

/**
 * Generates code with all necessary data for storage.
 * Convenience function combining generation, hashing, and expiry calculation.
 *
 * @param {string} correlationId - UUID for request tracing
 * @returns {Promise<GeneratedCodeData>} Complete code data for storage
 *
 * @example
 * const codeData = await generateCodeForStorage(correlationId);
 *
 * // Send plaintext code via email
 * await sendEmail(userEmail, codeData.code);
 *
 * // Store hash + salt in database
 * await supabase.from('verification_codes').insert({
 *   email_hash: emailHash,
 *   code_hash: Array.from(codeData.hash),
 *   code_salt: Array.from(codeData.salt),
 *   expires_at: codeData.expiresAt.toISOString(),
 *   correlation_id: correlationId,
 * });
 */
export async function generateCodeForStorage(
  correlationId: string,
): Promise<GeneratedCodeData> {
  const code = generateSecureCode();
  const salt = generateSalt();
  const hash = await hashVerificationCode(code, salt);
  const expiresAt = calculateExpiryTimestamp();

  return {
    code,
    hash,
    salt,
    expiresAt,
  };
}
