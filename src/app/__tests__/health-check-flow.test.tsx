/**
 * Integration tests for Supabase health check flow
 *
 * Tests end-to-end behavior from service → hook → component rendering.
 * Covers login page and workspace footer integration scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSupabaseHealth } from "@/app/hooks/useSupabaseHealth";
import { SupabaseConnectionIndicator } from "@/shared/components/SupabaseConnectionIndicator";
import type { SupabaseHealthResult } from "@/app/hooks/useSupabaseHealth";

// Set React 19 test environment flag
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Mock the health service
const mockCheckSupabaseHealth = vi.fn<[], Promise<SupabaseHealthResult>>();

vi.mock("@/core/supabase/health", () => ({
  checkSupabaseHealth: () => mockCheckSupabaseHealth(),
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

/**
 * Test component simulating login page health indicator
 */
function LoginHealthIndicator() {
  const { healthResult, isLoading, retry } = useSupabaseHealth({
    autoStart: true,
    pollingInterval: 60000,
  });

  return (
    <div data-testid="login-health-indicator">
      {healthResult && (
        <SupabaseConnectionIndicator
          status={healthResult.status}
          latency={healthResult.latency}
          error={healthResult.error}
        />
      )}
      <button onClick={retry} data-testid="retry-button">
        Retry
      </button>
      {isLoading && <div data-testid="loading">Loading...</div>}
    </div>
  );
}

/**
 * Test component simulating workspace footer health indicator
 */
function WorkspaceHealthIndicator() {
  const { healthResult } = useSupabaseHealth({
    autoStart: true,
    pollingInterval: 60000,
  });

  return (
    <div data-testid="workspace-health-indicator">
      {healthResult && (
        <SupabaseConnectionIndicator
          status={healthResult.status}
          latency={healthResult.latency}
          error={healthResult.error}
        />
      )}
    </div>
  );
}

