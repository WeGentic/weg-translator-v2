import { useCallback, useState } from "react";

import { deleteProject } from "@/core/ipc";
import { useToast } from "@/shared/ui/use-toast";

import {
  getProjectsResourceSnapshot,
  mutateProjectsResource,
  refreshProjectsResource,
} from "../data/projectsResource";

export interface DeleteProjectActionPayload {
  projectId: string;
  projectName: string;
}

interface DeleteProjectActionResult {
  run: (payload: DeleteProjectActionPayload) => void;
  isPending: boolean;
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function useDeleteProjectAction(): DeleteProjectActionResult {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const run = useCallback(
    ({ projectId, projectName }: DeleteProjectActionPayload) => {
      if (!projectId) return;
      setIsPending(true);
      const snapshot = getProjectsResourceSnapshot();

      mutateProjectsResource((projects) => projects.filter((project) => project.projectId !== projectId));

      void (async () => {
        try {
          const deletedCount = await deleteProject(projectId);
          if (deletedCount > 0) {
            await refreshProjectsResource();
            toast({
              title: "Project deleted",
              description: `${projectName} has been removed`,
            });
          } else {
            mutateProjectsResource(() => snapshot.data.slice());
            toast({
              variant: "destructive",
              title: "Deletion failed",
              description: `${projectName} could not be deleted.`,
            });
          }
        } catch (error) {
          mutateProjectsResource(() => snapshot.data.slice());
          toast({
            variant: "destructive",
            title: "Deletion failed",
            description: resolveErrorMessage(error, "An unexpected error occurred while deleting the project."),
          });
        } finally {
          setIsPending(false);
        }
      })();
    },
    [toast],
  );

  return { run, isPending };
}
