import { Dialog, DialogContent } from "@/shared/ui/dialog";

/**
 * TODO: The legacy wizard is slated for removal. The component remains as a
 * placeholder until the v2 workflow is fully wired through the UI.
 */
export function CreateProjectWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <p className="text-sm text-muted-foreground">
          TODO: Rebuild the legacy project wizard using the new schema-backed pipeline.
        </p>
      </DialogContent>
    </Dialog>
  );
}
