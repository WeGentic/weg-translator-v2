import { useMemo, useState } from "react";
import { Filter, ChevronDown, X, Check } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Separator } from "@/shared/ui/separator";
import type { ProjectFileWithConversionsDto } from "@/core/ipc";
import { cn } from "@/shared/utils/class-names";

export interface FileFilters {
  fileTypes: Set<string>;
  statuses: Set<string>;
}

interface Props {
  files: ProjectFileWithConversionsDto[];
  filters: FileFilters;
  onFiltersChange: (filters: FileFilters) => void;
  className?: string;
}

type ActiveFilterChip = {
  id: string;
  label: string;
  category: "type" | "status";
  value: string;
};

const toTitleCase = (value: string) =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const identity = (value: string) => value;

export function FilterChips({ files, filters, onFiltersChange, className }: Props) {
  const filterOptions = useMemo(() => {
    const fileTypes = new Set<string>();
    const statuses = new Set<string>();

    files.forEach(({ file, conversions }) => {
      if (file.ext) {
        fileTypes.add(file.ext.replace(/^\./, "").toUpperCase());
      }

      if (file.importStatus) {
        statuses.add(file.importStatus);
      }

      conversions.forEach((conversion) => {
        if (conversion.status) {
          statuses.add(conversion.status);
        }
      });
    });

    return {
      fileTypes: Array.from(fileTypes).sort(),
      statuses: Array.from(statuses).sort(),
    };
  }, [files]);

  const hasFilterOptions = filterOptions.fileTypes.length > 0 || filterOptions.statuses.length > 0;

  const toggleFileType = (type: string) => {
    const next = new Set(filters.fileTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    onFiltersChange({ ...filters, fileTypes: next });
  };

  const toggleStatus = (status: string) => {
    const next = new Set(filters.statuses);
    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }
    onFiltersChange({ ...filters, statuses: next });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      fileTypes: new Set(),
      statuses: new Set(),
    });
  };

  const clearFileTypes = () => onFiltersChange({ ...filters, fileTypes: new Set() });
  const clearStatuses = () => onFiltersChange({ ...filters, statuses: new Set() });

  const hasActiveFilters = filters.fileTypes.size + filters.statuses.size > 0;

  const activeFilterChips: ActiveFilterChip[] = useMemo(() => {
    const typeChips: ActiveFilterChip[] = Array.from(filters.fileTypes).map((type) => ({
      id: `type-${type}`,
      label: type,
      category: "type",
      value: type,
    }));

    const statusChips: ActiveFilterChip[] = Array.from(filters.statuses).map((status) => ({
      id: `status-${status}`,
      label: toTitleCase(status),
      category: "status",
      value: status,
    }));

    return [...typeChips, ...statusChips];
  }, [filters.fileTypes, filters.statuses]);

  if (!hasFilterOptions) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-muted/10 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-muted/25",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Filter className="h-4 w-4" />
          </span>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">Refine files</p>
            <p className="text-xs text-muted-foreground">
              {hasActiveFilters
                ? `${filters.fileTypes.size + filters.statuses.size} active filter${
                    filters.fileTypes.size + filters.statuses.size === 1 ? "" : "s"
                  }`
                : "Use the filters below to narrow the table"}
            </p>
          </div>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-8 px-3 text-xs">
            Clear all
          </Button>
        )}
      </div>

      {activeFilterChips.length > 0 && (
        <>
          <Separator className="my-3" />
          <div className="flex flex-wrap gap-2">
            {activeFilterChips.map((chip) => (
              <button
                type="button"
                key={chip.id}
                onClick={() => (chip.category === "type" ? toggleFileType(chip.value) : toggleStatus(chip.value))}
                className="group inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm transition hover:border-primary/60 hover:text-foreground"
              >
                {chip.label}
                <X className="h-3 w-3 transition group-hover:text-primary" />
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <FilterPopoverGroup
          label="File types"
          helperText="Select one or more extensions"
          emptyText="No file types detected"
          options={filterOptions.fileTypes}
          selected={filters.fileTypes}
          onToggle={toggleFileType}
          onClear={clearFileTypes}
        />
        <FilterPopoverGroup
          label="Status"
          helperText="Filter by import or conversion status"
          emptyText="No statuses available yet"
          options={filterOptions.statuses}
          selected={filters.statuses}
          onToggle={toggleStatus}
          onClear={clearStatuses}
          formatOption={toTitleCase}
        />
      </div>
    </div>
  );
}

interface FilterPopoverGroupProps {
  label: string;
  helperText: string;
  emptyText: string;
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
  formatOption?: (value: string) => string;
}

function FilterPopoverGroup({
  label,
  helperText,
  emptyText,
  options,
  selected,
  onToggle,
  onClear,
  formatOption,
}: FilterPopoverGroupProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const format = formatOption ?? identity;

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) {
      return options;
    }

    return options.filter((option) =>
      format(option).toLowerCase().includes(searchTerm.trim().toLowerCase()),
    );
  }, [options, searchTerm, format]);

  const activeCount = selected.size;
  const hasOptions = options.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasOptions}
          className={cn(
            "h-auto w-full justify-between rounded-xl border-border/60 bg-background/90 px-4 py-3 text-left text-sm shadow-sm transition focus-visible:ring-1 focus-visible:ring-ring",
            activeCount > 0 && "border-primary/50 bg-primary/5 text-foreground",
            !hasOptions && "opacity-50"
          )}
        >
          <span className="flex flex-col">
            <span className="font-medium text-foreground">{label}</span>
            <span className="text-xs text-muted-foreground">
              {activeCount > 0
                ? `${activeCount} selected`
                : hasOptions
                  ? `${options.length} option${options.length === 1 ? "" : "s"}`
                  : emptyText}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-72 p-0">
        <div className="border-b border-border/60 p-3">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{helperText}</p>
          {hasOptions && (
            <div className="mt-3">
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={`Search ${label.toLowerCase()}`}
                className="h-8 text-xs"
              />
            </div>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {hasOptions ? (
            filteredOptions.length > 0 ? (
              <ul className="space-y-1">
                {filteredOptions.map((option) => {
                  const isActive = selected.has(option);
                  const displayLabel = format(option);

                  return (
                    <li key={option}>
                      <button
                        type="button"
                        onClick={() => onToggle(option)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition",
                          isActive ? "bg-primary/10 text-foreground" : "hover:bg-muted/60 text-muted-foreground"
                        )}
                      >
                        <span>{displayLabel}</span>
                        {isActive && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No results for "{searchTerm}"
              </div>
            )
          ) : (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">{emptyText}</div>
          )}
        </div>
        {hasOptions && (
          <div className="flex items-center justify-between border-t border-border/60 p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={(event) => {
                event.preventDefault();
                onClear();
              }}
            >
              Clear
            </Button>
            <span className="text-xs text-muted-foreground">{activeCount} selected</span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default FilterChips;
