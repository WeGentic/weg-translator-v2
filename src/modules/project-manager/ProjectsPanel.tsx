import type { ProjectListItem } from "@/core/ipc";

import { ProjectManagerView } from "./ProjectManagerView";

export interface ProjectsPanelProps {
  onOpenProject?: (project: ProjectListItem) => void;
}

export function ProjectsPanel({ onOpenProject }: ProjectsPanelProps) {
  return <ProjectManagerView onOpenProject={onOpenProject} />;
}

export default ProjectsPanel;
