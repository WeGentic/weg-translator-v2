import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type AddFilesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function AddFilesDialog({ open, onOpenChange, onConfirm }: AddFilesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add files</DialogTitle>
          <DialogDescription>Select files to import into this project.</DialogDescription>
        </DialogHeader>
        <Separator className="my-2" aria-hidden="true" />
        <div className="text-sm text-muted-foreground">You will be prompted to select files using the system dialog.</div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Choose files…</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddFilesDialog;
