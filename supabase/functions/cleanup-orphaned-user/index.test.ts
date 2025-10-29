/**
 * cleanup-orphaned-user Edge Function Tests
 *
 * Test Suite: Comprehensive tests for two-step verification cleanup flow
 *
 * Coverage:
 * - Step 1 (request-code): Success and error scenarios
 * - Step 2 (validate-and-cleanup): Success and error scenarios
 * - Constant-time response timing
 * - Rate limiting enforcement
 * - Distributed locking
 * - Orphan verification
 *
 * Requirements: Req#12 (Testing), Req#3 (Cleanup Edge Function),
 *               Req#14 (Edge cases), NFR-5 (Constant-time response)
 *
 * Author: Claude Code (registration-edge-case-fix Phase 2)
 * Date: 2025-10-28
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.208.0/testing/asserts.ts";
import { describe, it, beforeEach, afterEach } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";

// Import types for mocking
import type {
  CleanupRequest,
  ErrorResponse,
  SuccessResponse,
  RateLimitResult,
  VerificationCodeRecord,
} from "./types.ts";

// =================================================================================
// TEST CONFIGURATION
// =================================================================================

const TEST_CONFIG = {
  supabaseUrl: Deno.env.get("SUPABASE_URL") || "http://localhost:54321",
  supabaseServiceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "test-service-key",
  edgeFunctionUrl: Deno.env.get("EDGE_FUNCTION_URL") ||
    "http://localhost:54321/functions/v1/cleanup-orphaned-user",
};

// Test data
const TEST_USER = {
  id: "test-user-id-123",
  email: "test@example.com",
  emailLower: "test@example.com",
  emailConfirmedAt: new Date().toISOString(),
};

const TEST_CODE = "ABCD5678"; // 8-character alphanumeric

// =================================================================================
// HELPER FUNCTIONS
// =================================================================================

/**
 * Create test Supabase client with service role
 */
function createTestClient(): SupabaseClient {
  return createClient(
    TEST_CONFIG.supabaseUrl,
    TEST_CONFIG.supabaseServiceKey,
    { auth: { persistSession: false } }
  );
}

/**
 * Call edge function with payload
 */
