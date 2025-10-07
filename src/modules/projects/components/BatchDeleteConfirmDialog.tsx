import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/utils/class-names";

/**
 * BatchDeleteConfirmDialog Component
 *
 * A two-step confirmation dialog for batch deletion of projects.
 * Implements a progressive disclosure pattern to prevent accidental deletions.
 *
 * Step 1: Shows list of projects to be deleted with basic confirmation
 * Step 2: Requires typing "DELETE" to enable final deletion button
 *
 * @example
 * ```tsx
 * <BatchDeleteConfirmDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   projectNames={["Project A", "Project B"]}
 *   onConfirm={async () => { await deleteProjects(); }}
 * />
 * ```
 */
export interface BatchDeleteConfirmDialogProps {
  /** Controls dialog visibility */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Array of project names to be deleted */
  projectNames: string[];
  /** Callback executed when user confirms deletion (after both steps) */
  onConfirm: () => void | Promise<void>;
  /** Optional loading state during deletion */
  isDeleting?: boolean;
}

export function BatchDeleteConfirmDialog({
  open,
  onOpenChange,
  projectNames,
  onConfirm,
  isDeleting = false,
}: BatchDeleteConfirmDialogProps) {
  // Dialog state: "first" | "second" step
  const [step, setStep] = useState<"first" | "second">("first");
  // Type-to-confirm input value
  const [confirmText, setConfirmText] = useState("");

  const projectCount = projectNames.length;
  const isConfirmTextValid = confirmText === "DELETE";

  /**
   * Resets dialog state when closed
   */
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when dialog closes
      setStep("first");
      setConfirmText("");
    }
    onOpenChange(newOpen);
  };

  /**
   * Handles first confirmation - advances to second step
   */
  const handleFirstConfirm = () => {
    setStep("second");
  };

  /**
   * Handles final confirmation - triggers deletion
   */
  const handleFinalConfirm = () => {
    if (!isConfirmTextValid) return;
    void onConfirm();
    // Dialog will be closed by parent component after successful deletion
  };

  /**
   * Handles going back from second step to first
   */
  const handleBack = () => {
    setStep("first");
    setConfirmText("");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {step === "first" ? (
          /* STEP 1: Initial Confirmation */
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                  <Trash2 className="h-5 w-5 text-destructive" aria-hidden />
                </div>
                <DialogTitle className="text-xl">Delete {projectCount} Project{projectCount > 1 ? "s" : ""}?</DialogTitle>
              </div>
              <DialogDescription className="pt-2">
                You are about to delete the following project{projectCount > 1 ? "s" : ""}. This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>

            {/* List of projects to be deleted */}
            <div className="my-4 max-h-[200px] overflow-y-auto rounded-md border border-border bg-muted/10 p-3">
              <ul className="space-y-2">
                {projectNames.map((name) => (
                  <li
                    key={name}
                    className="flex items-center gap-2 text-sm text-foreground/90"
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden />
                    <span className="font-medium">{name}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Warning message */}
            <div className="flex items-start gap-2 rounded-md bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" aria-hidden />
              <p className="text-destructive">
                All project files, translations, and history will be permanently deleted.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleFirstConfirm}
                disabled={isDeleting}
              >
                Continue
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* STEP 2: Final Confirmation with Type-to-Confirm */
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15 animate-pulse">
                  <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />
                </div>
                <DialogTitle className="text-xl text-destructive">
                  Are you absolutely sure?
                </DialogTitle>
              </div>
              <DialogDescription className="pt-2">
                This is your final warning. Once deleted, these projects cannot be recovered.
              </DialogDescription>
            </DialogHeader>

            {/* Type-to-confirm section */}
            <div className="my-4 space-y-3">
              <p className="text-sm font-medium text-foreground">
                Type <code className="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-destructive">DELETE</code> to confirm:
              </p>
              <Input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className={cn(
                  "font-mono",
                  confirmText && !isConfirmTextValid && "border-destructive focus-visible:ring-destructive/20",
                  isConfirmTextValid && "border-success focus-visible:ring-success/20"
                )}
                autoFocus
                disabled={isDeleting}
              />
              {confirmText && !isConfirmTextValid && (
                <p className="text-xs text-destructive">
                  Please type "DELETE" exactly as shown above.
                </p>
              )}
            </div>

            {/* Final warning with count */}
            <div className="rounded-md bg-destructive/10 p-3 text-center">
              <p className="text-sm font-semibold text-destructive">
                {projectCount} project{projectCount > 1 ? "s" : ""} will be permanently deleted
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={isDeleting}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleFinalConfirm}
                disabled={!isConfirmTextValid || isDeleting}
                className={cn(
                  "min-w-[140px]",
                  isDeleting && "opacity-70"
                )}
              >
                {isDeleting ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete {projectCount} Project{projectCount > 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
