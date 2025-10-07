import { useCallback, useState } from "react";

import { deleteProject } from "@/core/ipc";
import { useToast } from "@/shared/ui/use-toast";

import {
  getProjectsResourceSnapshot,
  mutateProjectsResource,
  refreshProjectsResource,
} from "../data/projectsResource";

export interface BatchDeletePayload {
  projectIds: string[];
}

export interface BatchDeleteActionState {
  status: "idle" | "pending";
  completedIds: string[];
}

interface BatchDeleteActionResult {
  state: BatchDeleteActionState;
  isPending: boolean;
  run: (payload: BatchDeletePayload) => void;
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function useBatchDeleteProjectsAction(): BatchDeleteActionResult {
  const { toast } = useToast();
  const [state, setState] = useState<BatchDeleteActionState>({ status: "idle", completedIds: [] });

  const run = useCallback(
    ({ projectIds }: BatchDeletePayload) => {
      if (!projectIds || projectIds.length === 0) {
        return;
      }

      const snapshot = getProjectsResourceSnapshot();
      setState({ status: "pending", completedIds: [] });

      mutateProjectsResource((projects) => projects.filter((project) => !projectIds.includes(project.projectId)));

      void (async () => {
        try {
          const results = await Promise.allSettled(projectIds.map((id) => deleteProject(id)));
          const failedIds = new Set<string>();
          const completedIds: string[] = [];

          results.forEach((result, index) => {
            const projectId = projectIds[index];
            if (result.status === "fulfilled" && result.value > 0) {
              completedIds.push(projectId);
            } else {
              failedIds.add(projectId);
            }
          });

          if (completedIds.length > 0) {
            await refreshProjectsResource();
          }

          if (failedIds.size > 0) {
            mutateProjectsResource(() => snapshot.data.filter((project) => failedIds.has(project.projectId)));
            const failureCount = failedIds.size;
            const description =
              failureCount === projectIds.length
                ? "No projects were deleted. Please try again."
                : `${failureCount} project${failureCount === 1 ? "" : "s"} could not be deleted.`;

            toast({
              variant: "destructive",
              title: "Batch delete failed",
              description,
            });
          } else {
            toast({
              title: "Projects deleted",
              description: `${completedIds.length} project${completedIds.length === 1 ? "" : "s"} deleted successfully.`,
            });
          }

          setState({ status: "idle", completedIds });
        } catch (error) {
          mutateProjectsResource(() => snapshot.data.slice());
          toast({
            variant: "destructive",
            title: "Batch delete failed",
            description: resolveErrorMessage(error, "Failed to delete the selected projects."),
          });
          setState({ status: "idle", completedIds: [] });
        }
      })();
    },
    [toast],
  );

  return { state, isPending: state.status === "pending", run };
}
