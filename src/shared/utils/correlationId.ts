/**
 * Correlation ID Utilities
 *
 * This module provides utilities for generating and managing correlation IDs
 * for end-to-end request tracing throughout the Tr-entic Desktop application.
 *
 * Correlation IDs are UUID v4 strings that:
 * - Track requests from frontend → edge functions → database operations
 * - Enable debugging by linking related log entries
 * - Support troubleshooting of orphan detection and cleanup flows
 *
 * **Usage**:
 * ```typescript
 * // Generate a new correlation ID
 * const correlationId = generateCorrelationId();
 *
 * // Add to request headers
 * const headers = { 'Content-Type': 'application/json' };
 * addCorrelationIdHeader(headers, correlationId);
 *
 * // Extract from response headers
 * const responseCorrelationId = extractCorrelationId(response.headers);
 * ```
 *
 * @module correlationId
 * @see NFR-24: Correlation ID propagation requirement
 * @see NFR-26: Structured logging with correlation IDs
 */

/**
 * Generates a new correlation ID using UUID v4 format.
 *
 * Uses the Web Crypto API's `crypto.randomUUID()` method which generates
 * cryptographically strong random UUIDs conforming to RFC 4122 version 4.
 *
 * **Format**: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` where x is a hex digit
 * and y is one of 8, 9, A, or B.
 *
 * **Performance**: O(1), ~1-2μs per call
 *
 * @returns A new UUID v4 string (36 characters including hyphens)
 *
 * @example
 * ```typescript
 * const id = generateCorrelationId();
 * // Returns: "550e8400-e29b-41d4-a716-446655440000"
 * ```
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

/**
 * Extracts a correlation ID from HTTP response headers.
 *
 * Looks for the `x-correlation-id` header (case-insensitive) and returns
 * its value if present. Returns `null` if the header is missing or empty.
 *
 * **Header Name**: `x-correlation-id` (follows X- convention for custom headers)
 *
 * **Use Cases**:
 * - Extracting correlation ID from edge function responses
 * - Logging response correlation IDs for request/response matching
 * - Debugging failed requests by correlating client and server logs
 *
 * @param headers - Headers object from fetch response or edge function invocation
 * @returns The correlation ID string if present, otherwise null
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/endpoint', { headers });
 * const correlationId = extractCorrelationId(response.headers);
 * if (correlationId) {
 *   console.log('Response correlation ID:', correlationId);
 * }
 * ```
 */
export function extractCorrelationId(headers: Headers): string | null {
  const value = headers.get('x-correlation-id');
  return value && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Adds a correlation ID to a request headers object.
 *
 * Mutates the provided headers object by adding the `x-correlation-id` header.
 * If a correlation ID already exists in the headers, it will be overwritten.
 *
 * **Header Name**: `x-correlation-id`
 *
 * **Use Cases**:
 * - Adding correlation ID to Supabase edge function invocations
 * - Propagating correlation ID through frontend → backend request chains
 * - Ensuring all requests in a flow share the same trace identifier
 *
 * @param headers - Mutable headers object to modify (plain object, not Headers instance)
 * @param correlationId - The correlation ID to add (typically from generateCorrelationId())
 *
 * @example
 * ```typescript
 * const headers = { 'Content-Type': 'application/json' };
 * addCorrelationIdHeader(headers, generateCorrelationId());
 *
 * const { data, error } = await supabase.functions.invoke('my-function', {
 *   body: payload,
 *   headers,
 * });
 * ```
 */
export function addCorrelationIdHeader(
  headers: Record<string, string>,
  correlationId: string
): void {
  headers['x-correlation-id'] = correlationId;
}

/**
 * Creates a headers object with a correlation ID included.
 *
 * Convenience function that creates a new headers object containing the
 * correlation ID. Useful when you don't have an existing headers object.
 *
 * @param correlationId - The correlation ID to include
 * @returns A new headers object with the correlation ID header
 *
 * @example
 * ```typescript
 * const correlationId = generateCorrelationId();
 * const headers = createHeadersWithCorrelationId(correlationId);
 *
 * const { data, error } = await supabase.functions.invoke('my-function', {
 *   body: payload,
 *   headers,
 * });
 * ```
 */
export function createHeadersWithCorrelationId(
  correlationId: string
): Record<string, string> {
  return {
    'x-correlation-id': correlationId,
  };
}

/**
 * Validates that a string is a properly formatted UUID v4.
 *
 * Checks if the provided string matches the UUID v4 format:
 * - 8 hex digits, hyphen, 4 hex digits, hyphen, "4" + 3 hex digits, hyphen,
 *   (8|9|a|b) + 3 hex digits, hyphen, 12 hex digits
 *
 * **Regex Pattern**: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`
 *
 * @param value - The string to validate
 * @returns True if the string is a valid UUID v4, false otherwise
 *
 * @example
 * ```typescript
 * isValidCorrelationId('550e8400-e29b-41d4-a716-446655440000'); // true
 * isValidCorrelationId('invalid-uuid'); // false
 * isValidCorrelationId('550e8400-e29b-51d4-a716-446655440000'); // false (not v4)
 * ```
 */
export function isValidCorrelationId(value: string): boolean {
  const uuidV4Regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(value);
}
