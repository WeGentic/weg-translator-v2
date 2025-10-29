/**
 * Integration tests for login flow with orphan detection
 *
 * Tests AuthProvider login method with REAL orphan detection logic and mocked
 * Supabase database responses. These tests verify the integration between:
 * - AuthProvider.login() orchestration
 * - orphanDetection.ts utility (REAL, not mocked)
 * - Supabase database queries (mocked responses)
 * - Error handling (OrphanedUserError, OrphanDetectionError)
 *
 * Key differences from unit tests:
 * - Uses REAL orphan detection utility with retry logic
 * - Mocks Supabase database responses (not the detection utility)
 * - Tests integration of components working together
 * - Verifies retry behavior and timeout handling
 *
 * Related Files:
 * - AuthProvider.tsx: Login flow orchestration
 * - orphanDetection.ts: Orphan detection with retry logic (REAL in these tests)
 * - OrphanedUserError.ts, OrphanDetectionError.ts: Custom error classes
 * - cleanupInitiation.ts: Cleanup flow initiation (mocked)
 *
 * Requirements Satisfied:
 * - Task 5.9: Login integration tests (orphan scenarios)
 * - Phase 5: Testing and validation
 * - Req 4 (Enhanced Login Flow with Orphan Handling)
 */

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";

import { AuthProvider, useAuth } from "@/app/providers/auth/AuthProvider";

