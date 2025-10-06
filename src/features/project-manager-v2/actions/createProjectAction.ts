import { useActionState, useCallback } from "react";

import { createProject, type ProjectListItem } from "@/ipc";
import type { CreateProjectRequest, CreateProjectResponse, ProjectType } from "@/ipc";
import { useToast } from "@/components/ui/use-toast";

import {
  mutateProjectsResource,
  refreshProjectsResource,
  type ProjectsResourceStatus,
} from "../data/projectsResource";

export interface CreateProjectActionPayload {
  name: string;
  projectType: ProjectType;
  srcLang: string;
  tgtLang: string;
  files: string[];
}

export interface UseCreateProjectActionOptions {
  onSuccess?: (response: CreateProjectResponse) => void;
  onError?: (message: string) => void;
}

export interface CreateProjectActionState {
  status: ProjectsResourceStatus | "pending" | "success";
  error?: string;
}

const INITIAL_STATE: CreateProjectActionState = { status: "idle" };

export function useCreateProjectAction(options: UseCreateProjectActionOptions = {}) {
  const { toast } = useToast();
  const { onSuccess, onError } = options;

  const [state, dispatch, isPending] = useActionState<CreateProjectActionState, CreateProjectActionPayload>(
    async (_previous, payload) => {
      const trimmedName = payload.name.trim();
      const normalizedPayload: CreateProjectRequest = {
        name: trimmedName,
        projectType: payload.projectType,
        defaultSrcLang: payload.srcLang.trim(),
        defaultTgtLang: payload.tgtLang.trim(),
        files: [...new Set(payload.files.map((file) => file.trim()))].filter((file) => file.length > 0),
      } satisfies CreateProjectRequest;

      const optimisticId = `optimistic-${
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2, 10)
      }`;

      const now = new Date().toISOString();

      mutateProjectsResource((projects) => {
        const optimistic: ProjectListItem = {
          projectId: optimisticId,
          name: trimmedName,
          slug: trimmedName.toLowerCase().replace(/\s+/g, "-"),
          projectType: payload.projectType,
          status: "active",
          activityStatus: "pending",
          fileCount: normalizedPayload.files.length,
          createdAt: now,
          updatedAt: now,
        };
        return [optimistic, ...projects];
      });

      try {
        const response = await createProject(normalizedPayload);

        mutateProjectsResource((projects) => {
          const withoutOptimistic = projects.filter((project) => project.projectId !== optimisticId);
          const actual: ProjectListItem = {
            projectId: response.projectId,
            name: trimmedName,
            slug: response.slug,
            projectType: payload.projectType,
            status: "active",
            activityStatus: "pending",
            fileCount: response.fileCount,
            createdAt: now,
            updatedAt: now,
          };
          return [actual, ...withoutOptimistic];
        });

        toast({ title: "Project created", description: `"${response.slug}" is ready to open.` });
        onSuccess?.(response);
        void refreshProjectsResource();
        return { status: "success" };
      } catch (unknownError) {
        mutateProjectsResource((projects) => projects.filter((project) => project.projectId !== optimisticId));

        const message =
          unknownError instanceof Error
            ? unknownError.message
            : "Unable to create project. Please try again.";
        toast({ variant: "destructive", title: "Creation failed", description: message });
        onError?.(message);
        return { status: "idle", error: message };
      }
    },
    INITIAL_STATE,
  );

  const action = useCallback(
    (payload: CreateProjectActionPayload) => {
      dispatch(payload);
      return payload;
    },
    [dispatch],
  );

  return {
    state,
    action,
    isPending,
  };
}
