import { useMemo, useState } from "react";
import { X, Filter, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectFileWithConversionsDto } from "@/ipc";
import { cn } from "@/lib/utils";

export interface FileFilters {
  fileTypes: Set<string>;
  statuses: Set<string>;
  languagePairs: Set<string>;
}

interface Props {
  files: ProjectFileWithConversionsDto[];
  filters: FileFilters;
  onFiltersChange: (filters: FileFilters) => void;
  className?: string;
}

export function FilterChips({ files, filters, onFiltersChange, className }: Props) {
  const [showAllFileTypes, setShowAllFileTypes] = useState(false);
  const [showAllStatuses, setShowAllStatuses] = useState(false);
  const [showAllLanguages, setShowAllLanguages] = useState(false);

  // Extract available filter options from files
  const filterOptions = useMemo(() => {
    const fileTypes = new Set<string>();
    const statuses = new Set<string>();
    const languagePairs = new Set<string>();

    files.forEach(({ file, conversions }) => {
      // File types
      if (file.ext) {
        fileTypes.add(file.ext.replace(/^\./, "").toUpperCase());
      }

      // Import statuses
      statuses.add(file.importStatus);

      // Conversion statuses
      conversions.forEach(conv => {
        statuses.add(conv.status);
        languagePairs.add(`${conv.srcLang}→${conv.tgtLang}`);
      });
    });

    return {
      fileTypes: Array.from(fileTypes).sort(),
      statuses: Array.from(statuses).sort(),
      languagePairs: Array.from(languagePairs).sort()
    };
  }, [files]);

  // Toggle filter functions
  const toggleFileType = (type: string) => {
    const newTypes = new Set(filters.fileTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    onFiltersChange({ ...filters, fileTypes: newTypes });
  };

  const toggleStatus = (status: string) => {
    const newStatuses = new Set(filters.statuses);
    if (newStatuses.has(status)) {
      newStatuses.delete(status);
    } else {
      newStatuses.add(status);
    }
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  const toggleLanguagePair = (pair: string) => {
    const newPairs = new Set(filters.languagePairs);
    if (newPairs.has(pair)) {
      newPairs.delete(pair);
    } else {
      newPairs.add(pair);
    }
    onFiltersChange({ ...filters, languagePairs: newPairs });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      fileTypes: new Set(),
      statuses: new Set(),
      languagePairs: new Set()
    });
  };

  const hasActiveFilters = filters.fileTypes.size > 0 || filters.statuses.size > 0 || filters.languagePairs.size > 0;
  const visibleFileTypes = showAllFileTypes ? filterOptions.fileTypes : filterOptions.fileTypes.slice(0, 6);
  const visibleStatuses = showAllStatuses ? filterOptions.statuses : filterOptions.statuses.slice(0, 4);
  const visibleLanguages = showAllLanguages ? filterOptions.languagePairs : filterOptions.languagePairs.slice(0, 4);

  if (filterOptions.fileTypes.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Filter header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Filters</span>
          {hasActiveFilters && (
            <span className="text-xs text-muted-foreground">
              ({filters.fileTypes.size + filters.statuses.size + filters.languagePairs.size} active)
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-7 px-2 text-xs">
            Clear all
          </Button>
        )}
      </div>

      {/* File type filters */}
      {filterOptions.fileTypes.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">File Types</div>
          <div className="flex flex-wrap gap-1">
            {visibleFileTypes.map((type) => (
              <button
                type="button"
                key={type}
                onClick={() => toggleFileType(type)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  filters.fileTypes.has(type)
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border/60 bg-background text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                {type}
                {filters.fileTypes.has(type) && <X className="h-3 w-3" />}
              </button>
            ))}
            {filterOptions.fileTypes.length > 6 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllFileTypes(!showAllFileTypes)}
                className="h-6 px-2 text-xs text-muted-foreground"
              >
                <ChevronDown className={cn("h-3 w-3 transition-transform", showAllFileTypes && "rotate-180")} />
                {showAllFileTypes ? "Less" : `+${filterOptions.fileTypes.length - 6} more`}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Status filters */}
      {filterOptions.statuses.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</div>
          <div className="flex flex-wrap gap-1">
            {visibleStatuses.map((status) => (
              <button
                type="button"
                key={status}
                onClick={() => toggleStatus(status)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  filters.statuses.has(status)
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border/60 bg-background text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                {filters.statuses.has(status) && <X className="h-3 w-3" />}
              </button>
            ))}
            {filterOptions.statuses.length > 4 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllStatuses(!showAllStatuses)}
                className="h-6 px-2 text-xs text-muted-foreground"
              >
                <ChevronDown className={cn("h-3 w-3 transition-transform", showAllStatuses && "rotate-180")} />
                {showAllStatuses ? "Less" : `+${filterOptions.statuses.length - 4} more`}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Language pair filters */}
      {filterOptions.languagePairs.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Language Pairs</div>
          <div className="flex flex-wrap gap-1">
            {visibleLanguages.map((pair) => (
              <button
                type="button"
                key={pair}
                onClick={() => toggleLanguagePair(pair)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  filters.languagePairs.has(pair)
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border/60 bg-background text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                {pair}
                {filters.languagePairs.has(pair) && <X className="h-3 w-3" />}
              </button>
            ))}
            {filterOptions.languagePairs.length > 4 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllLanguages(!showAllLanguages)}
                className="h-6 px-2 text-xs text-muted-foreground"
              >
                <ChevronDown className={cn("h-3 w-3 transition-transform", showAllLanguages && "rotate-180")} />
                {showAllLanguages ? "Less" : `+${filterOptions.languagePairs.length - 4} more`}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FilterChips;