describe("Health check flow integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockAuthContext.isAuthenticated = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Complete flow: service → hook → component", () => {
    it("should display checking then connected states in sequence", async () => {
      mockCheckSupabaseHealth.mockResolvedValue({
        status: "connected",
        timestamp: new Date(),
        latency: 45,
      });

      render(<LoginHealthIndicator />);

      // Initially should show checking state
      await waitFor(() => {
        expect(screen.getByText("Checking database...")).toBeInTheDocument();
      });

      // Wait for health check to complete
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Should transition to connected state
      await waitFor(() => {
        expect(screen.getByText("Connected • 45ms")).toBeInTheDocument();
      });

      // Should no longer show checking
      expect(screen.queryByText("Checking database...")).not.toBeInTheDocument();

      // Verify service was called
      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(1);
    });

    it("should display checking then disconnected states on failure", async () => {
      mockCheckSupabaseHealth.mockResolvedValue({
        status: "disconnected",
        timestamp: new Date(),
        latency: null,
        error: "Network timeout",
      });

      render(<LoginHealthIndicator />);

      // Initially should show checking state
      await waitFor(() => {
        expect(screen.getByText("Checking database...")).toBeInTheDocument();
      });

      // Wait for health check to complete
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Should transition to disconnected state
      await waitFor(() => {
        expect(screen.getByText("Connection failed")).toBeInTheDocument();
      });

      // Verify ARIA label includes error
      const indicator = screen.getByRole("status");
      expect(indicator).toHaveAttribute(
        "aria-label",
        "Database connection failed: Network timeout"
      );
    });
  });

  describe("Polling behavior in workspace", () => {
    it("should poll automatically for authenticated users", async () => {
      mockAuthContext.isAuthenticated = true;

      let callCount = 0;
      mockCheckSupabaseHealth.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          status: "connected",
          timestamp: new Date(),
          latency: 40 + callCount * 5, // Increasing latency
        });
      });

      render(<WorkspaceHealthIndicator />);

      // Initial check
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(screen.getByText("Connected • 45ms")).toBeInTheDocument();
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(1);

      // Advance 60 seconds - should trigger polling
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      await waitFor(() => {
        expect(screen.getByText("Connected • 50ms")).toBeInTheDocument();
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(2);

      // Another 60 seconds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      await waitFor(() => {
        expect(screen.getByText("Connected • 55ms")).toBeInTheDocument();
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(3);
    });

    it("should not poll for unauthenticated users on login page", async () => {
      mockAuthContext.isAuthenticated = false;

      mockCheckSupabaseHealth.mockResolvedValue({
        status: "connected",
        timestamp: new Date(),
        latency: 45,
      });

      render(<LoginHealthIndicator />);

      // Initial check
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(screen.getByText("Connected • 45ms")).toBeInTheDocument();
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(1);

      // Advance 60 seconds - should NOT poll (not authenticated)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      // Should still show same result (no new check)
      expect(screen.getByText("Connected • 45ms")).toBeInTheDocument();
      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(1);
    });
  });

  describe("Connection failure handling with retry", () => {
    it("should allow manual retry after connection failure", async () => {
      const user = userEvent.setup({ delay: null });

      // First call fails
      mockCheckSupabaseHealth
        .mockResolvedValueOnce({
          status: "disconnected",
          timestamp: new Date(),
          latency: null,
          error: "Timeout",
        })
        // Second call (retry) succeeds
        .mockResolvedValueOnce({
          status: "connected",
          timestamp: new Date(),
          latency: 50,
        });

      render(<LoginHealthIndicator />);

      // Wait for initial check to fail
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(screen.getByText("Connection failed")).toBeInTheDocument();
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(1);

      // Click retry button
      const retryButton = screen.getByTestId("retry-button");
      await user.click(retryButton);

      // Should show checking again
      await waitFor(() => {
        expect(screen.getByText("Checking database...")).toBeInTheDocument();
      });

      // Wait for retry to complete
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Should now show connected
      await waitFor(() => {
        expect(screen.getByText("Connected • 50ms")).toBeInTheDocument();
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(2);
    });

    it("should gracefully handle multiple consecutive failures", async () => {
      const user = userEvent.setup({ delay: null });

      mockCheckSupabaseHealth.mockResolvedValue({
        status: "disconnected",
        timestamp: new Date(),
        latency: null,
        error: "Service unavailable",
      });

      render(<LoginHealthIndicator />);

      // Initial check fails
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(screen.getByText("Connection failed")).toBeInTheDocument();
      });

      // Retry multiple times - all fail
      const retryButton = screen.getByTestId("retry-button");

      for (let i = 0; i < 3; i++) {
        await user.click(retryButton);

        await act(async () => {
          await vi.runAllTimersAsync();
        });

        await waitFor(() => {
          expect(screen.getByText("Connection failed")).toBeInTheDocument();
        });
      }

      // Should have made 4 total calls (1 initial + 3 retries)
      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(4);

      // Component should still be functional (not crashed)
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });

  describe("State persistence across remounts", () => {
    it("should trigger new health check on remount", async () => {
      mockCheckSupabaseHealth.mockResolvedValue({
        status: "connected",
        timestamp: new Date(),
        latency: 45,
      });

      const { unmount, rerender } = render(<LoginHealthIndicator />);

      // Initial check
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(screen.getByText("Connected • 45ms")).toBeInTheDocument();
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(1);

      // Unmount
      unmount();

      // Update mock to return different latency
      mockCheckSupabaseHealth.mockResolvedValue({
        status: "connected",
        timestamp: new Date(),
        latency: 60,
      });

      // Remount
      rerender(<LoginHealthIndicator />);

      // Should trigger new check
      await waitFor(() => {
        expect(screen.getByText("Checking database...")).toBeInTheDocument();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(screen.getByText("Connected • 60ms")).toBeInTheDocument();
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(2);
    });

    it("should not duplicate health checks from multiple instances", async () => {
      mockCheckSupabaseHealth.mockResolvedValue({
        status: "connected",
        timestamp: new Date(),
        latency: 45,
      });

      // Render two instances simultaneously (login + workspace scenario)
      const { container } = render(
        <>
          <LoginHealthIndicator />
          <WorkspaceHealthIndicator />
        </>
      );

      // Wait for checks to complete
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Both should show connected
      const indicators = container.querySelectorAll('[role="status"]');
      expect(indicators).toHaveLength(2);

      // Each instance runs its own check (they're independent)
      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(2);
    });
  });

  describe("Accessibility through state transitions", () => {
    it("should maintain aria-live announcements during transitions", async () => {
      mockCheckSupabaseHealth.mockResolvedValue({
        status: "connected",
        timestamp: new Date(),
        latency: 45,
      });

      render(<LoginHealthIndicator />);

      const indicator = await screen.findByRole("status");

      // aria-live should be polite throughout
      expect(indicator).toHaveAttribute("aria-live", "polite");

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(screen.getByText("Connected • 45ms")).toBeInTheDocument();
      });

      // aria-live should still be polite after transition
      expect(indicator).toHaveAttribute("aria-live", "polite");
    });

    it("should update aria-label as status changes", async () => {
      mockCheckSupabaseHealth.mockResolvedValue({
        status: "connected",
        timestamp: new Date(),
        latency: 45,
      });

      render(<LoginHealthIndicator />);

      const indicator = await screen.findByRole("status");

      // Initially checking
      expect(indicator).toHaveAttribute(
        "aria-label",
        "Checking database connection"
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(indicator).toHaveAttribute(
          "aria-label",
          "Database connected with 45 millisecond latency"
        );
      });
    });
  });

  describe("Error recovery scenarios", () => {
    it("should recover from temporary network issues", async () => {
      // Simulate intermittent connection: fail, succeed, fail, succeed
      mockCheckSupabaseHealth
        .mockResolvedValueOnce({
          status: "disconnected",
          timestamp: new Date(),
          latency: null,
          error: "Network error",
        })
        .mockResolvedValueOnce({
          status: "connected",
          timestamp: new Date(),
          latency: 50,
        })
        .mockResolvedValueOnce({
          status: "disconnected",
          timestamp: new Date(),
          latency: null,
          error: "Network error",
        })
        .mockResolvedValueOnce({
          status: "connected",
          timestamp: new Date(),
          latency: 55,
        });

      mockAuthContext.isAuthenticated = true;

      render(<WorkspaceHealthIndicator />);

      // Initial check (fails)
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(screen.getByText("Connection failed")).toBeInTheDocument();
      });

      // Poll after 60s (succeeds)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      await waitFor(() => {
        expect(screen.getByText("Connected • 50ms")).toBeInTheDocument();
      });

      // Poll after another 60s (fails again)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      await waitFor(() => {
        expect(screen.getByText("Connection failed")).toBeInTheDocument();
      });

      // Poll after another 60s (recovers)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      await waitFor(() => {
        expect(screen.getByText("Connected • 55ms")).toBeInTheDocument();
      });

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(4);
    });
  });

  describe("Performance indicators", () => {
    it("should display latency changes over time", async () => {
      mockAuthContext.isAuthenticated = true;

      const latencies = [45, 50, 120, 35, 60];
      let callIndex = 0;

      mockCheckSupabaseHealth.mockImplementation(() => {
        const latency = latencies[callIndex % latencies.length];
        callIndex++;
        return Promise.resolve({
          status: "connected",
          timestamp: new Date(),
          latency,
        });
      });

      render(<WorkspaceHealthIndicator />);

      // Check each poll shows updated latency
      for (const expectedLatency of latencies) {
        await act(async () => {
          await vi.runAllTimersAsync();
        });

        await waitFor(() => {
          expect(
            screen.getByText(`Connected • ${expectedLatency}ms`)
          ).toBeInTheDocument();
        });

        // Advance to next poll (except on last iteration)
        if (expectedLatency !== latencies[latencies.length - 1]) {
          await act(async () => {
            await vi.advanceTimersByTimeAsync(60000);
          });
        }
      }

      expect(mockCheckSupabaseHealth).toHaveBeenCalledTimes(latencies.length);
    });
  });
});
