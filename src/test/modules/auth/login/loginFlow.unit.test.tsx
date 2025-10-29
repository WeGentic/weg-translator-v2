/**
 * Unit tests for login flow with orphan detection behavior
 *
 * Tests AuthProvider.login() behavior with mocked dependencies to verify:
 * - OrphanedUserError handling (sign out + redirect)
 * - OrphanDetectionError handling (fail-closed blocking)
 * - Performance metrics logging
 * - Toast notifications
 *
 * These are unit tests focusing on AuthProvider logic with all dependencies mocked.
 * See loginOrphanFlow.test.tsx for integration tests with real Supabase client.
 *
 * Related Files:
 * - AuthProvider.tsx: Login logic under test
 * - orphanDetection.ts: Mocked orphan detection utility
 * - cleanupInitiation.ts: Mocked cleanup flow initiation
 * - OrphanedUserError.ts, OrphanDetectionError.ts: Custom error classes
 *
 * Requirements Satisfied:
 * - Task 5.8: Login flow unit tests
 * - Phase 5: Testing and validation
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";

import { OrphanedUserError, OrphanDetectionError } from "@/modules/auth/errors";
import type { OrphanCheckResult } from "@/modules/auth/utils/orphanDetection";

// Hoist mocks using vi.hoisted()
const {
  mockSupabase,
  mockToast,
  mockLogger,
  mockCheckIfOrphaned,
  mockInitiateCleanupFlow,
} = vi.hoisted(() => {
  return {
    mockSupabase: {
      auth: {
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(),
      },
    },
    mockToast: vi.fn(),
    mockLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    mockCheckIfOrphaned: vi.fn(),
    mockInitiateCleanupFlow: vi.fn(),
  };
});

// Setup mocks
vi.mock("@/core/config/supabaseClient", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/shared/ui/toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/core/logging", () => ({
  logger: mockLogger,
}));

vi.mock("@/modules/auth/utils/orphanDetection", () => ({
  checkIfOrphaned: mockCheckIfOrphaned,
}));

vi.mock("@/modules/auth/utils/cleanupInitiation", () => ({
  initiateCleanupFlow: mockInitiateCleanupFlow,
}));

// Mock IPC functions
vi.mock("@/core/ipc/db/users", () => ({
  getUserProfile: vi.fn().mockResolvedValue(null),
  createUserProfile: vi.fn().mockResolvedValue(undefined),
  updateUserProfile: vi.fn().mockResolvedValue(undefined),
}));

// Import AuthProvider after mocks are set up
import { AuthProvider, useAuth } from "@/app/providers/auth/AuthProvider";

describe("LoginFlow Unit Tests", () => {
  // Helper to create mock Supabase user
  const createMockUser = (overrides: Partial<SupabaseUser> = {}): SupabaseUser => ({
    id: "test-user-id",
    email: "test@example.com",
    email_confirmed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    role: "authenticated",
    ...overrides,
  });

  const createMockSession = (user: SupabaseUser): Session => ({
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    expires_at: Date.now() + 3600000,
    token_type: "bearer",
    user,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    mockSupabase.auth.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("OrphanedUserError Handling (Case 1.2)", () => {
    it("should sign out user when orphaned user detected", async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);
      const correlationId = "test-correlation-id";

      // Mock successful authentication
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      // Mock orphan detection returning orphaned state
      const orphanResult: OrphanCheckResult = {
        isOrphaned: true,
        classification: "case_1_2",
        hasCompanyData: false,
        hasAdminData: false,
        metrics: {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          totalDurationMs: 150,
          queryDurationMs: 100,
          attemptCount: 1,
          timedOut: false,
          hadError: false,
        },
      };

      mockCheckIfOrphaned.mockResolvedValue(orphanResult);

      // Render hook
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // Wait for initial load
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Attempt login
      await act(async () => {
        try {
          await result.current.login("test@example.com", "password123");
        } catch (error) {
          // Expected to throw redirect error
        }
      });

      // Verify signOut was called
      expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1);

      // Verify user state is cleared
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it("should initiate cleanup flow when orphaned user detected", async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);
      const correlationId = "test-correlation-id";

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const orphanResult: OrphanCheckResult = {
        isOrphaned: true,
        classification: "case_1_2",
        hasCompanyData: false,
        hasAdminData: false,
        metrics: {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          totalDurationMs: 180,
          queryDurationMs: 120,
          attemptCount: 1,
          timedOut: false,
          hadError: false,
          correlationId,
        },
      };

      mockCheckIfOrphaned.mockResolvedValue(orphanResult);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        try {
          await result.current.login("test@example.com", "password123");
        } catch (error) {
          // Expected
        }
      });

      // Verify cleanup flow was initiated (fire-and-forget)
      expect(mockInitiateCleanupFlow).toHaveBeenCalledWith(
        "test@example.com",
        correlationId
      );
    });

    it("should show toast notification for orphaned user", async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const orphanResult: OrphanCheckResult = {
        isOrphaned: true,
        classification: "case_1_2",
        hasCompanyData: false,
        hasAdminData: false,
        metrics: {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          totalDurationMs: 120,
          queryDurationMs: 90,
          attemptCount: 1,
          timedOut: false,
          hadError: false,
          correlationId: "test-correlation-id",
        },
      };

      mockCheckIfOrphaned.mockResolvedValue(orphanResult);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        try {
          await result.current.login("test@example.com", "password123");
        } catch (error) {
          // Expected
        }
      });

      // Verify toast was called with correct parameters
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Registration Incomplete",
          description: expect.stringContaining("Check your email"),
          variant: "default",
          duration: 8000,
        })
      );
    });

    it("should throw REDIRECT_TO_RECOVERY error for orphaned user", async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);
      const correlationId = "test-correlation-id";

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const orphanResult: OrphanCheckResult = {
        isOrphaned: true,
        classification: "case_1_2",
        hasCompanyData: false,
        hasAdminData: false,
        metrics: {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          totalDurationMs: 140,
          queryDurationMs: 100,
          attemptCount: 1,
          timedOut: false,
          hadError: false,
          correlationId,
        },
      };

      mockCheckIfOrphaned.mockResolvedValue(orphanResult);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let thrownError: Error | null = null;

      await act(async () => {
        try {
          await result.current.login("test@example.com", "password123");
        } catch (error) {
          thrownError = error as Error;
        }
      });

      // Verify redirect error was thrown
      expect(thrownError).not.toBeNull();
      expect(thrownError?.message).toBe("REDIRECT_TO_RECOVERY");
      expect((thrownError as any)?.redirectUrl).toContain("/register/recover");
      expect((thrownError as any)?.redirectUrl).toContain(
        encodeURIComponent("test@example.com")
      );
      expect((thrownError as any)?.redirectUrl).toContain("reason=orphaned");
      expect((thrownError as any)?.redirectUrl).toContain(correlationId);
    });
  });

  describe("OrphanDetectionError Handling (Fail-Closed)", () => {
    it("should sign out user when orphan detection fails", async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      // Mock orphan detection failing with OrphanDetectionError
      const detectionError = new OrphanDetectionError(
        "Orphan detection failed after all retry attempts",
        "test-correlation-id",
        {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          totalDurationMs: 2200,
          queryDurationMs: 1500,
          attemptCount: 3,
          timedOut: true,
          hadError: false,
        }
      );

      mockCheckIfOrphaned.mockRejectedValue(detectionError);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        try {
          await result.current.login("test@example.com", "password123");
        } catch (error) {
          // Expected
        }
      });

      // Verify signOut was called (fail-closed: block access)
      expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1);

      // Verify user state is cleared
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it("should log error metrics when orphan detection fails", async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const correlationId = "test-correlation-id";
      const detectionError = new OrphanDetectionError(
        "Orphan detection failed after all retry attempts",
        correlationId,
        {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          totalDurationMs: 2100,
          queryDurationMs: 1400,
          attemptCount: 3,
          timedOut: false,
          hadError: true,
        }
      );

      mockCheckIfOrphaned.mockRejectedValue(detectionError);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        try {
          await result.current.login("test@example.com", "password123");
        } catch (error) {
          // Expected
        }
      });

      // Verify error was logged with full metrics
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Orphan detection failed"),
        expect.objectContaining({
          correlationId,
          attemptCount: 3,
          metrics: expect.objectContaining({
            totalDurationMs: 2100,
            queryDurationMs: 1400,
            timedOut: false,
            hadError: true,
          }),
        })
      );
    });

    it("should throw user-friendly error message when orphan detection fails", async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const detectionError = new OrphanDetectionError(
        "Orphan detection failed after all retry attempts",
        "test-correlation-id",
        {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          totalDurationMs: 2200,
          queryDurationMs: 1500,
          attemptCount: 3,
          timedOut: true,
          hadError: false,
        }
      );

      mockCheckIfOrphaned.mockRejectedValue(detectionError);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let thrownError: Error | null = null;

      await act(async () => {
        try {
          await result.current.login("test@example.com", "password123");
        } catch (error) {
          thrownError = error as Error;
        }
      });

      // Verify user-friendly error message
      expect(thrownError).not.toBeNull();
      expect(thrownError?.message).toContain("Authentication system is temporarily unavailable");
      expect(thrownError?.message).toContain("try again in a few minutes");
      expect(thrownError?.message).toContain("contact support");
    });
  });

  describe("Performance Metrics Logging", () => {
    it("should log info when orphan detection is fast (<200ms)", async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const orphanResult: OrphanCheckResult = {
        isOrphaned: false,
        classification: null,
        hasCompanyData: true,
        hasAdminData: false,
        metrics: {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          totalDurationMs: 150, // Fast!
          queryDurationMs: 120,
          attemptCount: 1,
          timedOut: false,
          hadError: false,
          correlationId: "test-correlation-id",
        },
      };

      mockCheckIfOrphaned.mockResolvedValue(orphanResult);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.login("test@example.com", "password123");
      });

      // Verify info log (not warning)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Orphan detection completed"),
        expect.objectContaining({
          totalDurationMs: 150,
        })
      );

      // Should NOT log warning
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining("exceeded p95 target"),
        expect.any(Object)
      );
    });

    it("should log warning when orphan detection is slow (>200ms)", async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const orphanResult: OrphanCheckResult = {
        isOrphaned: false,
        classification: null,
        hasCompanyData: true,
        hasAdminData: false,
        metrics: {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          totalDurationMs: 350, // Slow!
          queryDurationMs: 300,
          attemptCount: 1,
          timedOut: false,
          hadError: false,
          correlationId: "test-correlation-id",
        },
      };

      mockCheckIfOrphaned.mockResolvedValue(orphanResult);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.login("test@example.com", "password123");
      });

      // Verify warning log
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Orphan detection completed"),
        expect.objectContaining({
          totalDurationMs: 350,
          performanceTarget: "< 200ms",
          exceededTarget: true,
        })
      );
    });

    it("should log p95 latency warning when detection is very slow (>500ms)", async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const orphanResult: OrphanCheckResult = {
        isOrphaned: false,
        classification: null,
        hasCompanyData: true,
        hasAdminData: false,
        metrics: {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          totalDurationMs: 650, // Very slow!
          queryDurationMs: 600,
          attemptCount: 1,
          timedOut: false,
          hadError: false,
          correlationId: "test-correlation-id",
        },
      };

      mockCheckIfOrphaned.mockResolvedValue(orphanResult);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.login("test@example.com", "password123");
      });

      // Verify p95 latency warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("exceeded p95 latency target"),
        expect.objectContaining({
          totalDurationMs: 650,
          p95Target: 100,
          p99Target: 200,
          exceededBy: 650 - 200,
        })
      );
    });
  });

  describe("Non-Orphaned User Login Success", () => {
    it("should allow login when user is not orphaned", async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const orphanResult: OrphanCheckResult = {
        isOrphaned: false,
        classification: null,
        hasCompanyData: true,
        hasAdminData: true,
        metrics: {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          totalDurationMs: 120,
          queryDurationMs: 90,
          attemptCount: 1,
          timedOut: false,
          hadError: false,
          correlationId: "test-correlation-id",
        },
      };

      mockCheckIfOrphaned.mockResolvedValue(orphanResult);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.login("test@example.com", "password123");
      });

      // Verify user is authenticated
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).not.toBeNull();
      expect(result.current.user?.email).toBe("test@example.com");

      // Verify signOut was NOT called
      expect(mockSupabase.auth.signOut).not.toHaveBeenCalled();
    });

    it("should not initiate cleanup flow for non-orphaned user", async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const orphanResult: OrphanCheckResult = {
        isOrphaned: false,
        classification: null,
        hasCompanyData: true,
        hasAdminData: false,
        metrics: {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          totalDurationMs: 100,
          queryDurationMs: 80,
          attemptCount: 1,
          timedOut: false,
          hadError: false,
          correlationId: "test-correlation-id",
        },
      };

      mockCheckIfOrphaned.mockResolvedValue(orphanResult);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.login("test@example.com", "password123");
      });

      // Verify cleanup flow was NOT initiated
      expect(mockInitiateCleanupFlow).not.toHaveBeenCalled();
    });
  });

  describe("Unverified Email Blocking (Case 1.1)", () => {
    it("should block login for unverified email before orphan detection", async () => {
      const mockUser = createMockUser({
        email_confirmed_at: null, // Unverified!
      });
      const mockSession = createMockSession(mockUser);

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let thrownError: Error | null = null;

      await act(async () => {
        try {
          await result.current.login("test@example.com", "password123");
        } catch (error) {
          thrownError = error as Error;
        }
      });

      // Verify login was blocked
      expect(thrownError).not.toBeNull();
      expect(thrownError?.message).toContain("verify your email");

      // Verify signOut was called
      expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1);

      // Verify orphan detection was NOT called (blocked before detection)
      expect(mockCheckIfOrphaned).not.toHaveBeenCalled();
    });
  });
});
