import type { ProjectListItem } from "@/core/ipc";

import { ProjectManagerView } from "./ProjectManagerView";

export type ProjectManagerRouteProps = {
  onOpenProject?: (project: ProjectListItem) => void;
  onCreateProject?: () => void;
};

export function ProjectManagerRoute({ onOpenProject, onCreateProject }: ProjectManagerRouteProps) {
  return <ProjectManagerView onOpenProject={onOpenProject} onCreateProject={onCreateProject} />;
}
