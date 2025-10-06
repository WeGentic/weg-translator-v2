import { Funnel } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

import type { ProjectTypeFilterValue, ProgressFilterValue, UpdatedWithinPreset } from "../../../data";
import {
  PROJECT_TYPE_FILTER_OPTIONS,
  PROGRESS_FILTER_OPTIONS,
  UPDATED_WITHIN_OPTIONS,
  countActiveFilters,
} from "../../../data";
import { useProjectManagerSelector } from "../../../state";

interface FilterControlsProps {
  isDisabled?: boolean;
}

export function FilterControls({ isDisabled = false }: FilterControlsProps) {
  const filters = useProjectManagerSelector((state) => state.filters);
  const setFilters = useProjectManagerSelector((state) => state.setFilters);
  const resetFilters = useProjectManagerSelector((state) => state.resetFilters);
  const activeFilterCount = useProjectManagerSelector((state) => countActiveFilters(state.filters));
  const hasFiltersApplied = activeFilterCount > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isDisabled}
          className="gap-2"
        >
          <Funnel className="h-4 w-4" aria-hidden="true" />
          <span className="text-sm font-medium">Filters</span>
          {hasFiltersApplied ? (
            <Badge
              variant="secondary"
              className="ml-2 h-5 min-w-[1.5rem] justify-center rounded-full bg-[var(--color-tr-accent)] px-1 text-[0.7rem] font-semibold text-[var(--color-tr-accent-foreground)]"
            >
              {activeFilterCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-4 p-4">
        <FilterSection
          title="Progress"
          options={PROGRESS_FILTER_OPTIONS}
          value={filters.progress}
          onSelect={(value) => setFilters((current) => ({ ...current, progress: value }))}
          disabled={isDisabled}
        />
        <Separator />
        <FilterSection
          title="Type"
          options={PROJECT_TYPE_FILTER_OPTIONS}
          value={filters.projectType}
          onSelect={(value) => setFilters((current) => ({ ...current, projectType: value }))}
          disabled={isDisabled}
        />
        <Separator />
        <FilterSection
          title="Updated"
          options={UPDATED_WITHIN_OPTIONS}
          value={filters.updatedWithin}
          formatter={formatUpdatedWithin}
          onSelect={(value) => setFilters((current) => ({ ...current, updatedWithin: value }))}
          disabled={isDisabled}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={resetFilters}
            disabled={isDisabled || !hasFiltersApplied}
          >
            Clear filters
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface FilterSectionProps<TValue extends string> {
  title: string;
  options: readonly TValue[];
  value: TValue;
  onSelect: (value: TValue) => void;
  formatter?: (value: TValue) => string;
  disabled?: boolean;
}

function FilterSection<TValue extends string>({
  title,
  options,
  value,
  onSelect,
  formatter,
  disabled = false,
}: FilterSectionProps<TValue>) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const label = formatter ? formatter(option) : formatLabel(option);
          const isActive = option === value;
          return (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={isActive ? "default" : "outline"}
              className="rounded-full px-3 text-xs"
              onClick={() => onSelect(option)}
              disabled={disabled}
            >
              {label}
            </Button>
          );
        })}
      </div>
    </section>
  );
}

function formatLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatUpdatedWithin(value: UpdatedWithinPreset) {
  switch (value) {
    case "24h":
      return "Last 24h";
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
    default:
      return "Any time";
  }
}
