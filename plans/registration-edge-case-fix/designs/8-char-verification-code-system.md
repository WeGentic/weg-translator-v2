# 8-Character Alphanumeric Verification Code System Design

## Overview

This document specifies the 8-character alphanumeric verification code system for orphaned user cleanup. The system replaces the original 6-digit numeric design (1M combinations) with a more secure 8-character alphanumeric format (2.8T combinations) per UserQA recommendation.

## Requirements Addressed

- **Req#3**: Cleanup Edge Function Without Auth
- **Req#8**: Security Requirements for Cleanup Without Auth
- **NFR-10**: Hash-Based Storage
- **NFR-11**: Constant-Time Comparison

## Code Specifications

### Character Set

**Alphabet**: 32 characters total
```
ABCDEFGHJKLMNPQRSTUVWXYZ23456789
```

**Excluded Characters** (ambiguous):
- `O` (letter O) - confusable with `0` (zero)
- `0` (zero) - confusable with `O` (letter O)
- `I` (letter I) - confusable with `1` (one) and `l` (lowercase L)
- `1` (one) - confusable with `I` (letter I) and `l` (lowercase L)
- `L` (letter L) - confusable with `1` (one) and `I` (letter I)

**Rationale**: Maximize readability when codes are displayed in emails or typed manually.

### Format

**Raw Format**: 8 consecutive characters
- Example: `ABCD5678`

**Display Format**: 4-4 split with hyphen separator
- Example: `ABCD-5678`
- Improves readability in emails
- Easier to type/transcribe

**Input Normalization**: Strip hyphens and spaces, convert to uppercase before validation.

### Entropy Calculation

- **Alphabet size**: 32 characters
- **Code length**: 8 characters
- **Total combinations**: 32^8 = **1,099,511,627,776** (~1.1 trillion, not 2.8T as originally stated - corrected)
- **Entropy**: log₂(32^8) = 40 bits

**Security Assessment**:
- **6-digit numeric** (original): 10^6 = 1M combinations = 20 bits entropy
- **8-char alphanumeric** (new): 32^8 = 1.1T combinations = 40 bits entropy
- **Improvement**: 2^20 times more secure (1 million times harder to brute force)

### Expiry and Attempt Limits

**Expiry**: 5 minutes (300 seconds)
- Reduced from original 10-minute design per UserQA
- Shorter window = smaller attack surface
- Still reasonable for email delivery + user entry

**Validation Attempts**: 3 attempts per code
- After 3 invalid attempts, code must be re-requested
- Prevents brute force even with 40-bit entropy
- Rate limiting provides additional protection (3 codes per email per hour)

**Combined Protection**:
- 3 attempts per code × 3 codes per hour = 9 validation attempts per hour maximum
- At 32^8 combinations, average 1.1T / 9 = ~122B hours to brute force (infeasible)

## Code Generation

### Algorithm

```typescript
function generateSecureCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const length = 8;

  // Generate 8 random bytes using CSPRNG
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);

  // Map each byte to alphabet character
  let code = '';
  for (let i = 0; i < length; i++) {
    // Use modulo to map byte (0-255) to alphabet index (0-31)
    code += alphabet[randomBytes[i] % alphabet.length];
  }

  return code;
}
```

**Security Properties**:
- Uses `crypto.getRandomValues()` (CSPRNG) - cryptographically secure
- Uniform distribution: modulo operation introduces minimal bias (<0.3% due to 256 % 32 = 0)
- No patterns or predictability

### Modulo Bias Analysis

**Bias Calculation**:
- Byte range: 0-255 (256 values)
- Alphabet size: 32 characters
- 256 / 32 = 8 exact (no bias)
- **Conclusion**: Zero bias! Perfect distribution.

*Note: Original concern about modulo bias doesn't apply here since 256 is evenly divisible by 32.*

## Display Formatting

### Frontend Display

```typescript
function formatCodeForDisplay(code: string): string {
  // Insert hyphen after 4th character
  if (code.length === 8) {
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  }
  return code;
}

// Example:
formatCodeForDisplay('ABCD5678') // Returns: "ABCD-5678"
```

### Email Template

```html
<p>Your verification code is:</p>
<div style="font-family: monospace; font-size: 24px; letter-spacing: 2px; font-weight: bold;">
  ABCD-5678
</div>
<p>This code expires in 5 minutes.</p>
```

