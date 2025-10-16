import type { ProjectListItem, ProjectStatus, ProjectType, ProjectActivityStatus } from "@/core/ipc";
import type { DateParts } from "@/shared/utils/datetime";

export type { ProjectListItem, ProjectStatus, ProjectType };

export type ProjectRow = {
  id: string;
  name: string;
  slug: string;
  projectType: ProjectType;
  status: ProjectStatus;
  activityStatus: ProjectActivityStatus;
  fileCount: number;
  created: DateParts;
  updated: DateParts;
};

export type ProgressFilter = string;
export type TypeFilter = string;
export type DatePreset = "any" | "24h" | "7d" | "30d";

export interface TableFilters {
  progress: ProgressFilter;
  projectType: TypeFilter;
  updatedWithin: DatePreset;
}

export interface ProjectsDataTableProps {
  items: ProjectListItem[];
  onOpenProject?: (projectId: string) => void;
  onRequestDelete?: (projectId: string, projectName: string) => void;
  onCreateProject?: () => void;
  // Row selection
  selectedRows?: Set<string>;
  onRowSelectionChange?: (selectedRows: Set<string>) => void;
  // Batch operations
  onBatchDelete?: (projectIds: string[]) => Promise<void>;
}
