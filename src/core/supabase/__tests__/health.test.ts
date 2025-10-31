/**
 * Supabase Health Check Service Tests
 *
 * Tests cover success scenarios, timeout handling, error cases, and edge conditions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkSupabaseHealth, isHealthy, formatLatency } from "../health";
import { supabase } from "@/core/config/supabaseClient";

// Mock the Supabase client
vi.mock("@/core/config/supabaseClient", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe("checkSupabaseHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return connected status on successful query", async () => {
    // Mock successful Supabase query
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

    // Execute health check
    const resultPromise = checkSupabaseHealth();

    // Fast-forward timers slightly to allow query to complete
    await vi.advanceTimersByTimeAsync(100);

    const result = await resultPromise;

    // Verify connected status
    expect(result.status).toBe("connected");
    expect(result.latency).toBeGreaterThanOrEqual(0);
    expect(result.latency).toBeLessThan(1000);
    expect(result.error).toBeNull();
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // Verify query was called correctly
    expect(supabase.from).toHaveBeenCalledWith("health_check");
    expect(mockSelect).toHaveBeenCalledWith("id");
  });

  it("should return disconnected status on timeout", async () => {
    // Mock slow query that takes longer than timeout
    const mockSelect = vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(() => {
                resolve({ data: { id: 1 }, error: null });
              }, 5000); // 5 seconds - longer than 3 second timeout
            })
        ),
      }),
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    } as any);

    // Execute health check with default 3 second timeout
    const resultPromise = checkSupabaseHealth();

    // Fast-forward past the timeout
    await vi.advanceTimersByTimeAsync(3000);

    const result = await resultPromise;

    // Verify disconnected status due to timeout
    expect(result.status).toBe("disconnected");
    expect(result.latency).toBeNull();
    expect(result.error).toContain("timeout");
    expect(result.error).toContain("3000ms");
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("should respect custom timeout configuration", async () => {
    // Mock slow query
    const mockSelect = vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(() => {
                resolve({ data: { id: 1 }, error: null });
              }, 6000); // 6 seconds
            })
        ),
      }),
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    } as any);

    // Execute health check with custom 5 second timeout
    const resultPromise = checkSupabaseHealth({ timeoutMs: 5000 });

    // Fast-forward past the custom timeout
    await vi.advanceTimersByTimeAsync(5000);

    const result = await resultPromise;

    // Verify timeout uses custom value
    expect(result.status).toBe("disconnected");
    expect(result.error).toContain("5000ms");
  });

  it("should return disconnected status on network error", async () => {
    // Mock network error
    const mockSelect = vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockRejectedValue(new Error("Network error")),
      }),
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    } as any);

    // Execute health check
    const resultPromise = checkSupabaseHealth();

    // Fast-forward timers to allow error to propagate
    await vi.advanceTimersByTimeAsync(100);

    const result = await resultPromise;

    // Verify disconnected status with error message
    expect(result.status).toBe("disconnected");
    expect(result.latency).toBeNull();
    expect(result.error).toContain("Network error");
  });

  it("should return disconnected status on Supabase error", async () => {
    // Mock Supabase query error
    const mockSelect = vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: {
            message: "Table not found",
            code: "PGRST204",
          },
        }),
      }),
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    } as any);

    // Execute health check
    const resultPromise = checkSupabaseHealth();

    await vi.advanceTimersByTimeAsync(100);

    const result = await resultPromise;

    // Verify disconnected status with Supabase error
    expect(result.status).toBe("disconnected");
    expect(result.latency).toBeNull();
    expect(result.error).toContain("Supabase query error");
    expect(result.error).toContain("Table not found");
    expect(result.error).toContain("PGRST204");
  });

  it("should handle concurrent health checks independently", async () => {
    let callCount = 0;

    // Mock query with incrementing latency
    const mockSelect = vi.fn().mockImplementation(() => ({
      limit: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockImplementation(() => {
          const delay = ++callCount * 100;
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({ data: { id: 1 }, error: null });
            }, delay);
          });
        }),
      }),
    }));

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    } as any);

    // Start two concurrent health checks
    const result1Promise = checkSupabaseHealth();
    const result2Promise = checkSupabaseHealth();

    // Fast-forward to allow both to complete
    await vi.advanceTimersByTimeAsync(300);

    const [result1, result2] = await Promise.all([
      result1Promise,
      result2Promise,
    ]);

    // Both should succeed independently
    expect(result1.status).toBe("connected");
    expect(result2.status).toBe("connected");

    // Latencies should be different (first call faster than second)
    expect(result1.latency).toBeLessThan(result2.latency!);

    // Verify query was called twice
    expect(supabase.from).toHaveBeenCalledTimes(2);
  });

  it("should track latency accurately", async () => {
    // Mock query with specific delay
    const mockSelect = vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(() => {
                resolve({ data: { id: 1 }, error: null });
              }, 250); // 250ms delay
            })
        ),
      }),
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    } as any);

    // Execute health check
    const resultPromise = checkSupabaseHealth();

    // Fast-forward exactly 250ms
    await vi.advanceTimersByTimeAsync(250);

    const result = await resultPromise;

    // Latency should be approximately 250ms (within 50ms tolerance for test timing)
    expect(result.status).toBe("connected");
    expect(result.latency).toBeGreaterThanOrEqual(200);
    expect(result.latency).toBeLessThanOrEqual(300);
  });

  it("should handle null data response gracefully", async () => {
    // Mock query returning null data (no rows found)
    const mockSelect = vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }),
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    } as any);

    // Execute health check
    const resultPromise = checkSupabaseHealth();

    await vi.advanceTimersByTimeAsync(100);

    const result = await resultPromise;

    // Should still be connected even if no data (query succeeded)
    expect(result.status).toBe("connected");
    expect(result.latency).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeNull();
  });
});

describe("isHealthy", () => {
  it("should return true for connected status", () => {
    const result = {
      status: "connected" as const,
      timestamp: new Date().toISOString(),
      latency: 45,
      error: null,
    };

    expect(isHealthy(result)).toBe(true);
  });

  it("should return false for disconnected status", () => {
    const result = {
      status: "disconnected" as const,
      timestamp: new Date().toISOString(),
      latency: null,
      error: "Timeout",
    };

    expect(isHealthy(result)).toBe(false);
  });

  it("should return false for checking status", () => {
    const result = {
      status: "checking" as const,
      timestamp: new Date().toISOString(),
      latency: null,
      error: null,
    };

    expect(isHealthy(result)).toBe(false);
  });
});

describe("formatLatency", () => {
  it("should format numeric latency with ms suffix", () => {
    expect(formatLatency(45)).toBe("45ms");
    expect(formatLatency(123)).toBe("123ms");
    expect(formatLatency(0)).toBe("0ms");
  });

  it("should return em dash for null latency", () => {
    expect(formatLatency(null)).toBe("—");
  });

  it("should handle large latency values", () => {
    expect(formatLatency(1000)).toBe("1000ms");
    expect(formatLatency(5432)).toBe("5432ms");
  });
});
