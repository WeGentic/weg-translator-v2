import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { RecoveryRoute } from "@/modules/auth";

/**
 * Search parameters schema for recovery route
 *
 * @property email - Pre-filled email address from orphan detection
 * @property reason - Why user was redirected here (orphaned|failed|incomplete)
 * @property correlationId - Optional correlation ID for tracing
 */
const recoverySearchSchema = z.object({
  email: z.string().email().optional().default(""),
  reason: z.enum(["orphaned", "failed", "incomplete"]).optional().default("orphaned"),
  correlationId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/register/recover")({
  validateSearch: (search: Record<string, unknown>) => {
    const parsed = recoverySearchSchema.safeParse(search);
    if (parsed.success) {
      return parsed.data;
    }
    // Return default values if validation fails
    return {
      email: "",
      reason: "orphaned" as const,
      correlationId: undefined,
    };
  },
  component: RecoveryRoute,
});
