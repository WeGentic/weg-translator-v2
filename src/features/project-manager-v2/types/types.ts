import type { ProjectActivityStatus, ProjectListItem, ProjectStatus, ProjectType } from "@/ipc";
import type { DateParts } from "@/lib/datetime";

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

export const PROGRESS_FILTER_OPTIONS = ["all", "pending", "running", "completed", "failed"] as const;
export type ProgressFilter = (typeof PROGRESS_FILTER_OPTIONS)[number];

export const PROJECT_TYPE_FILTER_OPTIONS = ["all", "translation", "rag"] as const;
export type TypeFilter = (typeof PROJECT_TYPE_FILTER_OPTIONS)[number];

export const DATE_PRESET_OPTIONS = ["any", "24h", "7d", "30d"] as const;
export type DatePreset = (typeof DATE_PRESET_OPTIONS)[number];

export type TableFilters = Readonly<{
  progress: ProgressFilter;
  projectType: TypeFilter;
  updatedWithin: DatePreset;
}>;

export const TABLE_FILTER_DEFAULTS = {
  progress: "all",
  projectType: "all",
  updatedWithin: "any",
} as const satisfies TableFilters;

export type TableFilterKey = keyof TableFilters;

export type TableFiltersPatch =
  | { kind: "reset" }
  | { kind: "set"; key: TableFilterKey; value: TableFilters[TableFilterKey] };

export function createDefaultTableFilters(): TableFilters {
  return {
    progress: "all",
    projectType: "all",
    updatedWithin: "any",
  };
}

export function tableFiltersEqual(a: TableFilters, b: TableFilters): boolean {
  return a.progress === b.progress && a.projectType === b.projectType && a.updatedWithin === b.updatedWithin;
}

export function applyTableFiltersPatch(current: TableFilters, patch: TableFiltersPatch): TableFilters {
  if (patch.kind === "reset") {
    return tableFiltersEqual(current, TABLE_FILTER_DEFAULTS) ? current : createDefaultTableFilters();
  }

  if (current[patch.key] === patch.value) {
    return current;
  }

  return {
    ...current,
    [patch.key]: patch.value,
  } satisfies TableFilters;
}

export function countActiveFilters(filters: TableFilters): number {
  let count = 0;
  if (filters.progress !== "all") count += 1;
  if (filters.projectType !== "all") count += 1;
  if (filters.updatedWithin !== "any") count += 1;
  return count;
}

export type TableControlsState = Readonly<{
  search: string;
  filters: TableFilters;
}>;

export function createDefaultTableControlsState(): TableControlsState {
  return {
    search: "",
    filters: createDefaultTableFilters(),
  };
}

export interface ProjectManagerContentProps {
  items: ProjectListItem[];
  onOpenProject?: (projectId: string) => void;
  onRequestDelete?: (projectId: string, projectName: string) => void;
  selectedRows?: ReadonlySet<string>;
  onRowSelectionChange?: (selectedRows: Set<string>) => void;
}
