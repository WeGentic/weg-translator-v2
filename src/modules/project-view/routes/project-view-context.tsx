import { createContext, useContext } from "react";

import type { ProjectListItem } from "@/core/ipc";
import type { ProjectBundle } from "@/shared/types/database";
import type { ProjectStatistics } from "@/shared/types/statistics";

export interface ProjectViewContextValue {
  projectId: string;
  summary: ProjectListItem | null;
  bundle: ProjectBundle | null;
  statistics: ProjectStatistics | null;
}

const ProjectViewContext = createContext<ProjectViewContextValue | null>(null);

export interface ProjectViewProviderProps {
  value: ProjectViewContextValue;
  children: React.ReactNode;
}

export function ProjectViewProvider({ value, children }: ProjectViewProviderProps) {
  return <ProjectViewContext.Provider value={value}>{children}</ProjectViewContext.Provider>;
}

export function useProjectViewContext() {
  const context = useContext(ProjectViewContext);
  if (!context) {
    throw new Error("useProjectViewContext must be used within a ProjectViewProvider.");
  }
  return context;
}
