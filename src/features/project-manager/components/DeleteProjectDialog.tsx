// features/projects/components/DeleteProjectDialog.tsx
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { deleteProject, listProjects } from "@/ipc";

type Target = { id: string; name: string } | null;

type DeleteProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: Target;
  onAfterDelete?: () => void; // optional hook to refresh parent if desired
};

export function DeleteProjectDialog({ open, onOpenChange, target, onAfterDelete }: DeleteProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete project</DialogTitle>
          <DialogDescription>
            This action permanently deletes the project and its files from disk. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DeleteProjectForm
          key={`${target?.id ?? "no-target"}-${open ? "open" : "closed"}`}
          target={target}
          onOpenChange={onOpenChange}
          onAfterDelete={onAfterDelete}
        />
      </DialogContent>
    </Dialog>
  );
}

type DeleteProjectFormProps = {
  target: Target;
  onOpenChange: (open: boolean) => void;
  onAfterDelete?: () => void;
};

function DeleteProjectForm({ target, onOpenChange, onAfterDelete }: DeleteProjectFormProps) {
  const [confirmName, setConfirmName] = useState("");
  const { toast } = useToast();

  const [errorMessage, submitAction] = useActionState<
    string | null,
    FormData
  >(async (_prev, formData) => {
    if (!target) return "No project selected.";

    const confirmField = formData.get("confirm");
    const typedName = typeof confirmField === "string" ? confirmField.trim() : "";
    if (typedName !== target.name) {
      return "Project name doesn't match.";
    }

    try {
      const deleted = await deleteProject(target.id);

      // Verify it's actually gone (same as original)
      const refreshed = await listProjects({ limit: 100 });
      const exists = refreshed.some((p) => p.projectId === target.id);

      if (deleted > 0 && !exists) {
        toast({ title: "Project deleted", description: `Deleted "${target.name}".` });
        onOpenChange(false);
        onAfterDelete?.();
        return null;
      } else {
        toast({ variant: "destructive", title: "Deletion failed", description: `Could not delete "${target.name}".` });
        return "Deletion failed.";
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Deletion failed.";
      toast({ variant: "destructive", title: "Deletion failed", description: message });
      return message;
    }
  }, null);

  const disabledByName = useMemo(
    () => !target || confirmName.trim() !== (target?.name ?? ""),
    [confirmName, target],
  );

  return (
    <form action={submitAction}>
      <div className="space-y-3 py-2">
        <div>
          <p className="text-sm text-muted-foreground">To confirm, type the project name exactly as shown:</p>
          <p className="mt-1 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-sm font-medium text-foreground">
            {target?.name ?? "—"}
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="confirm-name">Project name</Label>
          <Input
            id="confirm-name"
            name="confirm"
            autoFocus
            placeholder="Enter project name to confirm"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
          />
        </div>

        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <SubmitDeleteButton disabledByName={disabledByName} />
      </DialogFooter>
    </form>
  );
}

function SubmitDeleteButton({ disabledByName }: { disabledByName: boolean }) {
  // Reads the parent <form> status without prop drilling (React 19)
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="destructive"
      disabled={disabledByName || pending}
    >
      <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
      {pending ? "Deleting..." : "Delete project"}
    </Button>
  );
}
