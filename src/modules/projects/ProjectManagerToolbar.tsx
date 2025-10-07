import { type ChangeEvent } from "react";
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
  type DatePreset,
  type ProgressFilter,
  type TableFilterKey,
  type TableFilters,
  type TypeFilter,
} from "./state/types";

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
  function applyFilterUpdate<TKey extends TableFilterKey>(key: TKey, value: TableFilters[TKey]) {
    const nextFilters = applyTableFiltersPatch(filters, { kind: "set", key, value });
    if (nextFilters !== filters) {
      onFiltersChange(nextFilters);
    }
  }

  function handleResetFilters() {
    const resetFilters = applyTableFiltersPatch(filters, { kind: "reset" });
    if (resetFilters !== filters) {
      onFiltersChange(resetFilters);
    }
  }

  function handleSearchInputChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    if (value === search) return;
    onSearchChange(value);
  }

  function handleClearSearch() {
    if (!search) return;
    onSearchChange("");
  }

  const activeFiltersCount = countActiveFilters(filters);
  const hasActiveFilters = activeFiltersCount > 0;

  return (
    <TooltipProvider>
      <div className="resources-toolbar-zone" role="toolbar" aria-label="Resources toolbar">
        <div className="flex h-full items-center gap-3 px-3">
          {/* Search - Primary Action */}
          <div className="group relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground opacity-70 transition-opacity duration-200" />
            <Input
              value={search}
              onChange={handleSearchInputChange}
              placeholder="Search projects…"
              className="h-9 pl-9 pr-9"
              aria-label="Search projects"
            />
            {search ? (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground/60 transition-all duration-200 hover:text-foreground hover:bg-[var(--color-tr-muted)]/30 focus-visible:outline-2 focus-visible:outline-[var(--color-tr-ring)] focus-visible:outline-offset-2"
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
                onValueChange={(value) => applyFilterUpdate("progress", value as ProgressFilter)}
              >
                <SelectTrigger className="h-9 w-[120px] border-border/50 bg-background/60 text-sm transition-all duration-200 hover:bg-background/80 hover:border-border/70 focus:ring-2 focus:ring-ring/60">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="backdrop-blur-md">
                  <SelectItem
                    value="all"
                    className="data-[highlighted]:bg-[var(--color-tr-primary-blue)] data-[highlighted]:text-[var(--color-tr-anti-primary)] data-[state=checked]:bg-[var(--color-tr-secondary)] data-[state=checked]:text-[var(--color-tr-navy)] data-[state=checked]:font-semibold"
                  >
                    All Status
                  </SelectItem>
                  <SelectItem
                    value="pending"
                    className="data-[highlighted]:bg-[var(--color-tr-primary-blue)] data-[highlighted]:text-[var(--color-tr-anti-primary)] data-[state=checked]:bg-[var(--color-tr-secondary)] data-[state=checked]:text-[var(--color-tr-navy)] data-[state=checked]:font-semibold"
                  >
                    Pending
                  </SelectItem>
                  <SelectItem
                    value="running"
                    className="data-[highlighted]:bg-[var(--color-tr-primary-blue)] data-[highlighted]:text-[var(--color-tr-anti-primary)] data-[state=checked]:bg-[var(--color-tr-secondary)] data-[state=checked]:text-[var(--color-tr-navy)] data-[state=checked]:font-semibold"
                  >
                    Running
                  </SelectItem>
                  <SelectItem
                    value="completed"
                    className="data-[highlighted]:bg-[var(--color-tr-primary-blue)] data-[highlighted]:text-[var(--color-tr-anti-primary)] data-[state=checked]:bg-[var(--color-tr-secondary)] data-[state=checked]:text-[var(--color-tr-navy)] data-[state=checked]:font-semibold"
                  >
                    Completed
                  </SelectItem>
                  <SelectItem
                    value="failed"
                    className="data-[highlighted]:bg-[var(--color-tr-primary-blue)] data-[highlighted]:text-[var(--color-tr-anti-primary)] data-[state=checked]:bg-[var(--color-tr-secondary)] data-[state=checked]:text-[var(--color-tr-navy)] data-[state=checked]:font-semibold"
                  >
                    Failed
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.projectType}
                onValueChange={(value) => applyFilterUpdate("projectType", value as TypeFilter)}
              >
                <SelectTrigger className="h-9 w-[120px] border-border/50 bg-background/60 text-sm transition-all duration-200 hover:bg-background/80 hover:border-border/70 focus:ring-2 focus:ring-ring/60">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="backdrop-blur-md">
                  <SelectItem
                    value="all"
                    className="data-[highlighted]:bg-[var(--color-tr-primary-blue)] data-[highlighted]:text-[var(--color-tr-anti-primary)] data-[state=checked]:bg-[var(--color-tr-secondary)] data-[state=checked]:text-[var(--color-tr-navy)] data-[state=checked]:font-semibold"
                  >
                    All Types
                  </SelectItem>
                  <SelectItem
                    value="translation"
                    className="data-[highlighted]:bg-[var(--color-tr-primary-blue)] data-[highlighted]:text-[var(--color-tr-anti-primary)] data-[state=checked]:bg-[var(--color-tr-secondary)] data-[state=checked]:text-[var(--color-tr-navy)] data-[state=checked]:font-semibold"
                  >
                    Translation
                  </SelectItem>
                  <SelectItem
                    value="rag"
                    className="data-[highlighted]:bg-[var(--color-tr-primary-blue)] data-[highlighted]:text-[var(--color-tr-anti-primary)] data-[state=checked]:bg-[var(--color-tr-secondary)] data-[state=checked]:text-[var(--color-tr-navy)] data-[state=checked]:font-semibold"
                  >
                    RAG
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.updatedWithin}
                onValueChange={(value) => applyFilterUpdate("updatedWithin", value as DatePreset)}
              >
                <SelectTrigger className="h-9 w-[110px] border-border/50 bg-background/60 text-sm transition-all duration-200 hover:bg-background/80 hover:border-border/70 focus:ring-2 focus:ring-ring/60">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent className="backdrop-blur-md">
                  <SelectItem
                    value="any"
                    className="data-[highlighted]:bg-[var(--color-tr-primary-blue)] data-[highlighted]:text-[var(--color-tr-anti-primary)] data-[state=checked]:bg-[var(--color-tr-secondary)] data-[state=checked]:text-[var(--color-tr-navy)] data-[state=checked]:font-semibold"
                  >
                    Any time
                  </SelectItem>
                  <SelectItem
                    value="24h"
                    className="data-[highlighted]:bg-[var(--color-tr-primary-blue)] data-[highlighted]:text-[var(--color-tr-anti-primary)] data-[state=checked]:bg-[var(--color-tr-secondary)] data-[state=checked]:text-[var(--color-tr-navy)] data-[state=checked]:font-semibold"
                  >
                    Last 24h
                  </SelectItem>
                  <SelectItem
                    value="7d"
                    className="data-[highlighted]:bg-[var(--color-tr-primary-blue)] data-[highlighted]:text-[var(--color-tr-anti-primary)] data-[state=checked]:bg-[var(--color-tr-secondary)] data-[state=checked]:text-[var(--color-tr-navy)] data-[state=checked]:font-semibold"
                  >
                    Last 7d
                  </SelectItem>
                  <SelectItem
                    value="30d"
                    className="data-[highlighted]:bg-[var(--color-tr-primary-blue)] data-[highlighted]:text-[var(--color-tr-anti-primary)] data-[state=checked]:bg-[var(--color-tr-secondary)] data-[state=checked]:text-[var(--color-tr-navy)] data-[state=checked]:font-semibold"
                  >
                    Last 30d
                  </SelectItem>
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

          {/* Mobile Filters - Popover */}
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
                        onValueChange={(value) => applyFilterUpdate("progress", value as ProgressFilter)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="running">Running</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Type</label>
                      <Select
                        value={filters.projectType}
                        onValueChange={(value) => applyFilterUpdate("projectType", value as TypeFilter)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="translation">Translation</SelectItem>
                          <SelectItem value="rag">RAG</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Updated</label>
                      <Select
                        value={filters.updatedWithin}
                        onValueChange={(value) => applyFilterUpdate("updatedWithin", value as DatePreset)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any time</SelectItem>
                          <SelectItem value="24h">Last 24 hours</SelectItem>
                          <SelectItem value="7d">Last 7 days</SelectItem>
                          <SelectItem value="30d">Last 30 days</SelectItem>
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
