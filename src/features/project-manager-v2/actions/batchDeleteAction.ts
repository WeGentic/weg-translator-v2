import { useActionState, useCallback } from "react";

import { deleteProject, type ProjectListItem, type ProjectListQuery } from "@/ipc";
import { useToast } from "@/components/ui/use-toast";

import {
  getProjectsResourceSnapshot,
  mutateProjectsResource,
  refreshProjectsResource,
} from "../data/projectsResource";

export type BatchDeleteStatus = "idle" | "success" | "error";

export interface BatchDeleteActionState {
  status: BatchDeleteStatus;
  completedIds: string[];
  error?: string;
}

export interface BatchDeletePayload {
  projectIds: string[];
}

export interface UseBatchDeleteActionOptions {
  query?: ProjectListQuery;
  onSuccess?: (completedIds: string[]) => void;
}

const INITIAL_STATE: BatchDeleteActionState = { status: "idle", completedIds: [] };

function normalizePayload(input: BatchDeletePayload | FormData | null | undefined): BatchDeletePayload | null {
  if (!input) return null;
  if (input instanceof FormData) {
    const raw = input.getAll("projectIds");
    const projectIds = raw.filter((value): value is string => typeof value === "string" && value.length > 0);
    return projectIds.length > 0 ? { projectIds } : null;
  }
  if (!Array.isArray(input.projectIds) || input.projectIds.length === 0) {
    return null;
  }
  const projectIds = input.projectIds.filter((id) => typeof id === "string" && id.length > 0);
  return projectIds.length > 0 ? { projectIds } : null;
}

export function useBatchDeleteProjectsAction(options: UseBatchDeleteActionOptions = {}) {
  const { toast } = useToast();
  const { query, onSuccess } = options;

  const [state, dispatch, isPending] = useActionState<BatchDeleteActionState, BatchDeletePayload | FormData>(
    async (_prev, rawInput) => {
      const payload = normalizePayload(rawInput);
      if (!payload) {
        const message = "Select at least one project to delete.";
        toast({ variant: "destructive", title: "Batch delete failed", description: message });
        return { status: "error", completedIds: [], error: message };
      }

      const snapshot = getProjectsResourceSnapshot(query);
      let rollbackProjects: ProjectListItem[] | null = null;

      if (snapshot.data && snapshot.data.length > 0) {
        const targetSet = new Set(payload.projectIds);
        mutateProjectsResource((projects) => {
          rollbackProjects = projects.slice();
          return projects.filter((project) => !targetSet.has(project.projectId));
        }, query);
      }

      const completed: string[] = [];
      const failures: string[] = [];

      await Promise.all(
        payload.projectIds.map(async (projectId) => {
          try {
            const deleted = await deleteProject(projectId);
            if (deleted > 0) {
              completed.push(projectId);
            } else {
              failures.push(projectId);
            }
          } catch {
            failures.push(projectId);
          }
        }),
      );

      if (failures.length > 0) {
        if (rollbackProjects) {
          const completedSet = new Set(completed);
          mutateProjectsResource(
            () => rollbackProjects!.filter((project) => !completedSet.has(project.projectId)),
            query,
          );
        }

        const description = failures.length === 1
          ? "Unable to delete one of the selected projects."
          : `Unable to delete ${failures.length} selected projects.`;

        toast({ variant: "destructive", title: "Batch delete failed", description });
        return { status: "error", completedIds: completed, error: description };
      }

      toast({
        title: "Projects deleted",
        description: completed.length === 1
          ? "Deleted 1 project."
          : `Deleted ${completed.length} projects.`,
      });

      onSuccess?.(completed);
      void refreshProjectsResource(query);
      return { status: "success", completedIds: completed };
    },
    INITIAL_STATE,
  );

  const run = useCallback(
    (payload: BatchDeletePayload | FormData) => dispatch(payload),
    [dispatch],
  );

  return {
    state,
    isPending,
    run,
    action: dispatch,
  };
}
