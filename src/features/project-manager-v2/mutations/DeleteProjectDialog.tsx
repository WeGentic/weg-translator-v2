import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProjectListItem } from "@/ipc";

import { useDeleteProjectAction } from "../actions/deleteProjectAction";

interface DeleteProjectDialogProps {
  project: ProjectListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (project: ProjectListItem) => void;
}

export function DeleteProjectDialog({ project, open, onOpenChange, onDeleted }: DeleteProjectDialogProps) {
  const { run, isPending } = useDeleteProjectAction({
    onSuccess: (payload) => {
      if (project && payload.projectId === project.projectId) {
        onDeleted?.(project);
      }
      onOpenChange(false);
    },
  });

  const description = useMemo(() => {
    if (!project) {
      return "Select a project to delete.";
    }
    return `Deleting "${project.name}" will permanently remove the project and its files.`;
  }, [project]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete project</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!project || isPending}
            onClick={() => {
              if (!project) return;
              run({ projectId: project.projectId, projectName: project.name });
            }}
          >
            {isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
