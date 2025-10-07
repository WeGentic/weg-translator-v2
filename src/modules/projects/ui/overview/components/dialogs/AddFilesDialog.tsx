import { Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Separator } from "@/shared/ui/separator";

type AddFilesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isBusy?: boolean;
};

export function AddFilesDialog({ open, onOpenChange, onConfirm, isBusy = false }: AddFilesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add files</DialogTitle>
          <DialogDescription>
            Select documents to import. A guided loader will keep you informed as each step completes.
          </DialogDescription>
        </DialogHeader>
        <Separator className="my-2" aria-hidden="true" />
        <div className="text-sm text-muted-foreground">
          Supported formats include XLIFF, TMX, DOCX, and other bilingual assets. You will be prompted to use the
          system dialog, and the app will automatically convert everything to JLIFF once imported.
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isBusy} className="gap-2">
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isBusy ? "Loading…" : "Choose files…"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddFilesDialog;
