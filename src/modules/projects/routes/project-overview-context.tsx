import { createContext, useContext } from "react";

import type { ProjectListItem } from "@/core/ipc";
import type { ProjectBundle } from "@/shared/types/database";
import type { ProjectStatistics } from "@/shared/types/statistics";

export interface ProjectOverviewContextValue {
  projectId: string;
  summary: ProjectListItem | null;
  bundle: ProjectBundle | null;
  statistics: ProjectStatistics | null;
}

const ProjectOverviewContext = createContext<ProjectOverviewContextValue | null>(null);

export interface ProjectOverviewProviderProps {
  value: ProjectOverviewContextValue;
  children: React.ReactNode;
}

export function ProjectOverviewProvider({ value, children }: ProjectOverviewProviderProps) {
  return <ProjectOverviewContext.Provider value={value}>{children}</ProjectOverviewContext.Provider>;
}

export function useProjectOverviewContext() {
  const context = useContext(ProjectOverviewContext);
  if (!context) {
    throw new Error("useProjectOverviewContext must be used within a ProjectOverviewProvider.");
  }
  return context;
}
