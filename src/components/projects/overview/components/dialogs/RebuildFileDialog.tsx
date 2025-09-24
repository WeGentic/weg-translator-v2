import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

type RebuildFileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isBusy?: boolean;
  fileName?: string;
};

export function RebuildFileDialog({ open, onOpenChange, onConfirm, isBusy = false, fileName }: RebuildFileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rebuild conversions</DialogTitle>
          <DialogDescription>
            Regenerates XLIFF and JLIFF artifacts for
            {fileName ? ` "${fileName}"` : " the selected file"}. Existing versions will be overwritten.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-200">
          Make sure source files are ready. This action can take a while for large projects.
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isBusy}>
            <AlertTriangle className="mr-2 h-4 w-4" aria-hidden="true" />
            Rebuild
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RebuildFileDialog;