// Hoist mocks using vi.hoisted()
const { mockSupabase, mockInitiateCleanupFlow, mockToast, mockLogger } = vi.hoisted(() => {
  return {
    mockSupabase: {
      auth: {
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(),
      },
      from: vi.fn(),
    },
    mockInitiateCleanupFlow: vi.fn().mockResolvedValue(undefined),
    mockToast: vi.fn(),
    mockLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

// Setup mocks - NOTE: We do NOT mock orphanDetection to test integration
vi.mock("@/core/config/supabaseClient", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/modules/auth/utils/cleanupInitiation", () => ({
  initiateCleanupFlow: mockInitiateCleanupFlow,
}));

vi.mock("@/shared/ui/toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/core/logging", () => ({
  logger: mockLogger,
}));

vi.mock("@/core/ipc/db/users", () => ({
  getUserProfile: vi.fn().mockResolvedValue(null),
  createUserProfile: vi.fn().mockResolvedValue(undefined),
  updateUserProfile: vi.fn().mockResolvedValue(undefined),
}));

describe("Login Orphan Flow Integration Tests", () => {
  const mockUser = {
    id: "test-user-id-123",
    email: "orphan@example.com",
    email_confirmed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    role: "authenticated",
  };

  const mockSession = {
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    expires_at: Date.now() + 3600000,
    token_type: "bearer" as const,
    user: mockUser,
  };

  // Helper to create database query mock
  const createQueryMock = (data: any) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data,
      error: null,
    } as PostgrestSingleResponse<any>),
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: no active session
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    // Default: auth state change subscription
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    // Default: signOut succeeds
    mockSupabase.auth.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Case 1.2: Verified Orphan Full Flow", () => {
    it("should detect orphaned user with real orphan detection logic", async () => {
      // Mock successful authentication
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      // Mock database queries returning no company data (orphaned)
      mockSupabase.from.mockReturnValue(createQueryMock(null));

      // Render hook
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Attempt login
      let thrownError: any = null;
      await waitFor(async () => {
        try {
          await result.current.login("orphan@example.com", "password123");
        } catch (error) {
          thrownError = error;
        }
      });

      // Verify orphan detection queries were made
      expect(mockSupabase.from).toHaveBeenCalledWith("companies");
      expect(mockSupabase.from).toHaveBeenCalledWith("company_admins");

      // Verify user was signed out
      await waitFor(() => {
        expect(mockSupabase.auth.signOut).toHaveBeenCalled();
      });

      // Verify cleanup flow was initiated
      expect(mockInitiateCleanupFlow).toHaveBeenCalledWith(
        "orphan@example.com",
        expect.any(String) // correlationId
      );

      // Verify toast notification was shown
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Registration Incomplete",
          description: expect.stringContaining("Check your email"),
        })
      );

      // Verify REDIRECT_TO_RECOVERY error was thrown
      expect(thrownError).not.toBeNull();
      expect(thrownError.message).toBe("REDIRECT_TO_RECOVERY");
      expect(thrownError.redirectUrl).toContain("/register/recover");
      expect(thrownError.redirectUrl).toContain(encodeURIComponent("orphan@example.com"));
      expect(thrownError.redirectUrl).toContain("reason=orphaned");
    });

    it("should log orphan detection metrics from real detection", async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      mockSupabase.from.mockReturnValue(createQueryMock(null));

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await waitFor(async () => {
        try {
          await result.current.login("orphan@example.com", "password123");
        } catch (error) {
          // Expected
        }
      });

      // Verify AuthProvider logged orphan detection warning
      await waitFor(() => {
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining("Orphaned user detected during login"),
          expect.objectContaining({
            email: "orphan@example.com",
            userId: mockUser.id,
            classification: "case_1_2",
            correlationId: expect.any(String),
          })
        );
      });

      // Verify redirect event was logged
      await waitFor(() => {
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining("Redirecting orphaned user to recovery route"),
          expect.objectContaining({
            email: "orphan@example.com",
            correlationId: expect.any(String),
            redirectUrl: expect.stringContaining("/register/recover"),
          })
        );
      });
    });
  });

  describe("Detection Timeout Causes Fail-Closed Block", () => {
    it("should retry and eventually fail after timeout", async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      // Mock queries that timeout
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(
          () =>
            new Promise((_, reject) => {
              callCount++;
              setTimeout(() => reject(new Error("Timeout")), 600); // Exceeds 500ms
            })
        ),
      }));

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let thrownError: any = null;
      await waitFor(
        async () => {
          try {
            await result.current.login("orphan@example.com", "password123");
          } catch (error) {
            thrownError = error;
          }
        },
        { timeout: 5000 }
      );

      // Verify 3 retry attempts were made (total 6 calls = 3 attempts * 2 queries)
      await waitFor(() => {
        expect(callCount).toBeGreaterThanOrEqual(6);
      });

      // Verify error was logged
      await waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining("Orphan detection failed"),
          expect.objectContaining({
            correlationId: expect.any(String),
            attemptCount: 3,
          })
        );
      });

      // Verify user was signed out (fail-closed)
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();

      // Verify user-friendly error message
      expect(thrownError).not.toBeNull();
      expect(thrownError.message).toContain("temporarily unavailable");
    });
  });

  describe("Non-Orphaned User Logs In Successfully", () => {
    it("should allow login when user has company data", async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      // Mock database queries returning company data
      let queryCallCount = 0;
      mockSupabase.from.mockImplementation((tableName: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: tableName === "companies" ? { id: "company-123" } : null,
          error: null,
        } as PostgrestSingleResponse<any>),
      }));

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await waitFor(async () => {
        await result.current.login("orphan@example.com", "password123");
      });

      // Verify queries were made
      expect(mockSupabase.from).toHaveBeenCalledWith("companies");
      expect(mockSupabase.from).toHaveBeenCalledWith("company_admins");

      // Verify user was NOT signed out
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      expect(mockSupabase.auth.signOut).not.toHaveBeenCalled();

      // Verify cleanup flow was NOT initiated
      expect(mockInitiateCleanupFlow).not.toHaveBeenCalled();
    });

    it("should allow login when user has admin data", async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      // Mock database queries returning admin data
      mockSupabase.from.mockImplementation((tableName: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data:
            tableName === "company_admins"
              ? { admin_uuid: mockUser.id }
              : null,
          error: null,
        } as PostgrestSingleResponse<any>),
      }));

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await waitFor(async () => {
        await result.current.login("orphan@example.com", "password123");
      });

      // Verify user is authenticated
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Verify signOut was NOT called
      expect(mockSupabase.auth.signOut).not.toHaveBeenCalled();
    });
  });

  describe("Orphan Detection Performance Logging", () => {
    it("should warn when detection is slow (>200ms)", async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      // Mock slow query (250ms delay)
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(
                () =>
                  resolve({
                    data: { id: "company-123" },
                    error: null,
                  } as PostgrestSingleResponse<any>),
                250
              )
            )
        ),
      }));

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await waitFor(async () => {
        await result.current.login("orphan@example.com", "password123");
      });

      // Wait for query to complete
      await waitFor(
        () => {
          expect(result.current.isAuthenticated).toBe(true);
        },
        { timeout: 2000 }
      );

      // Verify warning was logged for slow detection
      await waitFor(() => {
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining("Orphan detection completed"),
          expect.objectContaining({
            totalDurationMs: expect.any(Number),
            performanceTarget: "< 200ms",
            exceededTarget: true,
          })
        );
      });
    });
  });

  describe("Concurrent Login Prevention", () => {
    it("should prevent duplicate concurrent login attempts", async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      mockSupabase.from.mockReturnValue(
        createQueryMock({ id: "company-123" })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Attempt multiple concurrent logins
      const promises = [
        result.current.login("orphan@example.com", "password123"),
        result.current.login("orphan@example.com", "password123"),
        result.current.login("orphan@example.com", "password123"),
      ];

      await waitFor(async () => {
        await Promise.allSettled(promises);
      });

      // Verify signInWithPassword was only called once
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledTimes(1);

      // Verify warning was logged
      await waitFor(() => {
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining("Login already in progress"),
          expect.any(Object)
        );
      });
    });
  });
});
