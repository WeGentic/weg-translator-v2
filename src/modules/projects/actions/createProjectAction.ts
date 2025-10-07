import { useCallback, useTransition } from "react";

import {
  createProject,
  type CreateProjectRequest,
  type CreateProjectResponse,
  type ProjectListItem,
  type ProjectStatus,
  type ProjectActivityStatus,
} from "@/core/ipc";
import { useToast } from "@/shared/ui/use-toast";

import {
  DEFAULT_PROJECTS_QUERY_LIMIT,
  getProjectsResourceSnapshot,
  mutateProjectsResource,
  refreshProjectsResource,
} from "../data/projectsResource";

export interface CreateProjectActionPayload {
  name: string;
  projectType: CreateProjectRequest["projectType"];
  srcLang: string;
  tgtLang: string;
  files: string[];
}

interface CreateProjectActionResult {
  action: (payload: CreateProjectActionPayload) => void;
  isPending: boolean;
}

const DEFAULT_STATUS: ProjectStatus = "active";
const DEFAULT_ACTIVITY_STATUS: ProjectActivityStatus = "pending";

function buildOptimisticProject(
  payload: CreateProjectActionPayload,
  tempId: string,
): ProjectListItem {
  const now = new Date().toISOString();
  return {
    projectId: tempId,
    name: payload.name,
    slug: toSlug(payload.name) ?? tempId,
    projectType: payload.projectType,
    status: DEFAULT_STATUS,
    activityStatus: DEFAULT_ACTIVITY_STATUS,
    fileCount: payload.files.length,
    createdAt: now,
    updatedAt: now,
  };
}

function toSlug(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    return "project";
  }
  return normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function generateTempId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `temp-${Date.now()}`;
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function useCreateProjectAction(): CreateProjectActionResult {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const action = useCallback(
    (payload: CreateProjectActionPayload) => {
      startTransition(() => {
        const snapshot = getProjectsResourceSnapshot();
        const temporaryId = generateTempId();
        const optimistic = buildOptimisticProject(payload, temporaryId);

        mutateProjectsResource((projects) => [optimistic, ...projects]);

        void (async () => {
          try {
            const response = await createProject({
              name: payload.name,
              projectType: payload.projectType,
              defaultSrcLang: payload.srcLang,
              defaultTgtLang: payload.tgtLang,
              files: [...payload.files],
            });

            mutateProjectsResource((projects) =>
              projects.map((project) =>
                project.projectId === temporaryId
                  ? mergeServerResponse(project, response)
                  : project,
              ),
            );

            await refreshProjectsResource();

            toast({
              title: "Project created",
              description: `${payload.name} is ready with ${payload.files.length} file${
                payload.files.length === 1 ? "" : "s"
              } (limit ${DEFAULT_PROJECTS_QUERY_LIMIT}).`,
            });
          } catch (error) {
            mutateProjectsResource(() => snapshot.data.slice());
            toast({
              variant: "destructive",
              title: "Unable to create project",
              description: resolveErrorMessage(error, "Failed to create project. Please try again."),
            });
          }
        })();
      });
    },
    [toast],
  );

  return { action, isPending };
}

function mergeServerResponse(
  project: ProjectListItem,
  response: CreateProjectResponse,
): ProjectListItem {
  const now = new Date().toISOString();
  return {
    ...project,
    projectId: response.projectId,
    slug: response.slug,
    fileCount: response.fileCount,
    updatedAt: now,
  };
}
