import { useState } from "react";
import { FileText, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BatchDeleteConfirmDialog } from "./BatchDeleteConfirmDialog";
import { cn } from "@/lib/utils";

/**
 * ProjectsBatchActionsPanel Component
 *
 * Displays in Sidebar Two when projects are selected.
 * Provides batch operations interface with better visibility and organization.
 *
 * Features:
 * - Selection count badge with lime green highlight
 * - Vertical action buttons (Delete, Generate Report)
 * - Scrollable list of selected project names
 * - Clear selection action
 * - Integrates with two-step delete confirmation dialog
 *
 * @example
 * ```tsx
 * <ProjectsBatchActionsPanel
 *   selectedCount={3}
 *   selectedProjectNames={["Project A", "Project B", "Project C"]}
 *   selectedProjectIds={["id1", "id2", "id3"]}
 *   onBatchDelete={async (ids) => { await deleteProjects(ids); }}
 *   onClearSelection={() => setSelectedRows(new Set())}
 * />
 * ```
 */
export interface ProjectsBatchActionsPanelProps {
  /** Number of selected projects */
  selectedCount: number;
  /** Names of selected projects (for display and confirmation) */
  selectedProjectNames: string[];
  /** IDs of selected projects */
  selectedProjectIds: string[];
  /** Callback to handle batch deletion */
  onBatchDelete: (projectIds: string[]) => Promise<void>;
  /** Callback to clear all selections */
  onClearSelection: () => void;
  /** Callback to open a specific project */
  onOpenProject?: (projectId: string) => void;
}

export function ProjectsBatchActionsPanel({
  selectedCount,
  selectedProjectNames,
  selectedProjectIds,
  onBatchDelete,
  onClearSelection,
  onOpenProject,
}: ProjectsBatchActionsPanelProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * Opens the batch delete confirmation dialog
   */
  const handleBatchDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  /**
   * Handles the final deletion after user confirms
   */
  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await onBatchDelete(selectedProjectIds);
      setIsDeleteDialogOpen(false);
      // Parent component should clear selection after successful deletion
    } catch (error) {
      console.error("Batch delete failed:", error);
      // Error handling will be managed by parent component
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header Section - Selection Count */}
      <div className="flex-shrink-0 p-4">
        <div className="flex items-center justify-between gap-2">
          {/* Selection Badge */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/25 border-2 border-secondary/50">
              <span className="text-sm font-bold text-secondary-foreground">{selectedCount}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground">Selected</span>
              <span className="text-sm font-semibold text-foreground">
                {selectedCount} Project{selectedCount > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Clear Selection Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onClearSelection}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear all selections</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <Separator />

      {/* Action Buttons Section */}
      <div className="flex-shrink-0 p-4 space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Batch Actions
        </h3>

        {/* Batch Delete Button */}
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={handleBatchDeleteClick}
          className={cn(
            "w-full justify-start gap-2",
            "hover:shadow-md transition-shadow"
          )}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          <span>Delete {selectedCount} Project{selectedCount > 1 ? "s" : ""}</span>
        </Button>

        {/* Generate Report Button - Disabled (Coming Soon) */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                  className="w-full justify-start gap-2 opacity-60"
                >
                  <FileText className="h-4 w-4" aria-hidden />
                  <span>Generate Report</span>
                </Button>
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] font-bold bg-primary text-primary-foreground rounded-full">
                  SOON
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p className="font-medium">Coming Soon</p>
              <p className="text-xs text-muted-foreground">Generate summary report for selected projects</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Separator />

      {/* Selected Projects List */}
      <div className="flex-1 min-h-0 flex flex-col p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Selected Projects
        </h3>
        <div className="flex-1 overflow-y-auto">
          <ul className="space-y-1.5 pr-2">
            {selectedProjectNames.map((name, index) => {
              const projectId = selectedProjectIds[index];
              return (
                <li
                  key={index}
                  onClick={() => onOpenProject?.(projectId)}
                  className={cn(
                    "flex items-start gap-2 px-2 py-1.5 rounded-md text-sm",
                    "bg-secondary/5 hover:bg-secondary/10 transition-colors",
                    "border border-secondary/20",
                    onOpenProject && "cursor-pointer hover:shadow-sm"
                  )}
                >
                  {/* Index number */}
                  <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-secondary/20 text-[10px] font-bold text-secondary-foreground">
                    {index + 1}
                  </span>
                  {/* Project name */}
                  <span className="flex-1 font-medium text-foreground leading-5 break-words">
                    {name}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Batch Delete Confirmation Dialog */}
      <BatchDeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        projectNames={selectedProjectNames}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </div>
  );
}
