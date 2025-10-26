import { Search, RefreshCcw, Sparkles } from "lucide-react";
import { useId } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import type { DashboardStatusFilter } from "../../data/dashboard.types";

import "./dashboard-toolbar.css";

export interface DashboardToolbarProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  statusFilter: DashboardStatusFilter;
  onStatusFilterChange: (status: DashboardStatusFilter) => void;
  onRefresh: () => void;
  onCreateProject: () => void;
  lastRefreshedAt: Date | null;
}

const STATUS_FILTER_LABELS: Record<DashboardStatusFilter, string> = {
  all: "All work",
  planning: "Planning",
  "in-progress": "In progress",
  review: "In review",
  blocked: "Blocked",
  delivered: "Delivered",
};

export function DashboardToolbar({
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  onCreateProject,
  lastRefreshedAt,
}: DashboardToolbarProps) {
  const searchInputId = useId();
  const lastRefreshedLabel =
    lastRefreshedAt != null
      ? new Intl.DateTimeFormat(undefined, {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
        }).format(lastRefreshedAt)
      : null;

  return (
    <TooltipProvider>
      <div className="dashboard-toolbar-zone dashboard-toolbar" role="toolbar" aria-label="Dashboard quick filters">
        <div className="dashboard-toolbar__inner">
          <div className="dashboard-toolbar__search">
            <label htmlFor={searchInputId} className="sr-only">
              Search across dashboard
            </label>
            <Search className="dashboard-toolbar__search-icon" aria-hidden="true" />
            <Input
              id={searchInputId}
              type="search"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder="Search projects, emails, or resources"
              className="dashboard-toolbar__search-input"
              aria-label="Search dashboard content"
              autoComplete="off"
            />
          </div>

          <div className="dashboard-toolbar__controls">
            <Select
              value={statusFilter}
              onValueChange={(value) => onStatusFilterChange(value as DashboardStatusFilter)}
              aria-label="Filter work items"
            >
              <SelectTrigger
                className="dashboard-toolbar__select"
                aria-label="Filter work items"
                data-testid="dashboard-status-filter"
              >
                <SelectValue placeholder="Filter work" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_FILTER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="dashboard-toolbar__actions">
              {lastRefreshedLabel ? (
                <span className="dashboard-toolbar__timestamp" role="status" aria-live="polite">
                  Last refreshed at {lastRefreshedLabel}
                </span>
              ) : null}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onRefresh}
                    className="dashboard-toolbar__action-button"
                    aria-label="Refresh dashboard data"
                  >
                    <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                    Refresh
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Pull latest project status and metrics</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    onClick={onCreateProject}
                    className="dashboard-toolbar__primary-action"
                    aria-label="Create new translation project"
                  >
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    New project
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Start a new translation or localization workflow</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
