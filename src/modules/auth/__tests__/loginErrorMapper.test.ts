/**
 * @file loginErrorMapper.test.ts
 * @description Comprehensive unit tests for loginErrorMapper utility
 *
 * TASK 6: Create comprehensive unit test suite for error mapping
 * Tests all error detection functions, message mapping, correlation ID generation,
 * and edge case handling with 100% code coverage.
 *
 * @see auth-error-notifications Task 6
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AuthError } from "@supabase/supabase-js";
import { mapAuthError, mapUnknownError } from "../utils/loginErrorMapper";
import { LoginError } from "../errors/LoginError";

/**
 * Helper function to create mock AuthError objects for testing.
 * Simulates Supabase AuthError structure with message and optional status.
 */
function createMockAuthError(message: string, status?: number): AuthError {
  return {
    message,
    status,
    name: "AuthApiError",
  } as AuthError;
}

describe("loginErrorMapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("SUBTASK 6.1: Error type detection functions", () => {
    describe("isInvalidCredentialsError", () => {
      it("should detect status 400 with 'invalid login credentials' message", () => {
        // Arrange: Create mock error with invalid credentials message
        const error = createMockAuthError("Invalid login credentials", 400);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to INVALID_CREDENTIALS
        expect(result).toBeInstanceOf(LoginError);
        expect(result.code).toBe("INVALID_CREDENTIALS");
        expect(result.status).toBe(400);
      });

      it("should detect status 400 with 'invalid credentials' message", () => {
        // Arrange: Create mock error with shorter invalid credentials message
        const error = createMockAuthError("Invalid credentials", 400);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to INVALID_CREDENTIALS
        expect(result.code).toBe("INVALID_CREDENTIALS");
      });

      it("should detect status 400 with 'invalid email or password' message", () => {
        // Arrange: Create mock error with email/password message
        const error = createMockAuthError("Invalid email or password", 400);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to INVALID_CREDENTIALS
        expect(result.code).toBe("INVALID_CREDENTIALS");
      });

      it("should detect status 400 with 'incorrect password' message", () => {
        // Arrange: Create mock error with incorrect password message
        const error = createMockAuthError("Incorrect password", 400);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to INVALID_CREDENTIALS
        expect(result.code).toBe("INVALID_CREDENTIALS");
      });

      it("should handle case-insensitive message matching", () => {
        // Arrange: Create mock error with uppercase message
        const error = createMockAuthError("INVALID LOGIN CREDENTIALS", 400);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to INVALID_CREDENTIALS (case-insensitive)
        expect(result.code).toBe("INVALID_CREDENTIALS");
      });
    });

    describe("isEmailNotConfirmedError", () => {
      it("should detect status 400 with 'not confirmed' message", () => {
        // Arrange: Create mock error with email not confirmed message
        const error = createMockAuthError("Email not confirmed", 400);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to EMAIL_NOT_CONFIRMED
        expect(result).toBeInstanceOf(LoginError);
        expect(result.code).toBe("EMAIL_NOT_CONFIRMED");
        expect(result.status).toBe(400);
      });

      it("should detect 'email not confirmed' message without status check", () => {
        // Arrange: Create mock error without status but with message
        const error = createMockAuthError("Email not confirmed");

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to EMAIL_NOT_CONFIRMED
        expect(result.code).toBe("EMAIL_NOT_CONFIRMED");
      });

      it("should prioritize email not confirmed over invalid credentials", () => {
        // Arrange: Create mock error that could match multiple patterns
        const error = createMockAuthError("User not confirmed", 400);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be EMAIL_NOT_CONFIRMED (more specific check comes first)
        expect(result.code).toBe("EMAIL_NOT_CONFIRMED");
      });
    });

    describe("isAccountLockedError", () => {
      it("should detect status 429 (rate limit) errors", () => {
        // Arrange: Create mock error with 429 status
        const error = createMockAuthError("Too many requests", 429);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to ACCOUNT_LOCKED
        expect(result).toBeInstanceOf(LoginError);
        expect(result.code).toBe("ACCOUNT_LOCKED");
        expect(result.status).toBe(429);
      });

      it("should detect 'too many' message pattern", () => {
        // Arrange: Create mock error with too many attempts message
        const error = createMockAuthError("Too many login attempts");

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to ACCOUNT_LOCKED
        expect(result.code).toBe("ACCOUNT_LOCKED");
      });

      it("should detect 'rate limit' message pattern", () => {
        // Arrange: Create mock error with rate limit message
        const error = createMockAuthError("Rate limit exceeded");

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to ACCOUNT_LOCKED
        expect(result.code).toBe("ACCOUNT_LOCKED");
      });

      it("should detect 'temporarily locked' message pattern", () => {
        // Arrange: Create mock error with temporarily locked message
        const error = createMockAuthError("Account temporarily locked");

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to ACCOUNT_LOCKED
        expect(result.code).toBe("ACCOUNT_LOCKED");
      });

      it("should detect 'account locked' message pattern", () => {
        // Arrange: Create mock error with account locked message
        const error = createMockAuthError("Account locked due to failed attempts");

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to ACCOUNT_LOCKED
        expect(result.code).toBe("ACCOUNT_LOCKED");
      });
    });

    describe("isNetworkError", () => {
      it("should detect errors with no status and 'fetch failed' message", () => {
        // Arrange: Create mock error with network failure message
        const error = createMockAuthError("fetch failed");

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to NETWORK_ERROR
        expect(result).toBeInstanceOf(LoginError);
        expect(result.code).toBe("NETWORK_ERROR");
        expect(result.status).toBe(0);
      });

      it("should detect errors with status 0 and network message", () => {
        // Arrange: Create mock error with status 0
        const error = createMockAuthError("network request failed", 0);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to NETWORK_ERROR
        expect(result.code).toBe("NETWORK_ERROR");
      });

      it("should detect 'network' message pattern", () => {
        // Arrange: Create mock error with network message
        const error = createMockAuthError("Network error occurred");

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to NETWORK_ERROR
        expect(result.code).toBe("NETWORK_ERROR");
      });

      it("should detect 'connection failed' message pattern", () => {
        // Arrange: Create mock error with connection failed message
        const error = createMockAuthError("Connection failed");

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to NETWORK_ERROR
        expect(result.code).toBe("NETWORK_ERROR");
      });

      it("should detect 'failed to fetch' message pattern", () => {
        // Arrange: Create mock error with failed to fetch message
        const error = createMockAuthError("Failed to fetch");

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to NETWORK_ERROR
        expect(result.code).toBe("NETWORK_ERROR");
      });

      it("should not detect network error when status is present", () => {
        // Arrange: Create mock error with network message but valid status
        const error = createMockAuthError("network issue", 500);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should NOT be mapped to NETWORK_ERROR (has valid status)
        expect(result.code).not.toBe("NETWORK_ERROR");
      });
    });

    describe("isServiceUnavailableError", () => {
      it("should detect status 500 (internal server error)", () => {
        // Arrange: Create mock error with 500 status
        const error = createMockAuthError("Internal server error", 500);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to SERVICE_UNAVAILABLE
        expect(result).toBeInstanceOf(LoginError);
        expect(result.code).toBe("SERVICE_UNAVAILABLE");
        expect(result.status).toBe(500);
      });

      it("should detect status 503 (service unavailable)", () => {
        // Arrange: Create mock error with 503 status
        const error = createMockAuthError("Service unavailable", 503);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to SERVICE_UNAVAILABLE
        expect(result.code).toBe("SERVICE_UNAVAILABLE");
        expect(result.status).toBe(503);
      });

      it("should detect status 502 (bad gateway)", () => {
        // Arrange: Create mock error with 502 status
        const error = createMockAuthError("Bad gateway", 502);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to SERVICE_UNAVAILABLE
        expect(result.code).toBe("SERVICE_UNAVAILABLE");
      });

      it("should detect 'server error' message pattern", () => {
        // Arrange: Create mock error with server error message
        const error = createMockAuthError("Server error occurred");

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to SERVICE_UNAVAILABLE
        expect(result.code).toBe("SERVICE_UNAVAILABLE");
      });

      it("should detect 'service unavailable' message pattern", () => {
        // Arrange: Create mock error with service unavailable message
        const error = createMockAuthError("Service unavailable");

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to SERVICE_UNAVAILABLE
        expect(result.code).toBe("SERVICE_UNAVAILABLE");
      });

      it("should detect 'internal error' message pattern", () => {
        // Arrange: Create mock error with internal error message
        const error = createMockAuthError("Internal error");

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to SERVICE_UNAVAILABLE
        expect(result.code).toBe("SERVICE_UNAVAILABLE");
      });
    });

    describe("isSessionExpiredError", () => {
      it("should detect status 401 (unauthorized) errors", () => {
        // Arrange: Create mock error with 401 status
        const error = createMockAuthError("Unauthorized", 401);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to SESSION_EXPIRED
        expect(result).toBeInstanceOf(LoginError);
        expect(result.code).toBe("SESSION_EXPIRED");
        expect(result.status).toBe(401);
      });

      it("should detect 'session expired' message pattern", () => {
        // Arrange: Create mock error with session expired message
        const error = createMockAuthError("Session expired");

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to SESSION_EXPIRED
        expect(result.code).toBe("SESSION_EXPIRED");
      });

      it("should detect 'token expired' message pattern", () => {
        // Arrange: Create mock error with token expired message
        const error = createMockAuthError("Token expired");

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to SESSION_EXPIRED
        expect(result.code).toBe("SESSION_EXPIRED");
      });

      it("should detect 'jwt expired' message pattern", () => {
        // Arrange: Create mock error with JWT expired message
        const error = createMockAuthError("JWT expired");

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to SESSION_EXPIRED
        expect(result.code).toBe("SESSION_EXPIRED");
      });

      it("should detect 'expired token' message pattern", () => {
        // Arrange: Create mock error with expired token message
        const error = createMockAuthError("Expired token");

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to SESSION_EXPIRED
        expect(result.code).toBe("SESSION_EXPIRED");
      });
    });

    describe("isUserNotFoundError", () => {
      it("should detect status 400 with 'user not found' message", () => {
        // Arrange: Create mock error with user not found message
        const error = createMockAuthError("User not found", 400);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to USER_NOT_FOUND
        expect(result).toBeInstanceOf(LoginError);
        expect(result.code).toBe("USER_NOT_FOUND");
        expect(result.status).toBe(400);
      });

      it("should detect status 400 with 'no user found' message", () => {
        // Arrange: Create mock error with no user found message
        const error = createMockAuthError("No user found with this email", 400);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to USER_NOT_FOUND
        expect(result.code).toBe("USER_NOT_FOUND");
      });

      it("should detect status 400 with 'user does not exist' message", () => {
        // Arrange: Create mock error with user does not exist message
        const error = createMockAuthError("User does not exist", 400);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to USER_NOT_FOUND
        expect(result.code).toBe("USER_NOT_FOUND");
      });

      it("should detect status 400 with 'couldn't find your account' message", () => {
        // Arrange: Create mock error with account not found message
        const error = createMockAuthError("Couldn't find your account", 400);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be mapped to USER_NOT_FOUND
        expect(result.code).toBe("USER_NOT_FOUND");
      });

      it("should prioritize user not found over invalid credentials", () => {
        // Arrange: Create mock error with user not found (both would match 400)
        const error = createMockAuthError("User not found", 400);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be USER_NOT_FOUND (checked before INVALID_CREDENTIALS)
        expect(result.code).toBe("USER_NOT_FOUND");
      });
    });
  });

  describe("SUBTASK 6.2: Error message mapping returns correct user-friendly text", () => {
    it("should return correct user-friendly message for INVALID_CREDENTIALS", () => {
      // Arrange: Create invalid credentials error
      const error = createMockAuthError("Invalid login credentials", 400);

      // Act: Map error and get user message
      const result = mapAuthError(error);

      // Assert: User message should be clear and actionable
      expect(result.getUserMessage()).toBe("Email or password is incorrect. Please try again.");
    });

    it("should return correct user-friendly message for EMAIL_NOT_CONFIRMED", () => {
      // Arrange: Create email not confirmed error
      const error = createMockAuthError("Email not confirmed", 400);

      // Act: Map error and get user message
      const result = mapAuthError(error);

      // Assert: User message should guide user to verify email
      expect(result.getUserMessage()).toBe("Please verify your email before signing in. Check your inbox.");
    });

    it("should return correct user-friendly message for ACCOUNT_LOCKED", () => {
      // Arrange: Create account locked error
      const error = createMockAuthError("Too many requests", 429);

      // Act: Map error and get user message
      const result = mapAuthError(error);

      // Assert: User message should include wait time guidance
      expect(result.getUserMessage()).toBe("Account temporarily locked due to multiple failed attempts. Try again later.");
    });

    it("should return correct user-friendly message for NETWORK_ERROR", () => {
      // Arrange: Create network error
      const error = createMockAuthError("fetch failed");

      // Act: Map error and get user message
      const result = mapAuthError(error);

      // Assert: User message should be distinguished from auth errors
      expect(result.getUserMessage()).toBe("Network connection failed. Please check your internet.");
    });

    it("should return correct user-friendly message for SERVICE_UNAVAILABLE", () => {
      // Arrange: Create service unavailable error
      const error = createMockAuthError("Internal server error", 500);

      // Act: Map error and get user message
      const result = mapAuthError(error);

      // Assert: User message should provide retry guidance
      expect(result.getUserMessage()).toBe("Authentication service is temporarily unavailable. Please try again.");
    });

    it("should return correct user-friendly message for SESSION_EXPIRED", () => {
      // Arrange: Create session expired error
      const error = createMockAuthError("Unauthorized", 401);

      // Act: Map error and get user message
      const result = mapAuthError(error);

      // Assert: User message should prompt re-login
      expect(result.getUserMessage()).toBe("Your session has expired. Please log in again.");
    });

    it("should return correct user-friendly message for USER_NOT_FOUND", () => {
      // Arrange: Create user not found error
      const error = createMockAuthError("User not found", 400);

      // Act: Map error and get user message
      const result = mapAuthError(error);

      // Assert: User message should be clear about no account
      expect(result.getUserMessage()).toBe("No account found with this email.");
    });

    it("should return correct user-friendly message for UNKNOWN_ERROR", () => {
      // Arrange: Create unknown error (no matching pattern)
      const error = createMockAuthError("Something went wrong", 418);

      // Act: Map error and get user message
      const result = mapAuthError(error);

      // Assert: Should fallback to generic message
      expect(result.code).toBe("UNKNOWN_ERROR");
      expect(result.getUserMessage()).toBe("An unexpected error occurred. Please try again.");
    });
  });

  describe("SUBTASK 6.3: Correlation ID generation and edge case handling", () => {
    describe("Correlation ID", () => {
      it("should generate valid UUID correlation ID for each error", () => {
        // Arrange: Create mock error
        const error = createMockAuthError("Invalid login credentials", 400);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should have valid UUID correlation ID
        expect(result.correlationId).toBeDefined();
        expect(result.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });

      it("should preserve explicit correlation ID when provided", () => {
        // Arrange: Create mock error and explicit correlation ID
        const error = createMockAuthError("Invalid credentials", 400);
        const explicitId = "test-correlation-id-12345";

        // Act: Map error with explicit correlation ID
        const result = mapAuthError(error, explicitId);

        // Assert: Should use provided correlation ID
        expect(result.correlationId).toBe(explicitId);
      });

      it("should generate different correlation IDs for different errors", () => {
        // Arrange: Create multiple mock errors
        const error1 = createMockAuthError("Error 1", 400);
        const error2 = createMockAuthError("Error 2", 400);

        // Act: Map errors
        const result1 = mapAuthError(error1);
        const result2 = mapAuthError(error2);

        // Assert: Should have different correlation IDs
        expect(result1.correlationId).not.toBe(result2.correlationId);
      });
    });

    describe("mapUnknownError edge cases", () => {
      it("should handle null error objects gracefully", () => {
        // Arrange: Null error
        const error = null;

        // Act: Map unknown error
        const result = mapUnknownError(error);

        // Assert: Should return LoginError with generic message
        expect(result).toBeInstanceOf(LoginError);
        expect(result.code).toBe("UNKNOWN_ERROR");
        expect(result.getUserMessage()).toBe("An unexpected error occurred. Please try again.");
        expect(result.status).toBe(0);
        expect(result.message).toBe("An unexpected error occurred during authentication");
      });

      it("should handle undefined error objects gracefully", () => {
        // Arrange: Undefined error
        const error = undefined;

        // Act: Map unknown error
        const result = mapUnknownError(error);

        // Assert: Should return LoginError with generic message
        expect(result).toBeInstanceOf(LoginError);
        expect(result.code).toBe("UNKNOWN_ERROR");
        expect(result.status).toBe(0);
      });

      it("should extract message from Error objects", () => {
        // Arrange: Standard JavaScript Error
        const error = new Error("Custom error message");

        // Act: Map unknown error
        const result = mapUnknownError(error);

        // Assert: Should extract message from Error
        expect(result.message).toBe("Custom error message");
        expect(result.code).toBe("UNKNOWN_ERROR");
      });

      it("should handle objects with message property", () => {
        // Arrange: Object with message
        const error = { message: "Object error message" };

        // Act: Map unknown error
        const result = mapUnknownError(error);

        // Assert: Should extract message
        expect(result.message).toBe("Object error message");
      });

      it("should handle objects without message property", () => {
        // Arrange: Object without message
        const error = { someProperty: "value" };

        // Act: Map unknown error
        const result = mapUnknownError(error);

        // Assert: Should use default message
        expect(result.message).toBe("An unexpected error occurred during authentication");
      });

      it("should handle empty string message", () => {
        // Arrange: Error with empty message
        const error = { message: "" };

        // Act: Map unknown error
        const result = mapUnknownError(error);

        // Assert: Should use default message (empty string ignored)
        expect(result.message).toBe("An unexpected error occurred during authentication");
      });

      it("should handle whitespace-only message", () => {
        // Arrange: Error with whitespace message
        const error = { message: "   " };

        // Act: Map unknown error
        const result = mapUnknownError(error);

        // Assert: Should use default message (whitespace trimmed and ignored)
        expect(result.message).toBe("An unexpected error occurred during authentication");
      });

      it("should generate correlation ID for unknown errors", () => {
        // Arrange: Unknown error
        const error = new Error("Unknown error");

        // Act: Map unknown error
        const result = mapUnknownError(error);

        // Assert: Should have valid UUID correlation ID
        expect(result.correlationId).toBeDefined();
        expect(result.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });
    });

    describe("mapAuthError edge cases", () => {
      it("should handle missing status code", () => {
        // Arrange: Create error without status
        const error = createMockAuthError("Error without status");

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should default status to 0
        expect(result.status).toBe(0);
      });

      it("should handle empty error message", () => {
        // Arrange: Create error with empty message
        const error = createMockAuthError("", 400);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should use default technical message
        expect(result.message).toBe("Authentication failed");
      });

      it("should handle whitespace-only error message", () => {
        // Arrange: Create error with whitespace message
        const error = createMockAuthError("   ", 400);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should use default technical message (whitespace trimmed)
        expect(result.message).toBe("Authentication failed");
      });

      it("should handle error with undefined message property", () => {
        // Arrange: Create error with undefined message
        const error = {
          message: undefined,
          status: 400,
        } as unknown as AuthError;

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should use default technical message
        expect(result.message).toBe("Authentication failed");
      });

      it("should handle error with non-string message property", () => {
        // Arrange: Create error with non-string message
        const error = {
          message: 12345,
          status: 400,
        } as unknown as AuthError;

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should use default technical message
        expect(result.message).toBe("Authentication failed");
      });

      it("should handle error with non-number status property", () => {
        // Arrange: Create error with string status
        const error = {
          message: "Invalid credentials",
          status: "400",
        } as unknown as AuthError;

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should default to 0 for invalid status type
        expect(result.status).toBe(0);
      });
    });

    describe("toJSON serialization", () => {
      it("should produce valid JSON structure", () => {
        // Arrange: Create mock error
        const error = createMockAuthError("Invalid credentials", 400);

        // Act: Map error and serialize to JSON
        const result = mapAuthError(error);
        const json = result.toJSON();

        // Assert: Should have all expected properties
        expect(json).toHaveProperty("name", "LoginError");
        expect(json).toHaveProperty("message");
        expect(json).toHaveProperty("code");
        expect(json).toHaveProperty("status");
        expect(json).toHaveProperty("userMessage");
        expect(json).toHaveProperty("correlationId");
        expect(json).toHaveProperty("stack");
      });

      it("should include correlation ID in JSON", () => {
        // Arrange: Create mock error
        const error = createMockAuthError("Error", 400);

        // Act: Map error and serialize
        const result = mapAuthError(error);
        const json = result.toJSON();

        // Assert: Correlation ID should be in JSON
        expect(json.correlationId).toBe(result.correlationId);
        expect(typeof json.correlationId).toBe("string");
      });

      it("should include both technical and user-friendly messages", () => {
        // Arrange: Create mock error
        const error = createMockAuthError("Invalid login credentials", 400);

        // Act: Map error and serialize
        const result = mapAuthError(error);
        const json = result.toJSON();

        // Assert: Should have both message types
        expect(json.message).toBe("Invalid login credentials"); // Technical
        expect(json.userMessage).toBe("Email or password is incorrect. Please try again."); // User-friendly
      });
    });

    describe("Error detection order", () => {
      it("should prioritize email not confirmed over invalid credentials (both 400)", () => {
        // Arrange: Create error that matches both patterns
        const error = createMockAuthError("Email address not confirmed", 400);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be EMAIL_NOT_CONFIRMED (checked first in order)
        expect(result.code).toBe("EMAIL_NOT_CONFIRMED");
      });

      it("should prioritize user not found over invalid credentials (both 400)", () => {
        // Arrange: Create error that matches both patterns
        const error = createMockAuthError("User not found", 400);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be USER_NOT_FOUND (checked before invalid credentials)
        expect(result.code).toBe("USER_NOT_FOUND");
      });

      it("should fallback to invalid credentials for generic 400 errors", () => {
        // Arrange: Create generic 400 error
        const error = createMockAuthError("Invalid login credentials", 400);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be INVALID_CREDENTIALS (fallback for 400)
        expect(result.code).toBe("INVALID_CREDENTIALS");
      });

      it("should prioritize session expired (401) over other checks", () => {
        // Arrange: Create 401 error
        const error = createMockAuthError("Unauthorized access", 401);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be SESSION_EXPIRED (401 checked early)
        expect(result.code).toBe("SESSION_EXPIRED");
      });

      it("should prioritize account locked (429) over other checks", () => {
        // Arrange: Create 429 error
        const error = createMockAuthError("Rate limit exceeded", 429);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be ACCOUNT_LOCKED (429 is unique)
        expect(result.code).toBe("ACCOUNT_LOCKED");
      });

      it("should prioritize service unavailable (500+) over network errors", () => {
        // Arrange: Create 500 error with network-like message
        const error = createMockAuthError("Network error on server", 500);

        // Act: Map error
        const result = mapAuthError(error);

        // Assert: Should be SERVICE_UNAVAILABLE (has status, not network error)
        expect(result.code).toBe("SERVICE_UNAVAILABLE");
      });

      it("should detect network error only when status is missing or 0", () => {
        // Arrange: Create error without status
        const errorNoStatus = createMockAuthError("fetch failed");
        const errorStatus0 = createMockAuthError("network error", 0);

        // Act: Map errors
        const resultNoStatus = mapAuthError(errorNoStatus);
        const resultStatus0 = mapAuthError(errorStatus0);

        // Assert: Both should be NETWORK_ERROR
        expect(resultNoStatus.code).toBe("NETWORK_ERROR");
        expect(resultStatus0.code).toBe("NETWORK_ERROR");
      });
    });
  });

  describe("Integration tests", () => {
    it("should map real Supabase error format correctly", () => {
      // Arrange: Simulate real Supabase AuthError structure
      const realSupabaseError = {
        message: "Invalid login credentials",
        status: 400,
        name: "AuthApiError",
        __isAuthError: true,
      } as AuthError;

      // Act: Map error
      const result = mapAuthError(realSupabaseError);

      // Assert: Should map correctly
      expect(result).toBeInstanceOf(LoginError);
      expect(result.code).toBe("INVALID_CREDENTIALS");
      expect(result.status).toBe(400);
      expect(result.getUserMessage()).toBe("Email or password is incorrect. Please try again.");
    });

    it("should handle complete error lifecycle", () => {
      // Arrange: Create error
      const error = createMockAuthError("Invalid credentials", 400);

      // Act: Map error, get user message, serialize to JSON
      const result = mapAuthError(error);
      const userMessage = result.getUserMessage();
      const json = result.toJSON();

      // Assert: Complete lifecycle works
      expect(result).toBeInstanceOf(LoginError);
      expect(userMessage).toBe("Email or password is incorrect. Please try again.");
      expect(json.code).toBe("INVALID_CREDENTIALS");
      expect(json.correlationId).toBeDefined();
    });

    it("should maintain error instance properties after mapping", () => {
      // Arrange: Create error
      const error = createMockAuthError("Service error", 503);

      // Act: Map error
      const result = mapAuthError(error);

      // Assert: All properties should be accessible
      expect(result.name).toBe("LoginError");
      expect(result.code).toBe("SERVICE_UNAVAILABLE");
      expect(result.status).toBe(503);
      expect(result.message).toBe("Service error");
      expect(result.getUserMessage()).toBe("Authentication service is temporarily unavailable. Please try again.");
      expect(result.correlationId).toBeDefined();
      expect(result.stack).toBeDefined();
    });
  });
});
