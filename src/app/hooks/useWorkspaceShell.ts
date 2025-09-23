import { useCallback, useMemo, useState } from "react";

import type { ProjectListItem } from "@/ipc";

import {
  parseEditorProjectIdFromKey,
  parseProjectIdFromKey,
  toEditorViewKey,
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
  const [projectCache, setProjectCache] = useState<Record<string, ProjectListItem>>({});
  const [openOverviewIds, setOpenOverviewIds] = useState<string[]>([]);
  const [openEditorIds, setOpenEditorIds] = useState<string[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const handleOpenProject = useCallback((project: ProjectListItem) => {
    setProjectCache((previous) => ({ ...previous, [project.projectId]: project }));
    setOpenOverviewIds((previous) =>
      previous.includes(project.projectId) ? previous : [...previous, project.projectId],
    );
    setMainView(toProjectViewKey(project.projectId));
  }, []);

  const openEditorView = useCallback((projectId: string) => {
    if (!projectId) {
      return;
    }
    setOpenEditorIds((previous) =>
      previous.includes(projectId) ? previous : [...previous, projectId],
    );
  }, []);

  const forgetProjectIfUnused = useCallback(
    (projectId: string, remainingOverviews: string[], remainingEditors: string[]) => {
      if (remainingOverviews.includes(projectId) || remainingEditors.includes(projectId)) {
        return;
      }
      setProjectCache((previous) => {
        if (!(projectId in previous)) {
          return previous;
        }
        const next = { ...previous };
        delete next[projectId];
        return next;
      });
    },
    [],
  );

  const handleCloseOverview = useCallback(
    (projectId: string) => {
      const nextOverviews = openOverviewIds.filter((id) => id !== projectId);
      setOpenOverviewIds(nextOverviews);

      setMainView((current) => {
        if (parseProjectIdFromKey(current) === projectId) {
          if (nextOverviews.length > 0) {
            return toProjectViewKey(nextOverviews[Math.max(0, nextOverviews.length - 1)]);
          }
          if (openEditorIds.length > 0) {
            const fallbackEditor = openEditorIds[openEditorIds.length - 1];
            return toEditorViewKey(fallbackEditor);
          }
          return "projects";
        }
        return current;
      });

      forgetProjectIfUnused(projectId, nextOverviews, openEditorIds);
    },
    [forgetProjectIfUnused, openEditorIds, openOverviewIds, setMainView],
  );

  const handleCloseEditor = useCallback(
    (projectId: string) => {
      const nextEditors = openEditorIds.filter((id) => id !== projectId);
      setOpenEditorIds(nextEditors);

      setMainView((current) => {
        if (parseEditorProjectIdFromKey(current) === projectId) {
          if (openOverviewIds.includes(projectId)) {
            return toProjectViewKey(projectId);
          }
          if (nextEditors.length > 0) {
            return toEditorViewKey(nextEditors[nextEditors.length - 1]);
          }
          if (openOverviewIds.length > 0) {
            return toProjectViewKey(openOverviewIds[openOverviewIds.length - 1]);
          }
          return "projects";
        }
        return current;
      });

      if (parseEditorProjectIdFromKey(mainView) === projectId) {
        setSelectedFileId(null);
      }

      forgetProjectIfUnused(projectId, openOverviewIds, nextEditors);
    },
    [forgetProjectIfUnused, mainView, openEditorIds, openOverviewIds, setMainView],
  );

  const currentProjectId = useMemo(() => parseProjectIdFromKey(mainView), [mainView]);
  const currentEditorProjectId = useMemo(() => parseEditorProjectIdFromKey(mainView), [mainView]);

  const activeProject = useMemo(() => {
    if (!currentProjectId) {
      return null;
    }
    return projectCache[currentProjectId] ?? null;
  }, [currentProjectId, projectCache]);

  const activeEditorProject = useMemo(() => {
    if (!currentEditorProjectId) {
      return null;
    }
    return projectCache[currentEditorProjectId] ?? null;
  }, [currentEditorProjectId, projectCache]);

  const openProjectOverviews = useMemo(() => {
    return openOverviewIds
      .map((id) => projectCache[id])
      .filter((project): project is ProjectListItem => Boolean(project));
  }, [openOverviewIds, projectCache]);

  const openProjectEditors = useMemo(() => {
    return openEditorIds
      .map((id) => projectCache[id])
      .filter((project): project is ProjectListItem => Boolean(project));
  }, [openEditorIds, projectCache]);

  return {
    mainView,
    setMainView,
    openOverviewIds,
    openEditorIds,
    openProjectOverviews,
    openProjectEditors,
    handleOpenProject,
    handleCloseOverview,
    handleCloseEditor,
    openEditorView,
    currentProjectId,
    currentEditorProjectId,
    activeProject,
    activeEditorProject,
    selectedFileId,
    setSelectedFileId,
  } as const;
}
