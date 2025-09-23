import { useCallback, useMemo, useState } from "react";

import type { ProjectListItem } from "@/ipc";

import {
  parseEditorProjectIdFromKey,
  parseProjectIdFromKey,
  toProjectViewKey,
  type MainView,
} from "@/app/state/main-view";

/**
 * Centralises workspace navigation state: which pane is active, which projects are open, and the
 * currently highlighted file within the editor. The hook purposefully keeps pure data concerns so
 * the UI shell can stay focused on layout composition.
 */
export function useWorkspaceShell(initialView: MainView = "projects") {
  const [mainView, setMainView] = useState<MainView>(initialView);
  const [openProjects, setOpenProjects] = useState<ProjectListItem[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const handleOpenProject = useCallback((project: ProjectListItem) => {
    setOpenProjects((previous) => {
      const existingIndex = previous.findIndex((item) => item.projectId === project.projectId);
      if (existingIndex >= 0) {
        const next = [...previous];
        next[existingIndex] = project;
        return next;
      }
      return [...previous, project];
    });
    setMainView(toProjectViewKey(project.projectId));
  }, []);

  const handleCloseProject = useCallback((projectId: string) => {
    setOpenProjects((previous) => {
      const next = previous.filter((project) => project.projectId !== projectId);
      setMainView((current) => {
        if (parseProjectIdFromKey(current) === projectId || parseEditorProjectIdFromKey(current) === projectId) {
          if (next.length > 0) {
            const fallback = next[next.length - 1];
            return toProjectViewKey(fallback.projectId);
          }
          return "projects";
        }
        return current;
      });
      return next;
    });
  }, []);

  const currentProjectId = useMemo(() => parseProjectIdFromKey(mainView), [mainView]);
  const currentEditorProjectId = useMemo(() => parseEditorProjectIdFromKey(mainView), [mainView]);

  const activeProject = useMemo(() => {
    if (!currentProjectId) {
      return null;
    }
    return openProjects.find((project) => project.projectId === currentProjectId) ?? null;
  }, [currentProjectId, openProjects]);

  const activeEditorProject = useMemo(() => {
    if (!currentEditorProjectId) {
      return null;
    }
    return openProjects.find((project) => project.projectId === currentEditorProjectId) ?? null;
  }, [currentEditorProjectId, openProjects]);

  return {
    mainView,
    setMainView,
    openProjects,
    handleOpenProject,
    handleCloseProject,
    currentProjectId,
    currentEditorProjectId,
    activeProject,
    activeEditorProject,
    selectedFileId,
    setSelectedFileId,
  } as const;
}
