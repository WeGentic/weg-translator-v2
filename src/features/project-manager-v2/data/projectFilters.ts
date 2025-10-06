import type { ProjectActivityStatus, ProjectType } from "@/ipc";

export type ProgressFilterValue = "all" | ProjectActivityStatus;
export type ProjectTypeFilterValue = "all" | ProjectType;
export type UpdatedWithinPreset = "any" | "24h" | "7d" | "30d";

export interface ProjectFilterPreset {
  progress: ProgressFilterValue;
  projectType: ProjectTypeFilterValue;
  updatedWithin: UpdatedWithinPreset;
}

const DEFAULT_FILTER_PRESET: ProjectFilterPreset = Object.freeze({
  progress: "all" as ProgressFilterValue,
  projectType: "all" as ProjectTypeFilterValue,
  updatedWithin: "any" as UpdatedWithinPreset,
});

export const PROJECT_FILTER_DEFAULT: ProjectFilterPreset = {
  ...DEFAULT_FILTER_PRESET,
};

export const PROGRESS_FILTER_OPTIONS: readonly ProgressFilterValue[] = [
  "all",
  "pending",
  "running",
  "completed",
  "failed",
] as const;

export const PROJECT_TYPE_FILTER_OPTIONS: readonly ProjectTypeFilterValue[] = [
  "all",
  "translation",
  "rag",
] as const;

export const UPDATED_WITHIN_OPTIONS: readonly UpdatedWithinPreset[] = [
  "any",
  "24h",
  "7d",
  "30d",
] as const;

export function normalizeProjectFilterPreset(
  preset?: Partial<ProjectFilterPreset>,
): ProjectFilterPreset {
  const next: ProjectFilterPreset = { ...PROJECT_FILTER_DEFAULT };

  if (preset?.progress && isProgressFilterValue(preset.progress)) {
    next.progress = preset.progress;
  }

  if (preset?.projectType && isProjectTypeFilterValue(preset.projectType)) {
    next.projectType = preset.projectType;
  }

  if (preset?.updatedWithin && isUpdatedWithinPreset(preset.updatedWithin)) {
    next.updatedWithin = preset.updatedWithin;
  }

  return next;
}

export function countActiveFilters(filters: ProjectFilterPreset): number {
  let count = 0;
  if (filters.progress !== "all") {
    count += 1;
  }
  if (filters.projectType !== "all") {
    count += 1;
  }
  if (filters.updatedWithin !== "any") {
    count += 1;
  }
  return count;
}

export function hasActiveFilters(filters: ProjectFilterPreset): boolean {
  return countActiveFilters(filters) > 0;
}

function isProgressFilterValue(value: unknown): value is ProgressFilterValue {
  return typeof value === "string" && (PROGRESS_FILTER_OPTIONS as readonly string[]).includes(value);
}

function isProjectTypeFilterValue(value: unknown): value is ProjectTypeFilterValue {
  return typeof value === "string" && (PROJECT_TYPE_FILTER_OPTIONS as readonly string[]).includes(value);
}

function isUpdatedWithinPreset(value: unknown): value is UpdatedWithinPreset {
  return typeof value === "string" && (UPDATED_WITHIN_OPTIONS as readonly string[]).includes(value);
}
