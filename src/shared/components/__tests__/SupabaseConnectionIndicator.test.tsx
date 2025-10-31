/**
 * Tests for SupabaseConnectionIndicator component
 *
 * Tests visual states, accessibility attributes, and prop handling.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SupabaseConnectionIndicator } from "../SupabaseConnectionIndicator";
import type { SupabaseHealthStatus } from "../SupabaseConnectionIndicator";

// Set React 19 test environment flag
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("SupabaseConnectionIndicator", () => {
  describe("Visual states", () => {
    it("should render checking state with yellow color and spinner", () => {
      render(<SupabaseConnectionIndicator status="checking" />);

      const indicator = screen.getByRole("status");

      // Should have yellow text color
      expect(indicator).toHaveClass("text-yellow-600");

      // Should show checking text
      expect(screen.getByText("Checking database...")).toBeInTheDocument();

      // Should have spinner icon (animated)
      const spinner = indicator.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("should render connected state with green color and checkmark", () => {
      render(<SupabaseConnectionIndicator status="connected" latency={45} />);

      const indicator = screen.getByRole("status");

      // Should have green text color
      expect(indicator).toHaveClass("text-green-600");

      // Should show connected text with latency
      expect(screen.getByText("Connected • 45ms")).toBeInTheDocument();

      // Should have checkmark icon
      const checkmark = indicator.querySelector("svg");
      expect(checkmark).toBeInTheDocument();
    });

    it("should render connected state without latency", () => {
      render(<SupabaseConnectionIndicator status="connected" />);

      // Should show connected text without latency
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    it("should render disconnected state with red color and X icon", () => {
      render(
        <SupabaseConnectionIndicator
          status="disconnected"
          error="Network timeout"
        />
      );

      const indicator = screen.getByRole("status");

      // Should have red text color
      expect(indicator).toHaveClass("text-red-600");

      // Should show connection failed text
      expect(screen.getByText("Connection failed")).toBeInTheDocument();

      // Should have X icon
      const xIcon = indicator.querySelector("svg");
      expect(xIcon).toBeInTheDocument();
    });
  });

  describe("Dark mode colors", () => {
    it("should include dark mode color classes for checking state", () => {
      render(<SupabaseConnectionIndicator status="checking" />);

      const indicator = screen.getByRole("status");
      expect(indicator).toHaveClass("dark:text-yellow-500");
    });

    it("should include dark mode color classes for connected state", () => {
      render(<SupabaseConnectionIndicator status="connected" />);

      const indicator = screen.getByRole("status");
      expect(indicator).toHaveClass("dark:text-green-500");
    });

    it("should include dark mode color classes for disconnected state", () => {
      render(<SupabaseConnectionIndicator status="disconnected" />);

      const indicator = screen.getByRole("status");
      expect(indicator).toHaveClass("dark:text-red-500");
    });
  });

  describe("Accessibility", () => {
    it("should have role='status' and aria-live='polite'", () => {
      render(<SupabaseConnectionIndicator status="checking" />);

      const indicator = screen.getByRole("status");
      expect(indicator).toHaveAttribute("aria-live", "polite");
    });

    it("should have descriptive aria-label for checking state", () => {
      render(<SupabaseConnectionIndicator status="checking" />);

      const indicator = screen.getByRole("status");
      expect(indicator).toHaveAttribute(
        "aria-label",
        "Checking database connection"
      );
    });

    it("should have descriptive aria-label for connected state without latency", () => {
      render(<SupabaseConnectionIndicator status="connected" />);

      const indicator = screen.getByRole("status");
      expect(indicator).toHaveAttribute("aria-label", "Database connected");
    });

    it("should have descriptive aria-label for connected state with latency", () => {
      render(<SupabaseConnectionIndicator status="connected" latency={45} />);

      const indicator = screen.getByRole("status");
      expect(indicator).toHaveAttribute(
        "aria-label",
        "Database connected with 45 millisecond latency"
      );
    });

    it("should have descriptive aria-label for disconnected state without error", () => {
      render(<SupabaseConnectionIndicator status="disconnected" />);

      const indicator = screen.getByRole("status");
      expect(indicator).toHaveAttribute(
        "aria-label",
        "Database connection failed"
      );
    });

    it("should have descriptive aria-label for disconnected state with error", () => {
      render(
        <SupabaseConnectionIndicator
          status="disconnected"
          error="Network timeout"
        />
      );

      const indicator = screen.getByRole("status");
      expect(indicator).toHaveAttribute(
        "aria-label",
        "Database connection failed: Network timeout"
      );
    });

    it("should mark icons as aria-hidden since text provides context", () => {
      const { rerender } = render(
        <SupabaseConnectionIndicator status="checking" />
      );

      let icon = screen.getByRole("status").querySelector("svg");
      expect(icon).toHaveAttribute("aria-hidden", "true");

      rerender(<SupabaseConnectionIndicator status="connected" />);
      icon = screen.getByRole("status").querySelector("svg");
      expect(icon).toHaveAttribute("aria-hidden", "true");

      rerender(<SupabaseConnectionIndicator status="disconnected" />);
      icon = screen.getByRole("status").querySelector("svg");
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("Tooltip", () => {
    it("should show tooltip with details for checking state", async () => {
      const user = userEvent.setup();

      render(<SupabaseConnectionIndicator status="checking" />);

      const indicator = screen.getByRole("status");

      // Hover over indicator
      await user.hover(indicator);

      // Tooltip should appear with detailed message (may be duplicated for a11y)
      const tooltips = await screen.findAllByText("Verifying database connectivity...");
      expect(tooltips.length).toBeGreaterThan(0);
    });

    it("should show tooltip with latency details for connected state", async () => {
      const user = userEvent.setup();

      render(<SupabaseConnectionIndicator status="connected" latency={45} />);

      const indicator = screen.getByRole("status");
      await user.hover(indicator);

      const tooltips = await screen.findAllByText("Database is healthy. Response time: 45ms");
      expect(tooltips.length).toBeGreaterThan(0);
    });

    it("should show tooltip with generic message for connected state without latency", async () => {
      const user = userEvent.setup();

      render(<SupabaseConnectionIndicator status="connected" />);

      const indicator = screen.getByRole("status");
      await user.hover(indicator);

      const tooltips = await screen.findAllByText("Database is healthy and responding");
      expect(tooltips.length).toBeGreaterThan(0);
    });

    it("should show tooltip with error details for disconnected state", async () => {
      const user = userEvent.setup();

      render(
        <SupabaseConnectionIndicator
          status="disconnected"
          error="Network timeout"
        />
      );

      const indicator = screen.getByRole("status");
      await user.hover(indicator);

      const tooltips = await screen.findAllByText("Unable to connect to database: Network timeout");
      expect(tooltips.length).toBeGreaterThan(0);
    });

    it("should show tooltip with generic message for disconnected state without error", async () => {
      const user = userEvent.setup();

      render(<SupabaseConnectionIndicator status="disconnected" />);

      const indicator = screen.getByRole("status");
      await user.hover(indicator);

      const tooltips = await screen.findAllByText(
        "Database is currently unavailable. Please check your connection."
      );
      expect(tooltips.length).toBeGreaterThan(0);
    });
  });

  describe("Props handling", () => {
    it("should accept and apply custom className", () => {
      render(
        <SupabaseConnectionIndicator
          status="connected"
          className="custom-test-class"
        />
      );

      const indicator = screen.getByRole("status");
      expect(indicator).toHaveClass("custom-test-class");

      // Should also keep default classes
      expect(indicator).toHaveClass("inline-flex");
      expect(indicator).toHaveClass("items-center");
    });

    it("should handle null latency for connected state", () => {
      render(
        <SupabaseConnectionIndicator status="connected" latency={null} />
      );

      // Should show connected without latency
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    it("should handle undefined latency for connected state", () => {
      render(<SupabaseConnectionIndicator status="connected" latency={undefined} />);

      // Should show connected without latency
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    it("should handle null error for disconnected state", () => {
      render(
        <SupabaseConnectionIndicator status="disconnected" error={null} />
      );

      const indicator = screen.getByRole("status");

      // Should still show connection failed
      expect(screen.getByText("Connection failed")).toBeInTheDocument();

      // aria-label should not include error
      expect(indicator).toHaveAttribute(
        "aria-label",
        "Database connection failed"
      );
    });

    it("should handle zero latency", () => {
      render(<SupabaseConnectionIndicator status="connected" latency={0} />);

      // Should show 0ms latency
      expect(screen.getByText("Connected • 0ms")).toBeInTheDocument();
    });

    it("should handle large latency values", () => {
      render(<SupabaseConnectionIndicator status="connected" latency={5432} />);

      expect(screen.getByText("Connected • 5432ms")).toBeInTheDocument();
    });
  });

  describe("State transitions", () => {
    it("should update display when status prop changes", () => {
      const { rerender } = render(
        <SupabaseConnectionIndicator status="checking" />
      );

      expect(screen.getByText("Checking database...")).toBeInTheDocument();

      // Change to connected
      rerender(<SupabaseConnectionIndicator status="connected" latency={45} />);

      expect(screen.queryByText("Checking database...")).not.toBeInTheDocument();
      expect(screen.getByText("Connected • 45ms")).toBeInTheDocument();

      // Change to disconnected
      rerender(
        <SupabaseConnectionIndicator
          status="disconnected"
          error="Timeout"
        />
      );

      expect(screen.queryByText("Connected • 45ms")).not.toBeInTheDocument();
      expect(screen.getByText("Connection failed")).toBeInTheDocument();
    });

    it("should apply transition classes for smooth state changes", () => {
      render(<SupabaseConnectionIndicator status="checking" />);

      const indicator = screen.getByRole("status");

      // Should have transition classes
      expect(indicator).toHaveClass("transition-all");
      expect(indicator).toHaveClass("duration-200");
      expect(indicator).toHaveClass("ease-in-out");
    });
  });

  describe("Layout and styling", () => {
    it("should have inline-flex layout", () => {
      render(<SupabaseConnectionIndicator status="connected" />);

      const indicator = screen.getByRole("status");
      expect(indicator).toHaveClass("inline-flex");
    });

    it("should center items vertically", () => {
      render(<SupabaseConnectionIndicator status="connected" />);

      const indicator = screen.getByRole("status");
      expect(indicator).toHaveClass("items-center");
    });

    it("should have gap between icon and text", () => {
      render(<SupabaseConnectionIndicator status="connected" />);

      const indicator = screen.getByRole("status");
      expect(indicator).toHaveClass("gap-2");
    });

    it("should have rounded corners", () => {
      render(<SupabaseConnectionIndicator status="connected" />);

      const indicator = screen.getByRole("status");
      expect(indicator).toHaveClass("rounded-md");
    });

    it("should have appropriate padding", () => {
      render(<SupabaseConnectionIndicator status="connected" />);

      const indicator = screen.getByRole("status");
      expect(indicator).toHaveClass("px-3");
      expect(indicator).toHaveClass("py-1.5");
    });

    it("should use medium font weight", () => {
      render(<SupabaseConnectionIndicator status="connected" />);

      const indicator = screen.getByRole("status");
      expect(indicator).toHaveClass("font-medium");
    });

    it("should use small text size", () => {
      render(<SupabaseConnectionIndicator status="connected" />);

      const indicator = screen.getByRole("status");
      expect(indicator).toHaveClass("text-sm");
    });
  });
});
