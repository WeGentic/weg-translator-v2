/**
 * Performance tests for Supabase health check system
 *
 * Tests timing, throughput, polling stability, and resource management.
 * Validates NFR-006 performance requirements.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

import { checkSupabaseHealth } from "../health";
import { supabase } from "@/core/config/supabaseClient";
import { useSupabaseHealth } from "@/app/hooks/useSupabaseHealth";

// Mock the Supabase client
vi.mock("@/core/config/supabaseClient", () => ({
  supabase: {
    from: vi.fn(),
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

// Mock the logger
vi.mock("@/core/logging", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("Health check performance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockAuthContext.isAuthenticated = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Query response time (NFR-001: < 500ms)", () => {
    it("should complete health check within 500ms under normal conditions", async () => {
      // Mock fast Supabase response (50ms)
      const mockSelect = vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockImplementation(
            () =>
              new Promise((resolve) => {
                setTimeout(() => {
                  resolve({ data: { id: 1 }, error: null });
                }, 50);
              })
          ),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const startTime = performance.now();
      const resultPromise = checkSupabaseHealth();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });

      const result = await resultPromise;
      const endTime = performance.now();
      const actualDuration = endTime - startTime;

      // Verify result is successful
      expect(result.status).toBe("connected");

      // Verify latency is under 500ms
      expect(result.latency).toBeLessThan(500);

      // Verify actual test execution time (with tolerance for test overhead)
      expect(actualDuration).toBeLessThan(600);
    });

    it("should report latency accurately for sub-100ms queries", async () => {
      const testLatencies = [25, 50, 75, 100, 150, 200, 300, 450];

      for (const targetLatency of testLatencies) {
        vi.clearAllMocks();

        const mockSelect = vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockImplementation(
              () =>
                new Promise((resolve) => {
                  setTimeout(() => {
                    resolve({ data: { id: 1 }, error: null });
                  }, targetLatency);
                })
            ),
          }),
        });

        vi.mocked(supabase.from).mockReturnValue({
          select: mockSelect,
        } as any);

        const resultPromise = checkSupabaseHealth();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(targetLatency);
        });

        const result = await resultPromise;

        // Latency should be within 50ms tolerance
        expect(result.latency).toBeGreaterThanOrEqual(targetLatency - 50);
        expect(result.latency).toBeLessThanOrEqual(targetLatency + 50);
        expect(result.status).toBe("connected");
      }
    });
  });

  describe("Timeout enforcement (NFR-002: 3 seconds)", () => {
    it("should trigger timeout at exactly 3 seconds", async () => {
      // Mock very slow query (10 seconds)
      const mockSelect = vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockImplementation(
            () =>
              new Promise((resolve) => {
                setTimeout(() => {
                  resolve({ data: { id: 1 }, error: null });
                }, 10000);
              })
          ),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const startTime = performance.now();
      const resultPromise = checkSupabaseHealth();

      // Advance exactly 3 seconds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      const result = await resultPromise;
      const endTime = performance.now();

      // Should timeout with disconnected status
      expect(result.status).toBe("disconnected");
      expect(result.error).toContain("timeout");
      expect(result.error).toContain("3000ms");
      expect(result.latency).toBeNull();

      // Execution time should be close to 3 seconds (with test overhead tolerance)
      const duration = endTime - startTime;
      expect(duration).toBeGreaterThanOrEqual(2900);
      expect(duration).toBeLessThanOrEqual(3200);
    });

    it("should respect custom timeout values", async () => {
      const customTimeouts = [1000, 2000, 5000, 10000];

      for (const timeout of customTimeouts) {
        vi.clearAllMocks();

        const mockSelect = vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockImplementation(
              () =>
                new Promise((resolve) => {
                  // Query that takes longer than timeout
                  setTimeout(() => {
                    resolve({ data: { id: 1 }, error: null });
                  }, timeout + 1000);
                })
            ),
          }),
        });

        vi.mocked(supabase.from).mockReturnValue({
          select: mockSelect,
        } as any);

        const resultPromise = checkSupabaseHealth({ timeoutMs: timeout });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(timeout);
        });

        const result = await resultPromise;

        expect(result.status).toBe("disconnected");
        expect(result.error).toContain(`${timeout}ms`);
      }
    });
  });

  describe("Polling interval stability (NFR-003: 60 seconds)", () => {
    it("should maintain 60-second polling cadence without drift", async () => {
      mockAuthContext.isAuthenticated = true;

      const callTimestamps: number[] = [];

      const mockCheckSupabaseHealth = vi.fn().mockImplementation(async () => {
        callTimestamps.push(Date.now());
        return {
          status: "connected",
          timestamp: new Date(),
          latency: 50,
        };
      });

      vi.doMock("@/core/supabase/health", () => ({
        checkSupabaseHealth: mockCheckSupabaseHealth,
      }));

      const { result } = renderHook(() => useSupabaseHealth({ pollingInterval: 60000 }), {
        wrapper: ({ children }) => <>{children}</>,
      });

      // Initial check
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Run 10 polling cycles (10 minutes)
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(60000);
        });
      }

      // Verify 11 total calls (1 initial + 10 polls)
      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(11);

      // Verify intervals between calls are consistent (60 seconds ± 100ms tolerance)
      for (let i = 1; i < callTimestamps.length; i++) {
        const interval = callTimestamps[i] - callTimestamps[i - 1];
        expect(interval).toBeGreaterThanOrEqual(59900);
        expect(interval).toBeLessThanOrEqual(60100);
      }
    });

    it("should not accumulate drift over extended polling (10 minutes)", async () => {
      mockAuthContext.isAuthenticated = true;

      let checkCount = 0;
      const mockCheckSupabaseHealth = vi.fn().mockImplementation(async () => {
        checkCount++;
        return {
          status: "connected",
          timestamp: new Date(),
          latency: 50,
        };
      });

      vi.doMock("@/core/supabase/health", () => ({
        checkSupabaseHealth: mockCheckSupabaseHealth,
      }));

      const startTime = Date.now();

      renderHook(() => useSupabaseHealth({ pollingInterval: 60000 }), {
        wrapper: ({ children }) => <>{children}</>,
      });

      // Initial check
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Advance 10 minutes (600 seconds)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600000);
      });

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should have 11 calls: 1 initial + 10 polls (one every 60s for 600s)
      expect(checkCount).toBe(11);

      // Total elapsed time should be close to 600 seconds (with tolerance)
      expect(elapsed).toBeGreaterThanOrEqual(595000);
      expect(elapsed).toBeLessThanOrEqual(605000);
    });

    it("should maintain different polling intervals independently", async () => {
      mockAuthContext.isAuthenticated = true;

      const calls30s: number[] = [];
      const calls60s: number[] = [];
      const calls120s: number[] = [];

      const mockCheckSupabaseHealth = vi.fn().mockImplementation(async () => ({
        status: "connected",
        timestamp: new Date(),
        latency: 50,
      }));

      vi.doMock("@/core/supabase/health", () => ({
        checkSupabaseHealth: mockCheckSupabaseHealth,
      }));

      // Create hooks with different intervals
      const { result: hook30 } = renderHook(
        () => useSupabaseHealth({ pollingInterval: 30000 }),
        { wrapper: ({ children }) => <>{children}</> }
      );

      const { result: hook60 } = renderHook(
        () => useSupabaseHealth({ pollingInterval: 60000 }),
        { wrapper: ({ children }) => <>{children}</> }
      );

      const { result: hook120 } = renderHook(
        () => useSupabaseHealth({ pollingInterval: 120000 }),
        { wrapper: ({ children }) => <>{children}</> }
      );

      // Initial checks
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Advance 240 seconds (4 minutes)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(240000);
      });

      // 30s interval: 1 + 8 = 9 calls (every 30s for 240s)
      // 60s interval: 1 + 4 = 5 calls (every 60s for 240s)
      // 120s interval: 1 + 2 = 3 calls (every 120s for 240s)
      // Total: 9 + 5 + 3 = 17 calls

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(17);
    });
  });

  describe("Concurrent health checks efficiency", () => {
    it("should handle multiple concurrent checks without blocking", async () => {
      const queryDurations = [100, 50, 150, 75, 200];
      let callCount = 0;

      const mockSelect = vi.fn().mockImplementation(() => ({
        limit: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockImplementation(() => {
            const duration = queryDurations[callCount % queryDurations.length];
            callCount++;
            return new Promise((resolve) => {
              setTimeout(() => {
                resolve({ data: { id: 1 }, error: null });
              }, duration);
            });
          }),
        }),
      }));

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      // Start 5 concurrent health checks
      const checks = Array.from({ length: 5 }, () => checkSupabaseHealth());

      // Advance enough time for all to complete
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      const results = await Promise.all(checks);

      // All checks should succeed
      results.forEach((result) => {
        expect(result.status).toBe("connected");
        expect(result.latency).toBeLessThan(300);
      });

      // All 5 checks should have been made
      expect(supabase.from).toHaveBeenCalledTimes(5);
    });

    it("should not cause race conditions with rapid sequential checks", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 1 },
            error: null,
          }),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      // Fire 20 rapid sequential checks
      const results = [];
      for (let i = 0; i < 20; i++) {
        results.push(checkSupabaseHealth());
      }

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      const settled = await Promise.all(results);

      // All should succeed independently
      settled.forEach((result) => {
        expect(result.status).toBe("connected");
      });

      expect(supabase.from).toHaveBeenCalledTimes(20);
    });
  });

  describe("Memory and resource management", () => {
    it("should not leak memory during extended polling", async () => {
      mockAuthContext.isAuthenticated = true;

      const mockCheckSupabaseHealth = vi.fn().mockResolvedValue({
        status: "connected",
        timestamp: new Date(),
        latency: 50,
      });

      vi.doMock("@/core/supabase/health", () => ({
        checkSupabaseHealth: mockCheckSupabaseHealth,
      }));

      const { result, unmount } = renderHook(
        () => useSupabaseHealth({ pollingInterval: 60000 }),
        { wrapper: ({ children }) => <>{children}</> }
      );

      // Initial check
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Simulate 1 hour of polling (60 checks)
      for (let i = 0; i < 60; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(60000);
        });
      }

      // Should have 1 + 60 = 61 calls
      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(61);

      // Unmount should clean up without errors
      unmount();

      // After unmount, advancing time should not trigger more checks
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(61); // Still 61, no new calls
    });

    it("should clean up pending timers on unmount", async () => {
      mockAuthContext.isAuthenticated = true;

      const mockCheckSupabaseHealth = vi.fn().mockResolvedValue({
        status: "connected",
        timestamp: new Date(),
        latency: 50,
      });

      vi.doMock("@/core/supabase/health", () => ({
        checkSupabaseHealth: mockCheckSupabaseHealth,
      }));

      const { unmount } = renderHook(
        () => useSupabaseHealth({ pollingInterval: 60000 }),
        { wrapper: ({ children }) => <>{children}</> }
      );

      // Initial check
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(1);

      // Unmount immediately (before first poll)
      unmount();

      // Advance past several polling intervals
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300000); // 5 minutes
      });

      // Should still be only 1 call (from initial check)
      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(1);
    });

    it("should handle rapid mount/unmount cycles without leaks", async () => {
      mockAuthContext.isAuthenticated = true;

      const mockCheckSupabaseHealth = vi.fn().mockResolvedValue({
        status: "connected",
        timestamp: new Date(),
        latency: 50,
      });

      vi.doMock("@/core/supabase/health", () => ({
        checkSupabaseHealth: mockCheckSupabaseHealth,
      }));

      // Rapidly mount and unmount 10 times
      for (let i = 0; i < 10; i++) {
        const { unmount } = renderHook(
          () => useSupabaseHealth({ pollingInterval: 60000 }),
          { wrapper: ({ children }) => <>{children}</> }
        );

        await act(async () => {
          await vi.runAllTimersAsync();
        });

        unmount();
      }

      // Should have 10 initial checks (one per mount)
      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(10);

      // Advance time - no orphaned timers should fire
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      // Still just 10 calls
      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(10);
    });
  });

  describe("Performance under load", () => {
    it("should maintain performance with slow network conditions", async () => {
      // Simulate slow but consistent network (400ms responses)
      const mockSelect = vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockImplementation(
            () =>
              new Promise((resolve) => {
                setTimeout(() => {
                  resolve({ data: { id: 1 }, error: null });
                }, 400);
              })
          ),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const resultPromise = checkSupabaseHealth();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

      const result = await resultPromise;

      // Should still complete successfully under 500ms target
      expect(result.status).toBe("connected");
      expect(result.latency).toBeGreaterThanOrEqual(350);
      expect(result.latency).toBeLessThan(500);
    });

    it("should timeout gracefully when query exceeds limit", async () => {
      // Simulate query that takes 5 seconds
      const mockSelect = vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockImplementation(
            () =>
              new Promise((resolve) => {
                setTimeout(() => {
                  resolve({ data: { id: 1 }, error: null });
                }, 5000);
              })
          ),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const startTime = performance.now();
      const resultPromise = checkSupabaseHealth();

      // Should timeout at 3 seconds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      const result = await resultPromise;
      const duration = performance.now() - startTime;

      expect(result.status).toBe("disconnected");
      expect(result.error).toContain("timeout");

      // Should not wait full 5 seconds
      expect(duration).toBeLessThan(3500);
    });
  });
});
