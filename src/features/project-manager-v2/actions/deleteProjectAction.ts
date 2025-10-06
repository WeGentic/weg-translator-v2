import { useActionState, useCallback } from "react";

import { deleteProject, type ProjectListQuery, type ProjectListItem } from "@/ipc";
import { useToast } from "@/components/ui/use-toast";

import {
  getProjectsResourceSnapshot,
  mutateProjectsResource,
  refreshProjectsResource,
} from "../data/projectsResource";

export type DeleteProjectActionStatus = "idle" | "success" | "error";

export interface DeleteProjectActionState {
  status: DeleteProjectActionStatus;
  error?: string;
}

export interface DeleteProjectPayload {
  projectId: string;
  projectName?: string;
}

export interface UseDeleteProjectActionOptions {
  query?: ProjectListQuery;
  onSuccess?: (payload: DeleteProjectPayload) => void;
}

const INITIAL_STATE: DeleteProjectActionState = { status: "idle" };

function normalizePayload(input: DeleteProjectPayload | FormData | null | undefined): DeleteProjectPayload | null {
  if (!input) return null;
  if (input instanceof FormData) {
    const projectId = input.get("projectId");
    if (typeof projectId !== "string" || projectId.length === 0) {
      return null;
    }
    const projectNameField = input.get("projectName");
    const projectName = typeof projectNameField === "string" ? projectNameField : undefined;
    return { projectId, projectName };
  }

  if (typeof input.projectId !== "string" || input.projectId.length === 0) {
    return null;
  }

  return input;
}

function projectLabel(payload: DeleteProjectPayload, fallback?: string) {
  if (payload.projectName && payload.projectName.trim().length > 0) {
    return `"${payload.projectName.trim()}"`;
  }
  if (fallback && fallback.trim().length > 0) {
    return `"${fallback.trim()}"`;
  }
  return "the selected project";
}

export function useDeleteProjectAction(options: UseDeleteProjectActionOptions = {}) {
  const { toast } = useToast();
  const { query, onSuccess } = options;

  const [state, dispatch, isPending] = useActionState<DeleteProjectActionState, DeleteProjectPayload | FormData>(
    async (_prev, rawInput) => {
      const payload = normalizePayload(rawInput);
      if (!payload) {
        const message = "Missing project identifier.";
        toast({ variant: "destructive", title: "Deletion failed", description: message });
        return { status: "error", error: message };
      }

      const snapshot = getProjectsResourceSnapshot(query);
      let rollbackProjects: ProjectListItem[] | null = null;
      let removedProjectName: string | undefined;

      if (snapshot.data) {
        mutateProjectsResource((projects) => {
          rollbackProjects = projects.slice();
          return projects.filter((project) => {
            if (project.projectId === payload.projectId) {
              removedProjectName = project.name;
              return false;
            }
            return true;
          });
        }, query);
      }

      try {
        const deleted = await deleteProject(payload.projectId);
        if (deleted > 0) {
          toast({
            title: "Project deleted",
            description: `${projectLabel(payload, removedProjectName)} has been deleted.`,
          });
          onSuccess?.(payload);
          void refreshProjectsResource(query);
          return { status: "success" };
        }

        if (rollbackProjects) {
          mutateProjectsResource(() => rollbackProjects!, query);
        }

        const message = "Could not delete the selected project.";
        toast({ variant: "destructive", title: "Deletion failed", description: message });
        return { status: "error", error: message };
      } catch (unknownError) {
        if (rollbackProjects) {
          mutateProjectsResource(() => rollbackProjects!, query);
        }
        const message =
          unknownError instanceof Error ? unknownError.message : "Unable to delete the selected project.";
        toast({ variant: "destructive", title: "Deletion failed", description: message });
        return { status: "error", error: message };
      }
    },
    INITIAL_STATE,
  );

  const run = useCallback(
    (payload: DeleteProjectPayload | FormData) => dispatch(payload),
    [dispatch],
  );

  return {
    state,
    isPending,
    run,
    action: dispatch,
  };
}
