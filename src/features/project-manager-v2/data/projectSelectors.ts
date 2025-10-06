import type { ProjectListItem } from "@/ipc";

import type { ProjectFilterPreset, UpdatedWithinPreset } from "./projectFilters";

const WHITESPACE_RE = /\s+/u;

export function normalizeSearch(value: string): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
}

export function tokenizeSearch(value: string): string[] {
  const normalized = normalizeSearch(value);
  if (!normalized) {
    return [];
  }
  return normalized.split(WHITESPACE_RE).filter(Boolean);
}

export function filterProjectsBySearch(projects: ProjectListItem[], search: string): ProjectListItem[] {
  const tokens = tokenizeSearch(search);
  if (tokens.length === 0) {
    return projects;
  }

  return projects.filter((project) => matchProjectTokens(project, tokens));
}

export function filterProjectsByPreset(
  projects: ProjectListItem[],
  filters: ProjectFilterPreset,
  currentTime = Date.now(),
): ProjectListItem[] {
  if (projects.length === 0) {
    return projects;
  }

  return projects.filter((project) => matchesProjectFilters(project, filters, currentTime));
}

export function matchProjectTokens(project: ProjectListItem, tokens: string[]): boolean {
  if (tokens.length === 0) {
    return true;
  }

  const haystack = buildProjectSearchFields(project);
  if (haystack.length === 0) {
    return false;
  }

  for (const token of tokens) {
    let matched = false;
    for (const field of haystack) {
      if (field.includes(token)) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      return false;
    }
  }
  return true;
}

function buildProjectSearchFields(project: ProjectListItem): string[] {
  const fields: Array<string | undefined | null | number> = [
    project.name,
    project.slug,
    project.status,
    project.projectType,
    project.activityStatus,
  ];

  const result: string[] = [];
  for (const field of fields) {
    if (field == null) {
      continue;
    }
    const stringValue = typeof field === "string" ? field : String(field);
    if (stringValue.length === 0) {
      continue;
    }
    result.push(stringValue.toLowerCase());
  }
  return result;
}

export function collectProjectIds(projects: ProjectListItem[]): string[] {
  if (projects.length === 0) {
    return [];
  }
  return projects.map((project) => project.projectId).filter((id) => typeof id === "string" && id.length > 0);
}

export function selectProjectsByIds(
  projects: ProjectListItem[],
  selectedIds: ReadonlySet<string>,
): ProjectListItem[] {
  if (projects.length === 0 || selectedIds.size === 0) {
    return [];
  }
  return projects.filter((project) => selectedIds.has(project.projectId));
}

export interface SelectionSummary {
  selectedCount: number;
  totalFileCount: number;
  statusCounts: Record<string, number>;
  typeCounts: Record<string, number>;
}

export interface ProjectsOverviewMetrics {
  totalProjects: number;
  activeProjects: number;
  totalFiles: number;
  recentlyUpdated: number;
}

export function summarizeSelection(selectedProjects: ProjectListItem[]): SelectionSummary {
  const summary: SelectionSummary = {
    selectedCount: selectedProjects.length,
    totalFileCount: 0,
    statusCounts: Object.create(null) as Record<string, number>,
    typeCounts: Object.create(null) as Record<string, number>,
  };

  if (selectedProjects.length === 0) {
    return summary;
  }

  for (const project of selectedProjects) {
    summary.totalFileCount += Number.isFinite(project.fileCount) ? project.fileCount : 0;

    const status = project.status ?? "unknown";
    summary.statusCounts[status] = (summary.statusCounts[status] ?? 0) + 1;

    const type = project.projectType ?? "unknown";
    summary.typeCounts[type] = (summary.typeCounts[type] ?? 0) + 1;
  }

  return summary;
}

export function buildProjectsOverviewMetrics(
  projects: ProjectListItem[],
  currentTime = Date.now(),
): ProjectsOverviewMetrics {
  return {
    totalProjects: projects.length,
    activeProjects: countActiveProjects(projects),
    totalFiles: sumProjectFiles(projects),
    recentlyUpdated: countRecentlyUpdatedProjects(projects, currentTime),
  };
}

export function countActiveProjects(projects: ProjectListItem[]): number {
  if (projects.length === 0) {
    return 0;
  }
  return projects.reduce((total, project) => (project.status === "active" ? total + 1 : total), 0);
}

export function sumProjectFiles(projects: ProjectListItem[]): number {
  if (projects.length === 0) {
    return 0;
  }
  return projects.reduce((total, project) => total + (Number.isFinite(project.fileCount) ? project.fileCount : 0), 0);
}

export function countRecentlyUpdatedProjects(
  projects: ProjectListItem[],
  currentTime = Date.now(),
  windowMs = TWENTY_FOUR_HOURS_IN_MS,
): number {
  if (projects.length === 0) {
    return 0;
  }

  return projects.reduce((total, project) => {
    const timestamp = typeof project.updatedAt === "string" ? Date.parse(project.updatedAt) : Number.NaN;
    if (!Number.isFinite(timestamp)) {
      return total;
    }
    if (currentTime - timestamp <= windowMs) {
      return total + 1;
    }
    return total;
  }, 0);
}

function matchesProjectFilters(
  project: ProjectListItem,
  filters: ProjectFilterPreset,
  currentTime: number,
): boolean {
  if (filters.progress !== "all" && project.activityStatus !== filters.progress) {
    return false;
  }

  if (filters.projectType !== "all" && project.projectType !== filters.projectType) {
    return false;
  }

  if (filters.updatedWithin !== "any" && !isWithinUpdatedWindow(project.updatedAt, filters.updatedWithin, currentTime)) {
    return false;
  }

  return true;
}

function isWithinUpdatedWindow(updatedAt: string | undefined, preset: UpdatedWithinPreset, currentTime: number): boolean {
  const timestamp = typeof updatedAt === "string" ? Date.parse(updatedAt) : Number.NaN;
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const elapsed = currentTime - timestamp;
  if (elapsed < 0) {
    return true;
  }

  switch (preset) {
    case "24h":
      return elapsed <= TWENTY_FOUR_HOURS_IN_MS;
    case "7d":
      return elapsed <= SEVEN_DAYS_IN_MS;
    case "30d":
      return elapsed <= THIRTY_DAYS_IN_MS;
    default:
      return true;
  }
}

const TWENTY_FOUR_HOURS_IN_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_IN_MS = 7 * TWENTY_FOUR_HOURS_IN_MS;
const THIRTY_DAYS_IN_MS = 30 * TWENTY_FOUR_HOURS_IN_MS;
