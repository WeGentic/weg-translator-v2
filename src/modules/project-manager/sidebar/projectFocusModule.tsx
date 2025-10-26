import { useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Folder, X } from "lucide-react";

import type {
  SidebarTwoModuleDefinition,
  SidebarTwoModuleProps,
} from "@/app/shell/sidebar-two-registry/types";
import {
  PROJECT_CLEAR_EVENT,
  PROJECT_FOCUS_EVENT,
  dispatchProjectClear,
  dispatchProjectFocus,
  ensureProjectName,
  type ProjectFocusDetail,
} from "@/modules/projects/events";
import { queueWorkspaceMainView } from "@/modules/workspace/navigation/main-view-persist";

import "./css/project-focus-tab.css";

export type ProjectFocusModulePayload = ProjectFocusDetail;

export function ProjectFocusSidebarModule({
  payload,
  deactivate,
  requestFocus,
}: SidebarTwoModuleProps<ProjectFocusModulePayload>) {
  const navigate = useNavigate();
  const projectId = payload?.projectId ?? null;

  useEffect(() => {
    if (!projectId) {
      deactivate();
    }
  }, [projectId, deactivate]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    const handleClear = () => {
      deactivate();
    };

    window.addEventListener(PROJECT_CLEAR_EVENT, handleClear);
    return () => {
      window.removeEventListener(PROJECT_CLEAR_EVENT, handleClear);
    };
  }, [projectId, deactivate]);

  useEffect(() => {
    if (payload && requestFocus) {
      requestFocus();
    }
  }, [payload, requestFocus]);

  const projectName = useMemo(() => ensureProjectName(payload?.projectName), [payload?.projectName]);

  const handleOpen = useCallback(() => {
    if (!projectId) {
      return;
    }

    dispatchProjectFocus({
      projectId,
      projectName,
      source: "manual",
    });

    void navigate({
      to: "/projects/$projectId",
      params: { projectId },
    }).catch((error) => {
      console.error(`Failed to navigate to project ${projectId} from sidebar tab`, error);
    });
  }, [navigate, projectId, projectName]);

  const handleDismiss = useCallback(() => {
    if (!projectId) {
      deactivate();
      return;
    }

    dispatchProjectClear();
    queueWorkspaceMainView("projects");

    void navigate({ to: "/" }).catch((error) => {
      console.error("Failed to return to project workspace after dismissing tab", error);
    });

    deactivate();
  }, [deactivate, navigate, projectId]);

  if (!projectId) {
    return null;
  }

  return (
    <div id="sidebar-two-project-focus" className="project-focus-tab" tabIndex={-1}>
      <button
        type="button"
        className="sidebar-two-button project-focus-tab__main"
        onClick={handleOpen}
        aria-label={`Open project ${projectName}`}
      >
        <span className="project-focus-tab__icon" aria-hidden="true">
          <Folder />
        </span>
        <span className="project-focus-tab__text">
          <span className="project-focus-tab__title">{projectName}</span>
          <span className="project-focus-tab__subtitle">Project workspace</span>
        </span>
      </button>
      <button
        type="button"
        className="project-focus-tab__close"
        onClick={handleDismiss}
        aria-label={`Close ${projectName} tab`}
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
}

export const projectFocusModuleId = "projects:focus-tab";

export const projectFocusModuleDefinition: SidebarTwoModuleDefinition<ProjectFocusModulePayload> = {
  id: projectFocusModuleId,
  label: "Project Tab",
  scope: "event",
  persist: true,
  order: 1000,
  focusTargetId: "sidebar-two-project-focus",
  trigger: {
    name: PROJECT_FOCUS_EVENT,
    allowedViews: ["*"],
    mapEvent: (event) => {
      const detail = event.detail as ProjectFocusModulePayload | null | undefined;
      if (!detail || !detail.projectId) {
        return { action: "deactivate" };
      }

      return {
        payload: detail,
        view: "project",
        allowedViews: ["*"],
      };
    },
  },
  loader: {
    kind: "component",
    component: ProjectFocusSidebarModule,
  },
};
