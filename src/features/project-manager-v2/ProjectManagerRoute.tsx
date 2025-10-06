import type { ProjectListItem } from "@/ipc";

import { ProjectManagerShell } from "./shell/ProjectManagerShell";
import { ProjectsBoundary } from "./shell/boundaries/ProjectsBoundary";

type ProjectManagerRouteProps = {
  onOpenProject?: (project: ProjectListItem) => void;
  onCreateProject?: () => void;
};

export function ProjectManagerRoute({ onOpenProject, onCreateProject }: ProjectManagerRouteProps) {
  return (
    <ProjectsBoundary>
      <ProjectManagerShell onOpenProject={onOpenProject} onCreateProjectOpen={onCreateProject} />
    </ProjectsBoundary>
  );
}
