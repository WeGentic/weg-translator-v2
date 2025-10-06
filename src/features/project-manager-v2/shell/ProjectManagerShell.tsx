import { useCallback, useEffect, useState } from "react";

import type { ProjectListItem } from "@/ipc";

import { useBatchDeleteProjectsAction } from "../actions/batchDeleteAction";
import { ProjectManagerContent } from "../content/ProjectManagerContent";
import { useProjectsResource, collectProjectIds, selectProjectsByIds, summarizeSelection } from "../data";
import { ProjectManagerStoreProvider, useProjectManagerSelector, useProjectManagerStoreApi } from "../state";
import { DeleteProjectDialog } from "../mutations/DeleteProjectDialog";
import { CreateProjectWizard } from "../wizard/CreateProjectWizard";
import { ProjectManagerHeader } from "./header/ProjectManagerHeader";
import { useSidebarContentSync } from "../sidebar/useSidebarContentSync";
import { ProjectManagerToolbar } from "./toolbar/ProjectManagerToolbar";

interface ProjectManagerShellProps {
  onOpenProject?: (project: ProjectListItem) => void;
  onCreateProjectOpen?: () => void;
}

export function ProjectManagerShell({ onOpenProject, onCreateProjectOpen }: ProjectManagerShellProps) {
  return (
    <ProjectManagerStoreProvider>
      <ProjectManagerShellBody onOpenProject={onOpenProject} onCreateProjectOpen={onCreateProjectOpen} />
    </ProjectManagerStoreProvider>
  );
}

function ProjectManagerShellBody({ onOpenProject, onCreateProjectOpen }: ProjectManagerShellProps) {
  const { projects } = useProjectsResource();
  const store = useProjectManagerStoreApi();
  const removeSelection = useProjectManagerSelector((state) => state.removeSelection);
  const selectedIds = useProjectManagerSelector((state) => state.selectedIds);

  const batchDelete = useBatchDeleteProjectsAction({
    onSuccess: (completedIds) => {
      if (completedIds.length > 0) {
        removeSelection(completedIds);
      }
    },
  });

  const handleBatchDelete = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) {
        return;
      }
      batchDelete.run({ projectIds: ids });
    },
    [batchDelete],
  );

  const handleOpenProject = useCallback(
    (project: ProjectListItem) => {
      onOpenProject?.(project);
    },
    [onOpenProject],
  );

  useEffect(() => {
    store.getState().pruneSelection(collectProjectIds(projects));
  }, [projects, store]);

  const [isWizardOpen, setWizardOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectListItem | null>(null);

  const selectedProjects = selectProjectsByIds(projects, selectedIds);
  const selectionSummary = summarizeSelection(selectedProjects);

  useSidebarContentSync({
    projects,
    onBatchDelete: handleBatchDelete,
    isDeleting: batchDelete.isPending,
    onOpenProject: handleOpenProject,
  });

  return (
    <div className="flex h-full flex-col gap-4">
      <ProjectManagerHeader
        onCreateProject={() => {
          onCreateProjectOpen?.();
          setWizardOpen(true);
        }}
      />

      <ProjectManagerToolbar
        onRequestBatchDelete={() => {
          handleBatchDelete(Array.from(selectedIds));
        }}
        isDeleting={batchDelete.isPending}
        selectionSummary={selectionSummary}
      />

      <div className="flex flex-1 gap-4">
        <ProjectManagerContent
          projects={projects}
          onRequestDelete={(project) => {
            setDeleteTarget(project);
          }}
          onOpenProject={handleOpenProject}
        />
      </div>

      <CreateProjectWizard open={isWizardOpen} onOpenChange={setWizardOpen} />

      <DeleteProjectDialog
        project={deleteTarget}
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        onDeleted={(project) => {
          removeSelection([project.projectId]);
        }}
      />
    </div>
  );
}
