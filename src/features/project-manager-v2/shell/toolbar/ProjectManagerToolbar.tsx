import { Search, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import type { SelectionSummary } from "../../data";
import { useProjectManagerSelector } from "../../state";
import { FilterControls } from "./components/FilterControls";
import { SearchInput } from "./components/SearchInput";

interface ProjectManagerToolbarProps {
  onRequestBatchDelete: () => void;
  isDeleting: boolean;
  selectionSummary: SelectionSummary;
}

export function ProjectManagerToolbar({ onRequestBatchDelete, isDeleting, selectionSummary }: ProjectManagerToolbarProps) {
  const search = useProjectManagerSelector((state) => state.search);
  const setSearch = useProjectManagerSelector((state) => state.setSearch);
  const clearSelection = useProjectManagerSelector((state) => state.clearSelection);

  const hasSelection = selectionSummary.selectedCount > 0;
  const selectionLabel = getSelectionLabel(selectionSummary);
  const canDelete = hasSelection && !isDeleting;

  return (
    <section
      role="toolbar"
      aria-label="Project actions"
      className="flex flex-col gap-3 rounded-xl border border-border bg-background/80 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-1 flex-wrap items-center gap-3">
        <div className="relative flex min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search projects"
            ariaLabel="Search projects"
            className="h-10 rounded-full border-border/60 bg-[var(--color-tr-input)] pl-10 pr-10 text-sm text-foreground shadow-none focus:border-[var(--color-tr-ring)] focus:ring-2 focus:ring-[var(--color-tr-ring)]/60"
          />
          {search.trim().length > 0 ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-colors hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <FilterControls isDisabled={isDeleting} />
      </div>

      <Separator orientation="horizontal" className="sm:hidden" />
      <Separator orientation="vertical" className="hidden h-8 sm:block" />

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {selectionLabel}
        </span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearSelection}
                disabled={!hasSelection || isDeleting}
              >
                Clear
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear selected projects</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={onRequestBatchDelete}
          disabled={!canDelete}
          className="gap-2"
        >
          {isDeleting ? "Deleting" : formatDeleteLabel(selectionSummary.selectedCount)}
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}

function getSelectionLabel(summary: SelectionSummary): string {
  if (summary.selectedCount === 0) {
    return "No selection";
  }

  const parts = [`${summary.selectedCount} selected`];
  if (summary.totalFileCount > 0) {
    const fileLabel = summary.totalFileCount === 1 ? "file" : "files";
    parts.push(`${summary.totalFileCount} ${fileLabel}`);
  }
  return parts.join(" · ");
}

function formatDeleteLabel(selectedCount: number): string {
  if (selectedCount <= 0) {
    return "Delete";
  }
  return `Delete ${selectedCount}`;
}
