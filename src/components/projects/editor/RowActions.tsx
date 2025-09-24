import { type FormStatus, useFormStatus } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface RowActionsProps {
  isDirty: boolean;
  canEdit: boolean;
  isPendingExternal?: boolean;
  onCopySource: () => void;
  onReset: () => void;
  onInsertMissingPlaceholders: () => void;
  missingPlaceholderCount: number;
}

export function RowActions({
  isDirty,
  canEdit,
  isPendingExternal = false,
  onCopySource,
  onReset,
  onInsertMissingPlaceholders,
  missingPlaceholderCount,
}: RowActionsProps) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const pending = Boolean((useFormStatus() as unknown as FormStatus).pending);
  const isBusy = pending || isPendingExternal;
  const disableEditing = !canEdit || isBusy;
  const disableInsertion = disableEditing || missingPlaceholderCount === 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onCopySource}
        disabled={disableEditing}
      >
        Copy source
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onReset}
        disabled={!canEdit || isBusy || !isDirty}
      >
        Reset
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onInsertMissingPlaceholders}
        disabled={disableInsertion}
      >
        Insert missing
        {missingPlaceholderCount > 0 ? ` (${missingPlaceholderCount})` : ""}
      </Button>
      <div className="ml-auto flex items-center gap-2">
        {pending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" /> : null}
        <Button
          type="submit"
          size="sm"
          disabled={disableEditing || !isDirty}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

export default RowActions;
