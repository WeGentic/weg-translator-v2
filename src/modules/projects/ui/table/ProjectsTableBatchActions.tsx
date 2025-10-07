import { useState } from "react";
import { FileText, Trash2, X } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/utils/class-names";
import { BatchDeleteConfirmDialog } from "@/modules/projects/components/BatchDeleteConfirmDialog";

/**
 * ProjectsTableBatchActions Component
 *
 * Displays a fixed action bar when one or more projects are selected.
 * Provides batch operations for selected items:
 * - Batch delete with double confirmation
 * - Generate report (coming soon - currently disabled)
 * - Clear selection
 *
 * Features:
 * - Appears with slide-down animation when items are selected
 * - Sticky positioning above table footer
 * - Theme-aware styling using App.css variables
 * - Disabled state for unimplemented features
 *
 * @example
 * ```tsx
 * <ProjectsTableBatchActions
 *   selectedCount={3}
 *   selectedProjectNames={["Project A", "Project B", "Project C"]}
 *   onBatchDelete={async (ids) => { await deleteProjects(ids); }}
 *   onClearSelection={() => setSelectedRows(new Set())}
 * />
 * ```
 */
export interface ProjectsTableBatchActionsProps {
  /** Number of selected projects */
  selectedCount: number;
  /** Names of selected projects (for confirmation dialog) */
  selectedProjectNames: string[];
  /** IDs of selected projects */
  selectedProjectIds: string[];
  /** Callback to handle batch deletion */
  onBatchDelete: (projectIds: string[]) => Promise<void>;
  /** Callback to clear all selections */
  onClearSelection: () => void;
}

export function ProjectsTableBatchActions({
  selectedCount,
  selectedProjectNames,
  selectedProjectIds,
  onBatchDelete,
  onClearSelection,
}: ProjectsTableBatchActionsProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * Handles batch delete confirmation
   * Opens the two-step confirmation dialog
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

  // Don't render if no items are selected
  if (selectedCount === 0) return null;

  return (
    <>
      {/* Batch Actions Bar */}
      <div
        className={cn(
          // Positioning and layout
          "flex-shrink-0 z-20",
          "flex items-center justify-between gap-4 px-4 py-3",
          // Glassmorphism effect with accent color theme
          "border-t-2 border-accent/40",
          "bg-gradient-to-r from-accent/15 via-accent/8 to-transparent",
          "backdrop-blur-sm",
          // Shadow for elevation
          "shadow-lg",
          // Slide-down animation
          "animate-in slide-in-from-bottom-4 duration-300"
        )}
      >
        {/* Left side: Selection info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary/25 border border-secondary/50">
              <span className="text-xs font-bold text-secondary-foreground">{selectedCount}</span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {selectedCount} project{selectedCount > 1 ? "s" : ""} selected
            </span>
          </div>
        </div>

        {/* Right side: Action buttons */}
        <div className="flex items-center gap-2">
          {/* Clear Selection Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClearSelection}
                  className="h-8 gap-1.5"
                >
                  <X className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Clear</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear selection</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Generate Report Button - Disabled (Coming Soon) */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                  className="h-8 gap-1.5 opacity-50"
                >
                  <FileText className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Generate Report</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">Coming Soon</p>
                <p className="text-xs text-muted-foreground">Generate summary report for selected projects</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Batch Delete Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleBatchDeleteClick}
                  className="h-8 gap-1.5"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Delete {selectedCount}</span>
                  <span className="sm:hidden">Delete</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Delete {selectedCount} selected project{selectedCount > 1 ? "s" : ""}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
    </>
  );
}
