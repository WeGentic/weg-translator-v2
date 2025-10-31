import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/utils/class-names";

/**
 * Status of the Supabase database connection health check.
 */
export type SupabaseHealthStatus = "checking" | "connected" | "disconnected";

/**
 * Props for the SupabaseConnectionIndicator component.
 */
export interface SupabaseConnectionIndicatorProps {
  /**
   * Current health check status.
   */
  status: SupabaseHealthStatus;

  /**
   * Connection latency in milliseconds (only relevant for 'connected' status).
   */
  latency?: number | null;

  /**
   * Error message (only relevant for 'disconnected' status).
   */
  error?: string | null;

  /**
   * Additional CSS classes to apply to the container.
   */
  className?: string;
}

/**
 * Returns the appropriate icon component for the given status.
 */
function getIconForStatus(status: SupabaseHealthStatus) {
  switch (status) {
    case "checking":
      return <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />;
    case "connected":
      return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />;
    case "disconnected":
      return <XCircle className="h-3.5 w-3.5" aria-hidden="true" />;
  }
}

/**
 * Returns the display text for the given status.
 */
function getTextForStatus(
  status: SupabaseHealthStatus,
  latency?: number | null,
): string {
  switch (status) {
    case "checking":
      return "Checking database...";
    case "connected":
      return latency !== null && latency !== undefined
        ? `Connected • ${latency}ms`
        : "Connected";
    case "disconnected":
      return "Connection failed";
  }
}

/**
 * Returns the color classes for the given status.
 */
function getColorsForStatus(status: SupabaseHealthStatus): string {
  switch (status) {
    case "checking":
      return "text-yellow-600 dark:text-yellow-500";
    case "connected":
      return "text-green-600 dark:text-green-500";
    case "disconnected":
      return "text-red-600 dark:text-red-500";
  }
}

/**
 * Returns an accessible label describing the current connection status.
 */
function getAriaLabelForStatus(
  status: SupabaseHealthStatus,
  latency?: number | null,
  error?: string | null,
): string {
  switch (status) {
    case "checking":
      return "Checking database connection";
    case "connected":
      return latency !== null && latency !== undefined
        ? `Database connected with ${latency} millisecond latency`
        : "Database connected";
    case "disconnected":
      return error
        ? `Database connection failed: ${error}`
        : "Database connection failed";
  }
}

/**
 * Returns the tooltip content with additional details.
 */
function getTooltipContent(
  status: SupabaseHealthStatus,
  latency?: number | null,
  error?: string | null,
): string {
  switch (status) {
    case "checking":
      return "Verifying database connectivity...";
    case "connected":
      if (latency !== null && latency !== undefined) {
        return `Database is healthy. Response time: ${latency}ms`;
      }
      return "Database is healthy and responding";
    case "disconnected":
      return error
        ? `Unable to connect to database: ${error}`
        : "Database is currently unavailable. Please check your connection.";
  }
}

/**
 * SupabaseConnectionIndicator displays the current health status of the Supabase database connection.
 *
 * This component provides visual feedback with color-coded states, icons, and text labels
 * to indicate whether the database connection is being checked, successfully connected, or disconnected.
 *
 * Accessibility:
 * - Uses `role="status"` and `aria-live="polite"` for screen reader announcements
 * - Combines color, icon, and text to meet WCAG 1.4.1 (Use of Color)
 * - Provides descriptive `aria-label` for each state
 * - Icons marked with `aria-hidden="true"` since text provides context
 * - Includes tooltip with extended information on hover
 *
 * @example
 * ```tsx
 * <SupabaseConnectionIndicator status="connected" latency={45} />
 * <SupabaseConnectionIndicator status="checking" />
 * <SupabaseConnectionIndicator status="disconnected" error="Network timeout" />
 * ```
 */
export function SupabaseConnectionIndicator({
  status,
  latency,
  error,
  className,
}: SupabaseConnectionIndicatorProps) {
  const icon = getIconForStatus(status);
  const text = getTextForStatus(status, latency);
  const colors = getColorsForStatus(status);
  const ariaLabel = getAriaLabelForStatus(status, latency, error);
  const tooltipContent = getTooltipContent(status, latency, error);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="status"
          aria-live="polite"
          aria-label={ariaLabel}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-in-out",
            colors,
            className,
          )}
        >
          {icon}
          <span className="leading-none">{text}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" align="center">
        <p className="max-w-[200px] text-xs">{tooltipContent}</p>
      </TooltipContent>
    </Tooltip>
  );
}
