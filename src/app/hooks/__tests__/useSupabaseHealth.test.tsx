/**
 * Tests for useSupabaseHealth hook
 *
 * Covers hook behavior, polling logic, cleanup, and race condition handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";

import { useSupabaseHealth } from "../useSupabaseHealth";
import type { SupabaseHealthResult } from "../useSupabaseHealth";

// Mock the health service with proper async function
const mockCheckSupabaseHealth = vi.fn<[], Promise<SupabaseHealthResult>>();

vi.mock("@/core/supabase/health", async () => {
  return {
    checkSupabaseHealth: async (options?: { timeoutMs?: number }) => {
      return mockCheckSupabaseHealth();
    },
  };
});

// Mock the logger
vi.mock("@/core/logging", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock AuthProvider
const mockAuthContext = {
  isAuthenticated: false,
  user: null,
  isVerified: false,
  orphanCheckFailed: false,
  login: vi.fn(),
  logout: vi.fn(),
  isLoading: false,
  session: null,
};

vi.mock("@/app/providers/auth/AuthProvider", () => ({
  useAuth: () => mockAuthContext,
}));

// Test wrapper component that provides auth context
function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <>{children}</>;
  };
}

describe("useSupabaseHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockAuthContext.isAuthenticated = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Initial health check on mount", () => {
    it("should run health check automatically on mount", async () => {
      mockCheckSupabaseHealth.mockResolvedValue({
        status: "connected",
        timestamp: new Date(),
        latency: 45,
      });

      const { result } = renderHook(() => useSupabaseHealth(), {
        wrapper: createWrapper(),
      });

      // Initially should be loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.healthResult?.status).toBe("checking");

      // Advance timers and wait for health check to complete
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.healthResult?.status).toBe("connected");
      expect(result.current.healthResult?.latency).toBe(45);
      expect(result.current.error).toBeNull();
      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(1);
    });

    it("should not auto-start when autoStart is false", async () => {
      const { result } = renderHook(
        () => useSupabaseHealth({ autoStart: false }),
        {
          wrapper: createWrapper(),
        }
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.healthResult).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(mockCheckSupabaseHealth).not.toHaveBeenCalled();
    });

    it("should handle health check failures gracefully", async () => {
      mockCheckSupabaseHealth.mockResolvedValue({
        status: "disconnected",
        timestamp: new Date(),
        latency: null,
        error: "Network timeout",
      });

      const { result } = renderHook(() => useSupabaseHealth(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.healthResult?.status).toBe("disconnected");
      expect(result.current.healthResult?.error).toBe("Network timeout");
      expect(result.current.error).toBe("Network timeout");
    });
  });

  describe("Polling behavior", () => {
    it("should start polling for authenticated users", async () => {
      mockAuthContext.isAuthenticated = true;

      mockCheckSupabaseHealth.mockResolvedValue({
        status: "connected",
        timestamp: new Date(),
        latency: 50,
      });

      const { result } = renderHook(() => useSupabaseHealth({ pollingInterval: 60000 }), {
        wrapper: createWrapper(),
      });

      // Initial check on mount
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(1);

      // Advance 60 seconds - should trigger polling
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(2);

      // Another 60 seconds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(3);
    });

    it("should not poll for unauthenticated users", async () => {
      mockAuthContext.isAuthenticated = false;

      mockCheckSupabaseHealth.mockResolvedValue({
        status: "connected",
        timestamp: new Date(),
        latency: 50,
      });

      const { result } = renderHook(() => useSupabaseHealth(), {
        wrapper: createWrapper(),
      });

      // Initial check on mount
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(1);

      // Advance 60 seconds - should NOT trigger polling (not authenticated)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(1); // Still just initial check
    });

    it("should use custom polling interval", async () => {
      mockAuthContext.isAuthenticated = true;

      mockCheckSupabaseHealth.mockResolvedValue({
        status: "connected",
        timestamp: new Date(),
        latency: 50,
      });

      const { result } = renderHook(
        () => useSupabaseHealth({ pollingInterval: 120000 }),
        {
          wrapper: createWrapper(),
        }
      );

      // Initial check
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(1);

      // Advance 60 seconds - should NOT trigger (interval is 120s)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(1);

      // Advance another 60 seconds (total 120s) - should trigger
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(2);
    });
  });

  describe("Manual control functions", () => {
    it("should manually retry health check via retry()", async () => {
      mockCheckSupabaseHealth.mockResolvedValue({
        status: "connected",
        timestamp: new Date(),
        latency: 30,
      });

      const { result } = renderHook(() => useSupabaseHealth(), {
        wrapper: createWrapper(),
      });

      // Wait for initial check
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(1);

      // Manual retry
      await act(async () => {
        result.current.retry();
        await vi.runAllTimersAsync();
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(2);
    });

    it("should allow manual startPolling and stopPolling control", async () => {
      mockAuthContext.isAuthenticated = true;

      mockCheckSupabaseHealth.mockResolvedValue({
        status: "connected",
        timestamp: new Date(),
        latency: 40,
      });

      const { result } = renderHook(
        () => useSupabaseHealth({ autoStart: false }),
        {
          wrapper: createWrapper(),
        }
      );

      // No initial check
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockCheckSupabaseHealth).not.toHaveBeenCalled();

      // Manually start polling
      await act(async () => {
        result.current.startPolling();
        await vi.advanceTimersByTimeAsync(0); // Trigger any immediate timers
      });

      // First poll after interval
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(1);

      // Stop polling
      act(() => {
        result.current.stopPolling();
      });

      // Advance time - should NOT trigger another check
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(1); // Still just one
    });
  });

  describe("Cleanup and race condition handling", () => {
    it("should clean up polling on unmount", async () => {
      mockAuthContext.isAuthenticated = true;

      mockCheckSupabaseHealth.mockResolvedValue({
        status: "connected",
        timestamp: new Date(),
        latency: 50,
      });

      const { result, unmount } = renderHook(() => useSupabaseHealth(), {
        wrapper: createWrapper(),
      });

      // Initial check
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(1);

      // Unmount
      unmount();

      // Advance time - should NOT trigger check after unmount
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(1); // No additional calls
    });

    it("should handle race conditions with overlapping checks", async () => {
      let resolveFirst: (value: SupabaseHealthResult) => void;
      let resolveSecond: (value: SupabaseHealthResult) => void;

      const firstPromise = new Promise<SupabaseHealthResult>((resolve) => {
        resolveFirst = resolve;
      });

      const secondPromise = new Promise<SupabaseHealthResult>((resolve) => {
        resolveSecond = resolve;
      });

      // First call returns slow result
      mockCheckSupabaseHealth.mockReturnValueOnce(firstPromise);
      // Second call returns fast result
      mockCheckSupabaseHealth.mockReturnValueOnce(secondPromise);

      const { result } = renderHook(() => useSupabaseHealth(), {
        wrapper: createWrapper(),
      });

      // Wait for initial check to start
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Trigger second check (retry)
      act(() => {
        result.current.retry();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Resolve second check first (fast response)
      await act(async () => {
        resolveSecond!({
          status: "connected",
          timestamp: new Date(),
          latency: 30,
        });
        await Promise.resolve(); // Let promises settle
      });

      // Now resolve first check (slow response)
      await act(async () => {
        resolveFirst!({
          status: "connected",
          timestamp: new Date(),
          latency: 500,
        });
        await Promise.resolve();
      });

      // Should use the latest (second) result, not the first
      // The hook's request ID mechanism should ignore stale results
      expect(result.current.healthResult?.latency).toBe(30);
    });

    it("should not update state after unmount", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mockCheckSupabaseHealth.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                status: "connected",
                timestamp: new Date(),
                latency: 100,
              });
            }, 1000);
          })
      );

      const { unmount } = renderHook(() => useSupabaseHealth(), {
        wrapper: createWrapper(),
      });

      // Unmount before check completes
      unmount();

      // Complete the check
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      // Should not log React warnings about state updates on unmounted component
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Can't perform a React state update")
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("State transitions", () => {
    it("should transition through checking -> connected states", async () => {
      mockCheckSupabaseHealth.mockResolvedValue({
        status: "connected",
        timestamp: new Date(),
        latency: 45,
      });

      const { result } = renderHook(() => useSupabaseHealth(), {
        wrapper: createWrapper(),
      });

      // Should start in checking state
      expect(result.current.healthResult?.status).toBe("checking");
      expect(result.current.isLoading).toBe(true);

      // Wait for completion
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Should transition to connected
      expect(result.current.healthResult?.status).toBe("connected");
      expect(result.current.isLoading).toBe(false);
    });

    it("should transition through checking -> disconnected states", async () => {
      mockCheckSupabaseHealth.mockResolvedValue({
        status: "disconnected",
        timestamp: new Date(),
        latency: null,
        error: "Timeout",
      });

      const { result } = renderHook(() => useSupabaseHealth(), {
        wrapper: createWrapper(),
      });

      // Should start in checking state
      expect(result.current.healthResult?.status).toBe("checking");

      // Wait for completion
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Should transition to disconnected
      expect(result.current.healthResult?.status).toBe("disconnected");
      expect(result.current.error).toBe("Timeout");
    });
  });

  describe("Authentication state changes", () => {
    it("should start polling when user becomes authenticated", async () => {
      mockAuthContext.isAuthenticated = false;

      mockCheckSupabaseHealth.mockResolvedValue({
        status: "connected",
        timestamp: new Date(),
        latency: 50,
      });

      const { result, rerender } = renderHook(() => useSupabaseHealth(), {
        wrapper: createWrapper(),
      });

      // Initial check (no polling)
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(1);

      // User logs in
      mockAuthContext.isAuthenticated = true;

      // Force re-render to trigger useEffect
      rerender();

      // Polling should start - wait for interval
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(2);
    });

    it("should stop polling when user logs out", async () => {
      mockAuthContext.isAuthenticated = true;

      mockCheckSupabaseHealth.mockResolvedValue({
        status: "connected",
        timestamp: new Date(),
        latency: 50,
      });

      const { result, rerender } = renderHook(() => useSupabaseHealth(), {
        wrapper: createWrapper(),
      });

      // Initial check and polling starts
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(1);

      // Confirm polling is working
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(2);

      // User logs out
      mockAuthContext.isAuthenticated = false;
      rerender();

      // Advance time - polling should stop
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      // Should still be 2 (no new calls after logout)
      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(2);
    });
  });
});
