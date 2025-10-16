import { useTransition } from "react";

/**
 * TODO: Rebuild optimistic project creation using the v2 project bundle IPC.
 * The legacy staging pipeline has been removed, so this hook currently
 * acts as a placeholder until the new workflow is implemented.
 */
export function useCreateProjectAction(): { action: () => void; isPending: boolean } {
  const [isPending] = useTransition();

  return {
    action: () => {
      throw new Error("TODO: Implement optimistic project creation against the v2 schema");
    },
    isPending,
  };
}
