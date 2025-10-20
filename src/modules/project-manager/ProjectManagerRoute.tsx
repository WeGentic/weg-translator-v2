import { ProjectManagerView, type ProjectManagerViewProps } from "./ProjectManagerView";

export type ProjectManagerRouteProps = ProjectManagerViewProps;

export function ProjectManagerRoute({
  onOpenProject,
  onCreateProject,
}: ProjectManagerRouteProps = {}) {
  return <ProjectManagerView onOpenProject={onOpenProject} onCreateProject={onCreateProject} />;
}

export default ProjectManagerRoute;
