"use no memo";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";

import { deleteClientRecord } from "@/core/ipc/db/clients";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useToast } from "@/shared/ui/use-toast";

export type DeleteClientTarget = {
  id: string;
  name: string;
  email: string | null;
} | null;

export interface DeleteClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: DeleteClientTarget;
  onAfterDelete?: (clientUuid: string) => void;
}

export function DeleteClientDialog({ open, onOpenChange, target, onAfterDelete }: DeleteClientDialogProps) {
  const targetName = target?.name?.trim() ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Delete client{targetName ? `: ${targetName}` : ""}
          </DialogTitle>
          <DialogDescription>
            This action permanently removes the client profile from the workspace. Type the client email to confirm.
          </DialogDescription>
        </DialogHeader>

        <DeleteClientForm
          key={`${target?.id ?? "no-target"}-${open ? "open" : "closed"}`}
          target={target}
          onOpenChange={onOpenChange}
          onAfterDelete={onAfterDelete}
        />
      </DialogContent>
    </Dialog>
  );
}

interface DeleteClientFormProps {
  target: DeleteClientTarget;
  onOpenChange: (open: boolean) => void;
  onAfterDelete?: (clientUuid: string) => void;
}

function DeleteClientForm({ target, onOpenChange, onAfterDelete }: DeleteClientFormProps) {
  const [confirmEmail, setConfirmEmail] = useState("");
  const { toast } = useToast();

  const requiredEmail = useMemo(() => target?.email?.trim() ?? "", [target]);
  const targetName = target?.name ?? "client";

  const [errorMessage, submitAction] = useActionState<string | null, FormData>(async (_prev, formData) => {
    if (!target) {
      return "No client selected.";
    }
    if (!requiredEmail) {
      return "Client email is missing; cannot confirm deletion.";
    }

    const confirmField = formData.get("confirm");
    const typedEmail = typeof confirmField === "string" ? confirmField.trim() : "";
    if (typedEmail.toLowerCase() !== requiredEmail.toLowerCase()) {
      return "Email doesn't match.";
    }

    try {
      await deleteClientRecord(target.id);
      toast({
        title: "Client deleted",
        description: `Deleted "${target.name}".`,
      });
      onAfterDelete?.(target.id);
      onOpenChange(false);
      return null;
    } catch (cause) {
      const message = cause instanceof Error && cause.message ? cause.message : "Deletion failed.";
      toast({
        variant: "destructive",
        title: "Deletion failed",
        description: message,
      });
      return message;
    }
  }, null);

  const disabledByEmail = useMemo(() => {
    if (!target || !requiredEmail) {
      return true;
    }
    return confirmEmail.trim().toLowerCase() !== requiredEmail.toLowerCase();
  }, [confirmEmail, requiredEmail, target]);

  const isEmailMissing = !requiredEmail;

  return (
    <form action={submitAction}>
      <div className="space-y-3 py-2">
        <div>
          <p className="text-sm text-muted-foreground">
            To confirm, type the client email exactly as shown:
          </p>
          <p className="mt-1 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-sm font-medium text-foreground">
            {requiredEmail || "—"}
          </p>
          {isEmailMissing ? (
            <p className="mt-2 text-sm text-destructive">
              This client does not have an email on file. Add an email before attempting deletion.
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="confirm-email">Client email</Label>
          <Input
            id="confirm-email"
            name="confirm"
            type="email"
            autoFocus
            placeholder="Enter client email to confirm"
            value={confirmEmail}
            onChange={(event) => setConfirmEmail(event.target.value)}
            aria-describedby="confirm-email-helper"
          />
          <p id="confirm-email-helper" className="text-xs text-muted-foreground">
            Deletion is irreversible. This safeguard prevents accidental removal.
          </p>
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
        <SubmitDeleteButton disabledByEmail={disabledByEmail} targetName={targetName} />
      </DialogFooter>
    </form>
  );
}

function SubmitDeleteButton({ disabledByEmail, targetName }: { disabledByEmail: boolean; targetName: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="destructive" disabled={disabledByEmail || pending}>
      <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
      {pending ? "Deleting..." : `Delete ${targetName}`}
    </Button>
  );
}
