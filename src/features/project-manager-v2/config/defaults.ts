import type { SortingState } from "@tanstack/react-table";

import { PROJECT_FILTER_DEFAULT, type ProjectFilterPreset } from "../data/projectFilters";

export const PROJECT_MANAGER_DEFAULT_SEARCH = "";

const SORTING_BLUEPRINT: SortingState = [
  { id: "updatedAt", desc: true },
];

export function createDefaultProjectManagerSorting(): SortingState {
  return SORTING_BLUEPRINT.map((entry) => ({ ...entry }));
}

export const PROJECT_MANAGER_DEFAULT_SORTING: SortingState = createDefaultProjectManagerSorting();

export function createDefaultProjectManagerFilters(): ProjectFilterPreset {
  return { ...PROJECT_FILTER_DEFAULT };
}

export const PROJECT_MANAGER_DEFAULT_FILTERS: ProjectFilterPreset = createDefaultProjectManagerFilters();

export const PROJECT_MANAGER_SORTABLE_COLUMNS = Object.freeze({
  updatedAt: "updatedAt",
  name: "name",
  status: "status",
});