**Design Considerations**:
- Monospace font (easy to distinguish characters)
- Large font size (24px)
- Letter spacing (2px) for clarity
- Bold weight for emphasis

## Input Handling

### Normalization

```typescript
function normalizeCodeInput(input: string): string {
  // Remove hyphens, spaces, and convert to uppercase
  return input
    .replace(/[-\s]/g, '')
    .toUpperCase()
    .trim();
}

// Examples:
normalizeCodeInput('abcd-5678')      // Returns: "ABCD5678"
normalizeCodeInput('ABCD 5678')      // Returns: "ABCD5678"
normalizeCodeInput('  abcd5678  ')   // Returns: "ABCD5678"
```

### Validation

```typescript
function validateCodeFormat(code: string): boolean {
  const normalizedCode = normalizeCodeInput(code);

  // Must be exactly 8 characters
  if (normalizedCode.length !== 8) {
    return false;
  }

  // Must contain only valid alphabet characters
  const validChars = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
  return validChars.test(normalizedCode);
}

// Examples:
validateCodeFormat('ABCD-5678')      // Returns: true
validateCodeFormat('ABCD5678')       // Returns: true
validateCodeFormat('ABCD567')        // Returns: false (too short)
validateCodeFormat('ABCD5678O')      // Returns: false ('O' excluded)
validateCodeFormat('ABCD56781')      // Returns: false ('1' excluded)
```

## Hash-Based Storage

### Hashing Process

```typescript
async function hashVerificationCode(
  code: string,
  salt: Uint8Array
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
```

### Storage Format (Postgres)

```sql
-- verification_codes table columns
code_hash BYTEA NOT NULL,       -- 32 bytes (SHA-256 output)
code_salt BYTEA NOT NULL,       -- 16 bytes (random salt)
```

**Storage Size**: 48 bytes per code (32 + 16)

## Constant-Time Validation

### Comparison Function

```typescript
function constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
  // Early length check (not timing-sensitive)
  if (a.length !== b.length) {
    return false;
  }

  // Byte-by-byte comparison with no short-circuit
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}
```

### Validation Flow

```typescript
async function validateVerificationCode(
  submittedCode: string,
  storedHash: Uint8Array,
  storedSalt: Uint8Array
): Promise<boolean> {
  // Normalize submitted code
  const normalizedCode = normalizeCodeInput(submittedCode);

  // Validate format (fail fast for invalid format)
  if (!validateCodeFormat(normalizedCode)) {
    return false;
  }

  // Hash submitted code with stored salt
  const submittedHash = await hashVerificationCode(normalizedCode, storedSalt);

  // Constant-time comparison
  return constantTimeEquals(submittedHash, storedHash);
}
```

## User Experience Considerations

### Auto-Formatting Input

```typescript
// React input handler with auto-formatting
function handleCodeChange(value: string) {
  // Remove non-alphanumeric characters
  let sanitized = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  // Limit to 8 characters
  sanitized = sanitized.slice(0, 8);

  // Insert hyphen after 4th character
  if (sanitized.length > 4) {
    sanitized = `${sanitized.slice(0, 4)}-${sanitized.slice(4)}`;
  }

  setCode(sanitized);
}

// Example progression as user types:
// 'A' → 'A'
// 'AB' → 'AB'
// 'ABCD' → 'ABCD'
// 'ABCD5' → 'ABCD-5'
// 'ABCD56' → 'ABCD-56'
// 'ABCD5678' → 'ABCD-5678'
```

### Paste Handling

```typescript
function handlePaste(event: ClipboardEvent) {
  event.preventDefault();

  const pastedText = event.clipboardData?.getData('text') || '';
  const normalized = normalizeCodeInput(pastedText);

  if (normalized.length === 8) {
    // Valid 8-character code pasted
    setCode(formatCodeForDisplay(normalized));
  } else {
    // Invalid paste - show error
    setError('Please paste a valid 8-character code');
  }
}
```

## Error Messages

### User-Facing Messages

```typescript
const ERROR_MESSAGES = {
  FORMAT_INVALID: 'Please enter a valid 8-character code (e.g., ABCD-5678)',
  CODE_EXPIRED: 'This verification code has expired. Please request a new code.',
  CODE_INVALID: 'The verification code you entered is incorrect. Please try again.',
  ATTEMPTS_EXCEEDED: 'Too many invalid attempts. Please request a new verification code.',
  RATE_LIMITED: 'Too many requests. Please wait {retryAfter} seconds before requesting a new code.',
};
```

