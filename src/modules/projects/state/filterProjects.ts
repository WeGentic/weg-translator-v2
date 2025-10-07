import type { ProjectListItem } from "@/core/ipc";

import type { DatePreset, TableFilters } from "./types";

const UPDATED_WITHIN_THRESHOLDS: Record<DatePreset, number | null> = {
  any: null,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const SEARCHABLE_FIELDS: Array<keyof Pick<ProjectListItem, "name" | "slug" | "projectType" | "status" | "activityStatus">> = [
  "name",
  "slug",
  "projectType",
  "status",
  "activityStatus",
];

function withinUpdatedThreshold(item: ProjectListItem, thresholdMs: number | null, now: number): boolean {
  if (thresholdMs == null) {
    return true;
  }

  const updatedAt = Date.parse(item.updatedAt);
  return Number.isFinite(updatedAt) && now - updatedAt <= thresholdMs;
}

function includesSearchTerm(item: ProjectListItem, normalizedSearch: string): boolean {
  if (!normalizedSearch) {
    return true;
  }

  return SEARCHABLE_FIELDS.some((field) => {
    const value = item[field];
    if (value == null) {
      return false;
    }

    const stringValue = typeof value === "string" ? value : String(value);
    return stringValue.toLowerCase().includes(normalizedSearch);
  });
}

export function filterProjects(items: ProjectListItem[], filters: TableFilters, search: string): ProjectListItem[] {
  const normalizedSearch = search.trim().toLowerCase();
  const now = Date.now();
  const thresholdMs = UPDATED_WITHIN_THRESHOLDS[filters.updatedWithin];

  return items.filter((item) => {
    const activityStatus = item.activityStatus?.toLowerCase() as string | undefined;
    const projectType = item.projectType?.toLowerCase() as string | undefined;

    if (filters.progress !== "all" && activityStatus !== filters.progress) {
      return false;
    }

    if (filters.projectType !== "all" && projectType !== filters.projectType) {
      return false;
    }

    if (!withinUpdatedThreshold(item, thresholdMs, now)) {
      return false;
    }

    return includesSearchTerm(item, normalizedSearch);
  });
}
