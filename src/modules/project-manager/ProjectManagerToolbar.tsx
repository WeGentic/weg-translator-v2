import { type ChangeEvent, useCallback } from "react";
import { Filter, Search, X } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Separator } from "@/shared/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";

import {
  applyTableFiltersPatch,
  countActiveFilters,
  DATE_PRESET_OPTIONS,
  PROGRESS_FILTER_OPTIONS,
  PROJECT_TYPE_FILTER_OPTIONS,
  type DatePreset,
  type ProgressFilter,
  type TableFilters,
  type TableFiltersPatch,
  type TypeFilter,
} from "./state/types";

import "./css/project-manager-toolbar.css";

const filterTriggerClassName =
  "project-filter-trigger text-[14px] text-(--color-victorian-peacock-900)/70";
const filterContentClassName = "bg-(--color-victorian-peacock-100) mt-2 border-none";
const filterItemClassName =
  "data-highlighted:bg-(--color-primary) data-highlighted:text-(--color-victorian-peacock-900) data-[state=checked]:bg-(--color-secondary) data-[state=checked]:text-(--color-victorian-peacock-50) data-[state=checked]:font-semibold";

export interface ProjectManagerToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: TableFilters;
  onFiltersChange: (nextFilters: TableFilters) => void;
}

export function ProjectManagerToolbar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
}: ProjectManagerToolbarProps) {
  const applyFilters = useCallback((patch: TableFiltersPatch) => {
    const nextFilters = applyTableFiltersPatch(filters, patch);
    if (nextFilters !== filters) {
      onFiltersChange(nextFilters);
    }
  }, [filters, onFiltersChange]);

  const handleResetFilters = useCallback(() => {
    applyFilters({ kind: "reset" });
  }, [applyFilters]);

  const handleProgressChange = useCallback(
    (value: ProgressFilter) => {
      applyFilters({ kind: "set", key: "progress", value });
    },
    [applyFilters],
  );

  const handleProjectTypeChange = useCallback(
    (value: TypeFilter) => {
      applyFilters({ kind: "set", key: "projectType", value });
    },
    [applyFilters],
  );

  const handleDatePresetChange = useCallback(
    (value: DatePreset) => {
      applyFilters({ kind: "set", key: "updatedWithin", value });
    },
    [applyFilters],
  );

  const commitSearch = useCallback(
    (value: string) => {
      if (value !== search) {
        onSearchChange(value);
      }
    },
    [onSearchChange, search],
  );

  const handleSearchInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      commitSearch(event.target.value);
    },
    [commitSearch],
  );

  const handleClearSearch = useCallback(() => {
    if (!search) {
      return;
    }
    commitSearch("");
  }, [commitSearch, search]);

  const activeFiltersCount = countActiveFilters(filters);
  const hasActiveFilters = activeFiltersCount > 0;

  return (
    <TooltipProvider>
      <div className="resources-toolbar-zone" role="toolbar" aria-label="Resources toolbar">
        <div className="flex h-full items-center gap-3 px-3">
          {/* Search - Primary Action */}
          <div className="group relative flex-1 max-w-sm">
            <label htmlFor="clients-search-input" className="sr-only">
              Search projects
            </label>
<Search className="
            pointer-events-none
            absolute left-3
            top-1/2 h-3.5 w-3.5 -translate-y-1/2
            text-(--color-victorian-peacock-900)/70
            transition-opacity duration-200 group-focus-within:opacity-100" />
            <Input
              id="project-search-input"
              type="search"
              value={search}
              onChange={handleSearchInputChange}
              placeholder="Search projects…"
              className="project-search-input"
              aria-label="Search projects"
              autoComplete="off"
            />
            {search ? (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground/60 transition-all duration-200 hover:text-foreground hover:bg-[var(--color-muted)]/30 focus-visible:outline-2 focus-visible:outline-[var(--color-ring)] focus-visible:outline-offset-2"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>

          {/* Desktop Filters - Hidden on Mobile */}
          <div className="hidden items-center gap-2 lg:flex">
            <div className="flex items-center gap-1.5">
              <Select
                value={filters.progress}
                onValueChange={handleProgressChange}
              >
                <SelectTrigger className={filterTriggerClassName}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className={filterContentClassName}>
                  {PROGRESS_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option} className={filterItemClassName}>
                      {option === "all" ? "All Status" : option.charAt(0).toUpperCase() + option.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.projectType}
                onValueChange={handleProjectTypeChange}
              >
                <SelectTrigger className={filterTriggerClassName}>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className={filterContentClassName}>
                  {PROJECT_TYPE_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option} className={filterItemClassName}>
                      {option === "all" ? "All Types" : option.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.updatedWithin}
                onValueChange={handleDatePresetChange}
              >
                <SelectTrigger className={filterTriggerClassName}>
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent className={filterContentClassName}>
                  {DATE_PRESET_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option} className={filterItemClassName}>
                      {option === "any" ? "Any time" : `Last ${option}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters ? (
              <div className="border-l border-border/30 pl-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleResetFilters}
                      className="h-9 w-9 p-0 text-muted-foreground transition-all duration-200 hover:bg-muted/60 hover:text-foreground"
                      aria-label="Clear all filters"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Clear all filters</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            ) : null}
          </div>

          {/* Small Width Filters - Popover */}
          <div className="lg:hidden">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="relative h-9 px-3"
                  aria-label="Open filters"
                >
                  <Filter className="mr-2 h-3 w-3 opacity-70" />
                  <span>Filters</span>
                  {activeFiltersCount > 0 ? (
                    <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-primary to-primary/80 text-[11px] font-bold text-primary-foreground shadow-lg animate-pulse">
                      {activeFiltersCount}
                    </span>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="end">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Filters</h3>
                    {hasActiveFilters ? (
                      <Button variant="ghost" size="sm" onClick={handleResetFilters} className="h-7 px-2 text-xs">
                        <X className="mr-1 h-3 w-3" />
                        Clear all
                      </Button>
                    ) : null}
                  </div>
                  <Separator className="my-2" />

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Status</label>
                      <Select
                        value={filters.progress}
                        onValueChange={handleProgressChange}
                      >
                        <SelectTrigger className={filterTriggerClassName}>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className={filterContentClassName}>
                          {PROGRESS_FILTER_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option} className={filterItemClassName}>
                              {option === "all" ? "All Status" : option.charAt(0).toUpperCase() + option.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Type</label>
                      <Select
                        value={filters.projectType}
                        onValueChange={handleProjectTypeChange}
                      >
                        <SelectTrigger className={filterTriggerClassName}>
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent className={filterContentClassName}>
                          {PROJECT_TYPE_FILTER_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option} className={filterItemClassName}>
                              {option === "all" ? "All Types" : option.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Updated</label>
                      <Select
                        value={filters.updatedWithin}
                        onValueChange={handleDatePresetChange}
                      >
                        <SelectTrigger className={filterTriggerClassName}>
                          <SelectValue placeholder="Date" />
                        </SelectTrigger>
                        <SelectContent className={filterContentClassName}>
                          {DATE_PRESET_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option} className={filterItemClassName}>
                              {option === "any" ? "Any time" : `Last ${option}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