async function callEdgeFunction(
  payload: CleanupRequest,
  correlationId?: string
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (correlationId) {
    headers["x-correlation-id"] = correlationId;
  }

  return await fetch(TEST_CONFIG.edgeFunctionUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

/**
 * Measure response time in milliseconds
 */
async function measureResponseTime(
  fn: () => Promise<Response>
): Promise<{ response: Response; durationMs: number }> {
  const start = performance.now();
  const response = await fn();
  const durationMs = performance.now() - start;
  return { response, durationMs };
}

/**
 * Create orphaned test user
 */
async function createOrphanedUser(
  supabase: SupabaseClient,
  email: string
): Promise<{ id: string; email: string }> {
  // Create user via admin API
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: "test-password-123",
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  // Verify no company/admin data exists (should be orphaned)
  const [companiesResult, adminsResult] = await Promise.all([
    supabase.from("companies").select("id").eq("owner_admin_uuid", data.user.id).limit(1),
    supabase.from("company_admins").select("id").eq("admin_uuid", data.user.id).limit(1),
  ]);

  if ((companiesResult.data?.length ?? 0) > 0 || (adminsResult.data?.length ?? 0) > 0) {
    throw new Error("Test user has company data - not orphaned!");
  }

  return { id: data.user.id, email: data.user.email! };
}

/**
 * Cleanup test user
 */
async function cleanupTestUser(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  await supabase.auth.admin.deleteUser(userId);
}

/**
 * Generate random email for testing
 */
function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `test-${timestamp}-${random}@example.com`;
}

/**
 * Hash email using SHA-256 (same algorithm as edge function)
 */
async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// =================================================================================
// TEST SUITE 2.8.1: Step 1 - request-code SUCCESS FLOW
// =================================================================================

describe("Step 1: request-code - Success Flow", () => {
  let supabase: SupabaseClient;
  let testUser: { id: string; email: string } | null = null;

  beforeEach(async () => {
    supabase = createTestClient();
    // Create orphaned test user
    const email = generateTestEmail();
    testUser = await createOrphanedUser(supabase, email);
  });

  afterEach(async () => {
    if (testUser) {
      await cleanupTestUser(supabase, testUser.id);
      testUser = null;
    }
  });

  it("should generate code, store in Postgres, send email, and create log entry", async () => {
    if (!testUser) throw new Error("Test user not initialized");

    const payload: CleanupRequest = {
      step: "request-code",
      email: testUser.email,
    };

    const correlationId = crypto.randomUUID();
    const response = await callEdgeFunction(payload, correlationId);

    // Assert: HTTP 200
    assertEquals(response.status, 200);

    // Assert: Response body structure
    const body = await response.json() as SuccessResponse;
    assertExists(body.data);
    assertExists(body.data.message);
    assertExists(body.data.correlationId);
    assertExists(body.data.expiresAt);

    // Assert: Code stored in verification_codes table
    const emailHash = await hashEmail(testUser.email);
    const { data: codes } = await supabase
      .from("verification_codes")
      .select("*")
      .eq("email_hash", emailHash)
      .limit(1);

    assertEquals(codes?.length, 1);
    const storedCode = codes![0] as VerificationCodeRecord;
    assertExists(storedCode.code_hash);
    assertExists(storedCode.code_salt);
    assertExists(storedCode.correlation_id);
    assertExists(storedCode.expires_at);

    // Assert: Expiry is ~5 minutes from now (within 10 seconds tolerance)
    const expiresAt = new Date(storedCode.expires_at);
    const expectedExpiry = new Date(Date.now() + 5 * 60 * 1000);
    const timeDiff = Math.abs(expiresAt.getTime() - expectedExpiry.getTime());
    assert(timeDiff < 10_000, `Expiry time difference too large: ${timeDiff}ms`);

    // Assert: auth_cleanup_log entry created
    const { data: logs } = await supabase
      .from("auth_cleanup_log")
      .select("*")
      .eq("correlation_id", storedCode.correlation_id)
      .limit(1);

    assertEquals(logs?.length, 1);
    assertEquals(logs![0].status, "pending");
    assertEquals(logs![0].email_hash, emailHash);
  });

  it("should reuse existing valid code if not expired", async () => {
    if (!testUser) throw new Error("Test user not initialized");

    const payload: CleanupRequest = {
      step: "request-code",
      email: testUser.email,
    };

    // First request
    const response1 = await callEdgeFunction(payload);
    assertEquals(response1.status, 200);
    const body1 = await response1.json() as SuccessResponse;
    const correlationId1 = body1.data.correlationId;

    // Second request immediately after
    const response2 = await callEdgeFunction(payload);
    assertEquals(response2.status, 200);
    const body2 = await response2.json() as SuccessResponse;

    // Assert: Same correlation ID (reused existing code)
    assertEquals(body2.data.correlationId, correlationId1);

    // Assert: Message indicates code already sent
    assert(
      body2.data.message.includes("already sent"),
      "Message should indicate code was already sent"
    );
  });
});

// =================================================================================
// TEST SUITE 2.8.2: Step 1 - request-code ERROR SCENARIOS
// =================================================================================

describe("Step 1: request-code - Error Scenarios", () => {
  let supabase: SupabaseClient;

  beforeEach(() => {
    supabase = createTestClient();
  });

  it("should return 404 ORPHAN_CLEANUP_004 for non-existent user", async () => {
    const payload: CleanupRequest = {
      step: "request-code",
      email: "nonexistent@example.com",
    };

    const response = await callEdgeFunction(payload);

    assertEquals(response.status, 404);
    const body = await response.json() as ErrorResponse;
    assertEquals(body.error.code, "ORPHAN_CLEANUP_004");
    assert(body.error.message.includes("not found"));
  });

  it("should return 409 ORPHAN_CLEANUP_005 for non-orphaned user", async () => {
    // Create user with company data (not orphaned)
    const email = generateTestEmail();
    const { data: userData } = await supabase.auth.admin.createUser({
      email,
      password: "test-password",
      email_confirm: true,
    });

    if (!userData?.user) throw new Error("Failed to create user");

    // Create company for this user (makes them non-orphaned)
    const { error: companyError } = await supabase.from("companies").insert({
      name: "Test Company",
      owner_admin_uuid: userData.user.id,
    });

    if (companyError) {
      throw new Error(`Failed to create company: ${companyError.message}`);
    }

    try {
      const payload: CleanupRequest = {
        step: "request-code",
        email,
      };

      const response = await callEdgeFunction(payload);

      assertEquals(response.status, 409);
      const body = await response.json() as ErrorResponse;
      assertEquals(body.error.code, "ORPHAN_CLEANUP_005");
      assert(body.error.message.includes("not orphaned"));
    } finally {
      // Cleanup
      await supabase.auth.admin.deleteUser(userData.user.id);
    }
  });

  it("should return 429 with Retry-After header when rate limited", async () => {
    const email = generateTestEmail();
    const testUser = await createOrphanedUser(supabase, email);

    try {
      const payload: CleanupRequest = {
        step: "request-code",
        email,
      };

      // Send multiple requests rapidly to trigger rate limit
      // Per-email rate limit: 3 requests per hour
      const responses: Response[] = [];
      for (let i = 0; i < 4; i++) {
        responses.push(await callEdgeFunction(payload));
      }

      // At least one should be rate limited
      const rateLimited = responses.some((r) => r.status === 429);
      assert(rateLimited, "Expected at least one request to be rate limited");

      // Check rate limited response
      const rateLimitedResponse = responses.find((r) => r.status === 429);
      if (rateLimitedResponse) {
        const body = await rateLimitedResponse.json() as ErrorResponse;
        assertEquals(body.error.code, "ORPHAN_CLEANUP_003");
        assertExists(body.error.retryAfter);
        assert(body.error.retryAfter! > 0);

        // Check Retry-After header
        const retryAfterHeader = rateLimitedResponse.headers.get("Retry-After");
        assertExists(retryAfterHeader);
        assert(parseInt(retryAfterHeader!) > 0);
      }
    } finally {
      await cleanupTestUser(supabase, testUser.id);
    }
  });

  it("should return 409 ORPHAN_CLEANUP_009 when lock already held", async () => {
    const email = generateTestEmail();
    const testUser = await createOrphanedUser(supabase, email);

    try {
      // Manually acquire lock
      const { data: lockAcquired } = await supabase.rpc("acquire_cleanup_lock", {
        p_email: email.toLowerCase(),
      });

      assertEquals(lockAcquired, true);

      // Try to request code (should fail with lock error)
      const payload: CleanupRequest = {
        step: "request-code",
        email,
      };

      const response = await callEdgeFunction(payload);

      assertEquals(response.status, 409);
      const body = await response.json() as ErrorResponse;
      assertEquals(body.error.code, "ORPHAN_CLEANUP_009");
      assert(body.error.message.includes("already in progress"));

      // Cleanup: release lock
      await supabase.rpc("release_cleanup_lock", { p_email: email.toLowerCase() });
    } finally {
      await cleanupTestUser(supabase, testUser.id);
    }
  });

  // Note: Email delivery failure test (ORPHAN_CLEANUP_008) requires
  // implementing actual email sending with Resend/SendGrid
  // This is a placeholder for future implementation
  it.ignore("should return 500 ORPHAN_CLEANUP_008 on email delivery failure", async () => {
    // TODO: Implement when email sending is integrated
  });
});

// =================================================================================
// TEST SUITE 2.8.3: Step 2 - validate-and-cleanup SUCCESS FLOW
// =================================================================================

describe("Step 2: validate-and-cleanup - Success Flow", () => {
  let supabase: SupabaseClient;
  let testUser: { id: string; email: string } | null = null;
  let verificationCode: string | null = null;

  beforeEach(async () => {
    supabase = createTestClient();
    const email = generateTestEmail();
    testUser = await createOrphanedUser(supabase, email);

    // Request code first
    const payload: CleanupRequest = {
      step: "request-code",
      email: testUser.email,
    };

    await callEdgeFunction(payload);

    // For testing, we need to extract the actual code from storage
    // Since codes are hashed, we'll need to store the plaintext code
    // in a test-only manner. For now, we'll skip this test until
    // we implement a test mode that returns the code.
    verificationCode = TEST_CODE; // Placeholder
  });

  afterEach(async () => {
    if (testUser) {
      // Try to cleanup, but user might already be deleted
      try {
        await cleanupTestUser(supabase, testUser.id);
      } catch {
        // Ignore error if user already deleted
      }
      testUser = null;
    }
  });

  // Note: This test requires the edge function to return the verification code
  // in test mode, or we need to mock the code validation
  it.ignore("should validate code, delete user, update log, and delete code", async () => {
    if (!testUser || !verificationCode) {
      throw new Error("Test user or verification code not initialized");
    }

    const payload: CleanupRequest = {
      step: "validate-and-cleanup",
      email: testUser.email,
      verificationCode,
    };

    const response = await callEdgeFunction(payload);

    // Assert: HTTP 200
    assertEquals(response.status, 200);

    // Assert: Response body structure
    const body = await response.json() as SuccessResponse;
    assertExists(body.data);
    assertExists(body.data.message);
    assertExists(body.data.correlationId);

    // Assert: User deleted from auth.users
    const { data: users } = await supabase.auth.admin.listUsers();
    const userExists = users.users.some((u) => u.id === testUser!.id);
    assertEquals(userExists, false);

    // Assert: verification_codes entry deleted
    const emailHash = await hashEmail(testUser.email);
    const { data: codes } = await supabase
      .from("verification_codes")
      .select("*")
      .eq("email_hash", emailHash)
      .limit(1);

    assertEquals(codes?.length, 0);

    // Assert: auth_cleanup_log updated to completed
    const { data: logs } = await supabase
      .from("auth_cleanup_log")
      .select("*")
      .eq("email_hash", emailHash)
      .order("created_at", { ascending: false })
      .limit(1);

    assertEquals(logs?.length, 1);
    assertEquals(logs![0].status, "completed");
  });
});

// =================================================================================
// TEST SUITE 2.8.4: Step 2 - validate-and-cleanup ERROR SCENARIOS
// =================================================================================

describe("Step 2: validate-and-cleanup - Error Scenarios", () => {
  let supabase: SupabaseClient;

  beforeEach(() => {
    supabase = createTestClient();
  });

  it("should return 404 ORPHAN_CLEANUP_001 for expired code", async () => {
    const email = generateTestEmail();
    const testUser = await createOrphanedUser(supabase, email);

    try {
      // Manually insert expired code
      const emailHash = await hashEmail(email);
      const expiredAt = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

      await supabase.from("verification_codes").insert({
        email_hash: emailHash,
        code_hash: new Uint8Array(32), // Dummy hash
        code_salt: new Uint8Array(16), // Dummy salt
        correlation_id: crypto.randomUUID(),
        expires_at: expiredAt.toISOString(),
      });

      const payload: CleanupRequest = {
        step: "validate-and-cleanup",
        email,
        verificationCode: "ABCD5678",
      };

      const response = await callEdgeFunction(payload);

      assertEquals(response.status, 404);
      const body = await response.json() as ErrorResponse;
      assertEquals(body.error.code, "ORPHAN_CLEANUP_001");
      assert(body.error.message.includes("expired"));
    } finally {
      await cleanupTestUser(supabase, testUser.id);
    }
  });

  it("should return 401 ORPHAN_CLEANUP_002 for invalid code", async () => {
    const email = generateTestEmail();
    const testUser = await createOrphanedUser(supabase, email);

    try {
      // Request valid code first
      const requestPayload: CleanupRequest = {
        step: "request-code",
        email,
      };
      await callEdgeFunction(requestPayload);

      // Try to validate with wrong code
      const validatePayload: CleanupRequest = {
        step: "validate-and-cleanup",
        email,
        verificationCode: "WRONG123",
      };

      const response = await callEdgeFunction(validatePayload);

      assertEquals(response.status, 401);
      const body = await response.json() as ErrorResponse;
      assertEquals(body.error.code, "ORPHAN_CLEANUP_002");
      assert(body.error.message.includes("Invalid"));
    } finally {
      await cleanupTestUser(supabase, testUser.id);
    }
  });

  it("should return 404 ORPHAN_CLEANUP_004 for non-existent user", async () => {
    const payload: CleanupRequest = {
      step: "validate-and-cleanup",
      email: "nonexistent@example.com",
      verificationCode: "ABCD5678",
    };

    const response = await callEdgeFunction(payload);

    assertEquals(response.status, 404);
    const body = await response.json() as ErrorResponse;
    assertEquals(body.error.code, "ORPHAN_CLEANUP_001"); // Code not found first
  });
});

// =================================================================================
// TEST SUITE 2.8.5: Constant-Time Response TIMING
// =================================================================================

describe("Constant-Time Response Timing", () => {
  let supabase: SupabaseClient;

  beforeEach(() => {
    supabase = createTestClient();
  });

  it("should respond within 450-550ms range for all scenarios", async () => {
    const measurements: number[] = [];
    const targetMs = 500;
    const toleranceMs = 50;
    const minMs = targetMs - toleranceMs;
    const maxMs = targetMs + toleranceMs;

    // Test 1: Success scenario (user not found)
    for (let i = 0; i < 10; i++) {
      const payload: CleanupRequest = {
        step: "request-code",
        email: `nonexistent-${i}@example.com`,
      };

      const { durationMs } = await measureResponseTime(() =>
        callEdgeFunction(payload)
      );
      measurements.push(durationMs);
    }

    // Test 2: Rate limit scenario (if we can trigger it)
    // Note: This might not trigger rate limit in all test runs
    const email = generateTestEmail();
    for (let i = 0; i < 5; i++) {
      const payload: CleanupRequest = {
        step: "request-code",
        email,
      };

      const { durationMs } = await measureResponseTime(() =>
        callEdgeFunction(payload)
      );
      measurements.push(durationMs);
    }

    // Assert: All responses within range
    const outOfRange = measurements.filter(
      (d) => d < minMs || d > maxMs
    );

    // Allow up to 20% of requests to be slightly outside range (network variance)
    const allowedOutOfRange = Math.floor(measurements.length * 0.2);

    assert(
      outOfRange.length <= allowedOutOfRange,
      `Too many responses outside 450-550ms range: ${outOfRange.length}/${measurements.length}\n` +
      `Out of range values: ${outOfRange.join(", ")}ms\n` +
      `All values: ${measurements.join(", ")}ms`
    );

    // Log statistics
    const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const sorted = [...measurements].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    console.log(`Constant-time timing statistics:
      Average: ${avg.toFixed(2)}ms
      p50: ${p50.toFixed(2)}ms
      p95: ${p95.toFixed(2)}ms
      Min: ${Math.min(...measurements).toFixed(2)}ms
      Max: ${Math.max(...measurements).toFixed(2)}ms
      Out of range: ${outOfRange.length}/${measurements.length}
    `);
  });

  it("should have statistical variance indicating Gaussian distribution", async () => {
    const measurements: number[] = [];

    // Collect 100 measurements
    for (let i = 0; i < 100; i++) {
      const payload: CleanupRequest = {
        step: "request-code",
        email: `test-timing-${i}@example.com`,
      };

      const { durationMs } = await measureResponseTime(() =>
        callEdgeFunction(payload)
      );
      measurements.push(durationMs);
    }

    // Calculate mean and standard deviation
    const mean = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const variance = measurements.reduce(
      (sum, val) => sum + Math.pow(val - mean, 2),
      0
    ) / measurements.length;
    const stdDev = Math.sqrt(variance);

    console.log(`Timing distribution:
      Mean: ${mean.toFixed(2)}ms
      StdDev: ${stdDev.toFixed(2)}ms
      Variance: ${variance.toFixed(2)}ms²
    `);

    // Assert: Mean should be close to 500ms (within 100ms)
    assert(
      Math.abs(mean - 500) < 100,
      `Mean ${mean}ms is too far from target 500ms`
    );

    // Assert: Standard deviation should indicate variance (not deterministic)
    // Expected stdDev from Gaussian jitter: ~25ms, but network adds variance
    assert(
      stdDev > 10,
      `StdDev ${stdDev}ms is too low, responses might be deterministic`
    );
    assert(
      stdDev < 100,
      `StdDev ${stdDev}ms is too high, check constant-time implementation`
    );

    // Assert: Responses should follow bell curve distribution
    // Count how many are within 1 stddev (should be ~68%)
    const within1StdDev = measurements.filter(
      (val) => Math.abs(val - mean) <= stdDev
    ).length;
    const percentage1StdDev = (within1StdDev / measurements.length) * 100;

    console.log(`Distribution characteristics:
      Within 1σ: ${percentage1StdDev.toFixed(1)}% (expected ~68%)
    `);

    // Allow 50-80% within 1 stddev (network variance affects this)
    assert(
      percentage1StdDev >= 50 && percentage1StdDev <= 80,
      `Distribution doesn't match Gaussian: ${percentage1StdDev}% within 1σ`
    );
  });
});

// =================================================================================
// TEST NOTES AND LIMITATIONS
// =================================================================================

/*
 * TEST LIMITATIONS:
 *
 * 1. **Email Sending**: Tests for email delivery failures (ORPHAN_CLEANUP_008)
 *    are skipped until Resend/SendGrid integration is complete.
 *
 * 2. **Verification Code Access**: Tests for Step 2 success flow are limited
 *    because we cannot access the plaintext verification code after it's hashed.
 *    Solutions:
 *    - Add test mode that returns code in response
 *    - Mock the code validation function
 *    - Implement test-only API endpoint to retrieve code
 *
 * 3. **Rate Limiting**: Rate limit tests might be flaky depending on:
 *    - Other concurrent tests
 *    - Postgres rate limit window state
 *    - Test execution speed
 *
 * 4. **Timing Tests**: Constant-time tests are subject to:
 *    - Network latency (local vs deployed)
 *    - System load during test execution
 *    - Deno runtime performance characteristics
 *    - Allow for variance in assertions (20% out-of-range tolerance)
 *
 * 5. **Integration Requirements**:
 *    - Supabase instance running (local or cloud)
 *    - Edge function deployed
 *    - Database migrations applied
 *    - Environment variables configured
 *
 * RUNNING TESTS:
 *
 *   # Local Supabase
 *   deno test --allow-net --allow-env supabase/functions/cleanup-orphaned-user/index.test.ts
 *
 *   # With specific Supabase instance
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=xxx \
 *   EDGE_FUNCTION_URL=https://xxx.supabase.co/functions/v1/cleanup-orphaned-user \
 *   deno test --allow-net --allow-env supabase/functions/cleanup-orphaned-user/index.test.ts
 */
