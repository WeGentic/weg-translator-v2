import type { ProjectListItem } from "@/ipc";
import type { TableFilters } from "../types/types";

export function filterProjects(items: ProjectListItem[], filters: TableFilters, search: string): ProjectListItem[] {
  const normalizedSearch = search.trim().toLowerCase();
  const now = Date.now();
  const { progress, projectType, updatedWithin } = filters;
  const normalizedProgress = progress === "all" ? "all" : progress.toLowerCase();
  const normalizedType = projectType === "all" ? "all" : projectType.toLowerCase();

  const thresholdMs =
    updatedWithin === "24h"
      ? 24 * 60 * 60 * 1000
      : updatedWithin === "7d"
        ? 7 * 24 * 60 * 60 * 1000
        : updatedWithin === "30d"
          ? 30 * 24 * 60 * 60 * 1000
          : null;

  const filtered = items.filter((item) => {
    const activityStatus = item.activityStatus?.toLowerCase();
    const type = item.projectType?.toLowerCase();

    if (normalizedProgress !== "all" && activityStatus !== normalizedProgress) return false;
    if (normalizedType !== "all" && type !== normalizedType) return false;
    if (thresholdMs != null) {
      const updatedAt = Date.parse(item.updatedAt);
      if (Number.isFinite(updatedAt) && now - updatedAt > thresholdMs) {
        return false;
      }
    }
    return true;
  });

  if (normalizedSearch.length === 0) {
    return filtered;
  }

  return filtered.filter((item) => {
    const fields: Array<string | number | undefined> = [
      item.name,
      item.slug,
      item.projectType,
      item.status,
      item.activityStatus,
    ];

    return fields.some((value) => {
      if (value == null) return false;
      const stringValue = typeof value === "string" ? value.toLowerCase() : String(value).toLowerCase();
      // console.log('search check', normalizedSearch, stringValue, stringValue.includes(normalizedSearch));
      return stringValue.includes(normalizedSearch);
    });
  });
}
