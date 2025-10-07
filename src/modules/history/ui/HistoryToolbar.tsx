import { RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Separator } from "@/shared/ui/separator";
import type { TranslationHistoryFilters, HistoryStatusFilter } from "../types";
import { cn } from "@/shared/utils/class-names";

export interface HistoryToolbarProps {
  filters: TranslationHistoryFilters;
  onFiltersChange: (filters: TranslationHistoryFilters) => void;
  onRefresh: () => void;
  onRequestClear: () => void;
  isRefreshing?: boolean;
  isClearing?: boolean;
  disabled?: boolean;
  lastUpdatedAt: number | null;
  canClear?: boolean;
}

const STATUS_OPTIONS: Array<{ value: HistoryStatusFilter; label: string }> = [
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

export function HistoryToolbar({
  filters,
  onFiltersChange,
  onRefresh,
  onRequestClear,
  isRefreshing = false,
  isClearing = false,
  disabled = false,
  lastUpdatedAt,
  canClear = true,
}: HistoryToolbarProps) {
  const statusSet = new Set(filters.statuses);

  const toggleStatus = (status: HistoryStatusFilter) => {
    const next = new Set(statusSet);
    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }
    onFiltersChange({
      statuses: STATUS_OPTIONS.filter((option) => next.has(option.value)).map(
        (option) => option.value,
      ),
    });
  };

  const lastUpdatedLabel = formatLastUpdated(lastUpdatedAt);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Filter by status
        </span>
        <Separator orientation="vertical" className="hidden h-6 sm:block" />
        <div className="flex items-center gap-1">
          {STATUS_OPTIONS.map((option) => {
            const isActive = statusSet.has(option.value);
            return (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={isActive ? "secondary" : "ghost"}
                onClick={() => toggleStatus(option.value)}
                disabled={disabled}
                className={cn(
                  "px-3",
                  isActive ? "border border-border/60" : "border border-transparent",
                )}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Last updated: {lastUpdatedLabel}</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onRefresh}
            disabled={disabled || isRefreshing}
            aria-busy={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} aria-hidden="true" />
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRequestClear}
            disabled={disabled || isClearing || !canClear}
            aria-busy={isClearing}
            className="gap-2"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Clear history
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatLastUpdated(timestamp: number | null) {
  if (!timestamp) {
    return "never";
  }

  const diff = Date.now() - timestamp;
  if (diff < 30_000) {
    return "just now";
  }

  const minute = 60_000;
  const hour = 60 * minute;

  if (diff < hour) {
    const minutes = Math.round(diff / minute);
    return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.round(diff / hour);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const date = new Date(timestamp);
  return date.toLocaleString();
}
