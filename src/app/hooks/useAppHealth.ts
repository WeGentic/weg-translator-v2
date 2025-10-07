import { useEffect, useState } from "react";

import { healthCheck, type AppHealthReport } from "@/core/ipc";
import { logger } from "@/core/logging";

/**
 * Bootstraps the IPC health channel once on mount and surfaces the latest health report/error.
 */
export function useAppHealth() {
  const [health, setHealth] = useState<AppHealthReport | null>(null);
  const [systemError, setSystemError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const healthReport = await healthCheck();
        if (cancelled) {
          return;
        }
        setHealth(healthReport);
        setSystemError(null);
        void logger.info("IPC layer bootstrapped", { tracked_jobs: 0 });
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Failed to bootstrap IPC layer";
        setSystemError(message);
        void logger.error("Failed to bootstrap IPC layer", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { health, systemError, setSystemError } as const;
}
