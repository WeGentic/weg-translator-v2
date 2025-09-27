import { useMemo } from "react";
import { Plus, Filter, X, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { DatePreset, ProgressFilter, TableFilters, TypeFilter } from "./types";

export interface ProjectsTableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: TableFilters;
  onFiltersChange: (next: TableFilters) => void;
  onCreateProject?: () => void;
}

export function ProjectsTableToolbar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  onCreateProject,
}: ProjectsTableToolbarProps) {
  const setProgress = (value: ProgressFilter) => onFiltersChange({ ...filters, progress: value });
  const setType = (value: TypeFilter) => onFiltersChange({ ...filters, projectType: value });
  const setDate = (value: DatePreset) => onFiltersChange({ ...filters, updatedWithin: value });

  const hasActiveFilters = useMemo(() => {
    return filters.progress !== "all" || filters.projectType !== "all" || filters.updatedWithin !== "any";
  }, [filters]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.progress !== "all") count++;
    if (filters.projectType !== "all") count++;
    if (filters.updatedWithin !== "any") count++;
    return count;
  }, [filters]);

  const resetFilters = () => onFiltersChange({ progress: "all", projectType: "all", updatedWithin: "any" });

  return (
    <TooltipProvider>
      <div className="sticky top-0 z-10 border-b border-border/40 bg-gradient-to-r from-background/98 to-background/95 px-3 py-3 backdrop-blur-md shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            {/* Search - Primary Action */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors duration-200" />
              <Input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search projects…"
                className="h-9 pl-10 pr-4 text-sm border-border/50 bg-background/60 backdrop-blur-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:border-border hover:bg-background/80 hover:border-border/70"
                aria-label="Search projects"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted/60 flex items-center justify-center opacity-0 transition-all duration-200 hover:bg-muted/80 focus-visible:opacity-100 group-hover:opacity-100"
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Desktop Filters - Hidden on Mobile */}
            <div className="hidden lg:flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Select value={filters.progress} onValueChange={(v) => setProgress(v as ProgressFilter)}>
                  <SelectTrigger className="h-9 w-[120px] border-border/50 bg-background/60 text-sm transition-all duration-200 hover:bg-background/80 hover:border-border/70 focus:ring-2 focus:ring-ring/60">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="backdrop-blur-md">
                    <SelectItem value="all" className="hover:bg-muted/80">All Status</SelectItem>
                    <SelectItem value="pending" className="hover:bg-muted/80">Pending</SelectItem>
                    <SelectItem value="running" className="hover:bg-muted/80">Running</SelectItem>
                    <SelectItem value="completed" className="hover:bg-muted/80">Completed</SelectItem>
                    <SelectItem value="failed" className="hover:bg-muted/80">Failed</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filters.projectType} onValueChange={(v) => setType(v as TypeFilter)}>
                  <SelectTrigger className="h-9 w-[110px] border-border/50 bg-background/60 text-sm transition-all duration-200 hover:bg-background/80 hover:border-border/70 focus:ring-2 focus:ring-ring/60">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent className="backdrop-blur-md">
                    <SelectItem value="all" className="hover:bg-muted/80">All Types</SelectItem>
                    <SelectItem value="translation" className="hover:bg-muted/80">Translation</SelectItem>
                    <SelectItem value="rag" className="hover:bg-muted/80">RAG</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filters.updatedWithin} onValueChange={(v) => setDate(v as DatePreset)}>
                  <SelectTrigger className="h-9 w-[110px] border-border/50 bg-background/60 text-sm transition-all duration-200 hover:bg-background/80 hover:border-border/70 focus:ring-2 focus:ring-ring/60">
                    <SelectValue placeholder="Date" />
                  </SelectTrigger>
                  <SelectContent className="backdrop-blur-md">
                    <SelectItem value="any" className="hover:bg-muted/80">Any time</SelectItem>
                    <SelectItem value="24h" className="hover:bg-muted/80">Last 24h</SelectItem>
                    <SelectItem value="7d" className="hover:bg-muted/80">Last 7d</SelectItem>
                    <SelectItem value="30d" className="hover:bg-muted/80">Last 30d</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <div className="pl-1 border-l border-border/30">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={resetFilters}
                        className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200"
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
              )}
            </div>

            {/* Mobile Filters - Popover */}
            <div className="lg:hidden">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 border-border/50 bg-background/60 relative px-3 transition-all duration-200 hover:bg-background/80 hover:border-border/70" aria-label="Open filters">
                    <Filter className="h-4 w-4 mr-2" />
                    <span className="text-sm font-medium">Filters</span>
                    {activeFiltersCount > 0 && (
                      <span className="absolute -top-2 -right-2 h-5 w-5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-[11px] rounded-full flex items-center justify-center font-bold shadow-lg animate-pulse">
                        {activeFiltersCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
              <PopoverContent className="w-72" align="end">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm">Filters</h3>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 px-2 text-xs">
                        <X className="h-3 w-3 mr-1" />
                        Clear all
                      </Button>
                    )}
                  </div>
                  <Separator className="my-2" />

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Status</label>
                      <Select value={filters.progress} onValueChange={(v) => setProgress(v as ProgressFilter)}>
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
                      <Select value={filters.projectType} onValueChange={(v) => setType(v as TypeFilter)}>
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
                      <Select value={filters.updatedWithin} onValueChange={(v) => setDate(v as DatePreset)}>
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

          {/* Actions - Rightmost */}
          <div className="flex items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  onClick={onCreateProject}
                  size="sm"
                  className="h-9 w-9 p-0 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md transition-all duration-200 hover:shadow-lg hover:scale-105 hover:from-primary/90 hover:to-primary"
                  aria-label="Create new project"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Create new project</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
