import { Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ProjectListItem } from "@/ipc";

import type { SelectionSummary } from "../../data";

interface ProjectsBatchActionsPanelProps {
  selectedProjects: ProjectListItem[];
  selectionSummary: SelectionSummary;
  onClearSelection: () => void;
  onBatchDelete: (projectIds: string[]) => void;
  isDeleting?: boolean;
  onOpenProject?: (project: ProjectListItem) => void;
}

export function ProjectsBatchActionsPanel({
  selectedProjects,
  selectionSummary,
  onClearSelection,
  onBatchDelete,
  isDeleting = false,
  onOpenProject,
}: ProjectsBatchActionsPanelProps) {
  const selectedIds = selectedProjects.map((project) => project.projectId);
  const fileLabel = selectionSummary.totalFileCount === 1 ? "file" : "files";
  const statusLabel = formatSummary(selectionSummary);
  const canOpenProject = typeof onOpenProject === "function";

  if (selectionSummary.selectedCount === 0) {
    return null;
  }

  return (
    <Card className="border border-[var(--color-tr-sidebar-border)] bg-[var(--color-tr-sidebar)] text-[var(--color-tr-sidebar-foreground)] shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold">
          {selectionSummary.selectedCount} selected
        </CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear selection"
          onClick={onClearSelection}
          disabled={isDeleting}
          className="text-[var(--color-tr-muted-foreground)] hover:text-[var(--color-tr-sidebar-foreground)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-[var(--color-tr-muted-foreground)]">
          {selectionSummary.totalFileCount} {fileLabel}
          {statusLabel ? ` · ${statusLabel}` : ""}
        </div>
        <Button
          type="button"
          variant="destructive"
          className="w-full justify-center"
          disabled={isDeleting}
          onClick={() => {
            if (selectedIds.length === 0 || isDeleting) {
              return;
            }
            onBatchDelete(selectedIds);
          }}
        >
          {isDeleting ? "Deleting…" : `Delete ${selectionSummary.selectedCount}`}
          <Trash2 className="ml-2 h-4 w-4" aria-hidden="true" />
        </Button>

        <Separator className="border-[var(--color-tr-sidebar-border)]" />

        <ul className="space-y-2 text-sm text-[var(--color-tr-muted-foreground)]" aria-live="polite">
          {selectedProjects.slice(0, 6).map((project, index) => {
            const content = (
              <div
                className={cn(
                  "flex items-start gap-2 rounded-md border border-[var(--color-tr-sidebar-border)]/80 bg-[var(--color-tr-muted)]/40 px-2 py-1.5 text-left transition-colors",
                  canOpenProject && "hover:border-[var(--color-tr-ring)]/70 hover:bg-[var(--color-tr-sidebar)]",
                )}
              >
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-tr-border)]/70 text-[10px] font-semibold text-[var(--color-tr-sidebar-foreground)]">
                  {index + 1}
                </span>
                <span className="flex-1 truncate text-[var(--color-tr-sidebar-foreground)]" title={project.name}>
                  {project.name}
                </span>
              </div>
            );

            return (
              <li key={project.projectId}>
                {canOpenProject ? (
                  <button
                    type="button"
                    aria-label={`Open ${project.name}`}
                    onClick={() => onOpenProject?.(project)}
                    className="block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-tr-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-tr-sidebar)]"
                  >
                    {content}
                  </button>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
        {selectionSummary.selectedCount > 6 ? (
          <p className="text-xs text-[var(--color-tr-muted-foreground)]">
            +{selectionSummary.selectedCount - 6} more selected
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatSummary(summary: SelectionSummary) {
  const statusEntries = Object.entries(summary.statusCounts);
  if (statusEntries.length === 0) {
    return "";
  }
  return statusEntries
    .map(([status, count]) => `${count} ${formatStatusLabel(status)}`)
    .join(" · ");
}

function formatStatusLabel(status: string) {
  const normalized = status.replace(/[_-]+/g, " ").trim();
  if (normalized.length === 0) {
    return "Unknown";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