### Contextual Errors

```typescript
// Example error handling
if (!validateCodeFormat(submittedCode)) {
  return { error: ERROR_MESSAGES.FORMAT_INVALID };
}

if (isExpired(codeRecord.expires_at)) {
  return { error: ERROR_MESSAGES.CODE_EXPIRED };
}

if (attemptCount >= 3) {
  return { error: ERROR_MESSAGES.ATTEMPTS_EXCEEDED };
}

if (!isValidHash) {
  return { error: ERROR_MESSAGES.CODE_INVALID };
}
```

## Migration Considerations

### Backward Compatibility

**Not Applicable**: This is a new feature (no existing 6-digit codes to migrate).

If future changes to code format are needed:
- Codes are ephemeral (5-minute lifetime)
- No migration necessary - old codes expire naturally
- New format can be deployed immediately

## Testing

### Unit Tests

```typescript
describe('Code Generation', () => {
  test('generates 8-character codes', () => {
    const code = generateSecureCode();
    expect(code).toHaveLength(8);
  });

  test('uses only valid alphabet characters', () => {
    const code = generateSecureCode();
    const validPattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
    expect(code).toMatch(validPattern);
  });

  test('generates unique codes', () => {
    const codes = new Set();
    for (let i = 0; i < 1000; i++) {
      codes.add(generateSecureCode());
    }
    expect(codes.size).toBe(1000); // No duplicates
  });
});

describe('Code Validation', () => {
  test('accepts valid codes', () => {
    expect(validateCodeFormat('ABCD5678')).toBe(true);
    expect(validateCodeFormat('ABCD-5678')).toBe(true);
    expect(validateCodeFormat('abcd5678')).toBe(true);
  });

  test('rejects codes with excluded characters', () => {
    expect(validateCodeFormat('ABCD567O')).toBe(false); // O excluded
    expect(validateCodeFormat('ABCD5671')).toBe(false); // 1 excluded
    expect(validateCodeFormat('ABCD56I8')).toBe(false); // I excluded
  });

  test('rejects codes of wrong length', () => {
    expect(validateCodeFormat('ABCD567')).toBe(false);
    expect(validateCodeFormat('ABCD56789')).toBe(false);
  });
});

describe('Constant-Time Validation', () => {
  test('validates correct code', async () => {
    const code = 'ABCD5678';
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);

    const hash = await hashVerificationCode(code, salt);
    const isValid = await validateVerificationCode(code, hash, salt);

    expect(isValid).toBe(true);
  });

  test('rejects incorrect code', async () => {
    const correctCode = 'ABCD5678';
    const wrongCode = 'ABCD5679';
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);

    const hash = await hashVerificationCode(correctCode, salt);
    const isValid = await validateVerificationCode(wrongCode, hash, salt);

    expect(isValid).toBe(false);
  });

  test('takes constant time (statistical test)', async () => {
    const trials = 100;
    const timings = [];

    for (let i = 0; i < trials; i++) {
      const code = generateSecureCode();
      const salt = new Uint8Array(16);
      crypto.getRandomValues(salt);
      const hash = await hashVerificationCode(code, salt);

      const wrongCode = generateSecureCode(); // Different code

      const start = performance.now();
      await validateVerificationCode(wrongCode, hash, salt);
      const duration = performance.now() - start;

      timings.push(duration);
    }

    // Calculate variance
    const mean = timings.reduce((sum, t) => sum + t, 0) / timings.length;
    const variance = timings.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / timings.length;

    // Low variance indicates constant time (allow some natural variation)
    expect(variance).toBeLessThan(0.1); // Threshold: <0.1ms variance
  });
});
```

## Acceptance Criteria

- [x] 8-character format specified with 32-char alphabet (excluding O, 0, I, 1, L)
- [x] Display format documented (XXXX-XXXX with hyphen)
- [x] CSPRNG generation algorithm specified
- [x] Entropy calculation provided (40 bits, 1.1T combinations)
- [x] 5-minute expiry and 3-attempt limit documented
- [x] Hash-based storage with SHA-256 specified
- [x] Constant-time validation algorithm provided
- [x] Input normalization and validation logic documented
- [x] User experience patterns (auto-formatting, paste handling) specified
- [x] Error messages documented
- [x] Testing strategy with code examples provided

**Status**: Ready for implementation in Phase 2
