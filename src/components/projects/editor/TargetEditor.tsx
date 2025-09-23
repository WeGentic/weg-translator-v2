import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import type { UpdateJliffSegmentResult } from "@/ipc";
import { updateJliffSegment } from "@/ipc";
import type { PlaceholderChip, SegmentRow } from "@/lib/jliff";
import { cn } from "@/lib/utils";

import { RowActions } from "./RowActions";

const CHIP_CLASSNAME =
  "inline-flex items-center rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

type TargetEditorActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  updatedAt?: string;
};

const INITIAL_ACTION_STATE: TargetEditorActionState = Object.freeze({
  status: "idle",
} satisfies TargetEditorActionState);

export interface TargetEditorProps {
  row: SegmentRow;
  projectId: string;
  jliffRelPath: string;
  onSaveSuccess: (payload: {
    rowKey: string;
    transunitId: string;
    newTarget: string;
    updatedAt: string;
  }) => Promise<void> | void;
  className?: string;
}

export function TargetEditor({ row, projectId, jliffRelPath, onSaveSuccess, className }: TargetEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [value, setValue] = useState<string>(row.targetRaw ?? "");
  const [actionState, formAction, isPending] = useActionState(handleSubmit, INITIAL_ACTION_STATE);
  const { toast } = useToast();

  const transunitId = row.segmentId;
  const canEdit = Boolean(transunitId);
  const pristineValue = row.targetRaw ?? "";
  const isDirty = useMemo(() => value !== pristineValue, [pristineValue, value]);

  useEffect(() => {
    startTransition(() => {
      setValue(pristineValue);
    });
  }, [pristineValue, row.key]);

  function resetToRowTarget() {
    setValue(pristineValue);
    queueMicrotask(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        const length = textarea.value.length;
        textarea.focus();
        textarea.setSelectionRange(length, length);
      }
    });
  }

  function copySourceToTarget() {
    setValue(row.sourceRaw ?? "");
    queueMicrotask(() => textareaRef.current?.focus());
  }

  function handlePlaceholderInsert(placeholder: PlaceholderChip) {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    const token = placeholder.token;
    const { selectionStart = 0, selectionEnd = 0 } = textarea;
    const next = `${value.slice(0, selectionStart)}${token}${value.slice(selectionEnd)}`;
    setValue(next);
    queueMicrotask(() => {
      textarea.focus();
      const caret = selectionStart + token.length;
      textarea.setSelectionRange(caret, caret);
    });
  }

  async function handleSubmit(
    prevState: TargetEditorActionState,
    formData: FormData,
  ): Promise<TargetEditorActionState> {
    if (!canEdit) {
      return {
        status: "error",
        message: "Segment is missing transunit metadata and cannot be saved.",
      };
    }

    const nextValue = formData.get("target");
    const nextTarget = typeof nextValue === "string" ? nextValue : "";

    if (nextTarget === pristineValue) {
      return {
        status: "success",
        updatedAt: prevState.updatedAt,
        message: "No changes to save.",
      };
    }

    try {
      const result: UpdateJliffSegmentResult = await updateJliffSegment({
        projectId,
        jliffRelPath,
        transunitId,
        newTarget: nextTarget,
      });
      await onSaveSuccess({
        rowKey: row.key,
        transunitId,
        newTarget: nextTarget,
        updatedAt: result.updatedAt,
      });
      toast({
        title: "Segment saved",
        description: `Segment ${row.key} was saved successfully.`,
      });
      return {
        status: "success",
        updatedAt: result.updatedAt,
        message: `Saved at ${formatTimestamp(result.updatedAt)}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save segment.";
      toast({
        title: "Save failed",
        description: message,
        variant: "destructive",
      });
      return {
        status: "error",
        message,
      };
    }
  }

  const showSuccess = actionState.status === "success" && actionState.message;
  const showError = actionState.status === "error" && actionState.message;

  return (
    <form action={formAction} className={cn("space-y-4", className)} data-segment-key={row.key}>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label
            htmlFor={`${row.key}-target`}
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80"
          >
            Target translation
          </Label>
          {showSuccess ? (
            <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-600">
              {actionState.message}
            </span>
          ) : null}
        </div>
        <Textarea
          id={`${row.key}-target`}
          name="target"
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={!canEdit || isPending}
          spellCheck
          aria-invalid={row.status === "extra" || row.status === "missing"}
          className="min-h-[160px] font-sans"
          data-testid={`target-editor-${row.key}`}
        />
      </div>

      <div className="space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
          Insert placeholder
        </span>
        {row.placeholders.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {row.placeholders.map((placeholder) => (
              <button
                key={placeholder.id}
                type="button"
                className={CHIP_CLASSNAME}
                onClick={() => handlePlaceholderInsert(placeholder)}
                disabled={isPending || !canEdit}
                aria-label={`Insert placeholder ${placeholder.token}`}
              >
                {placeholder.token}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No placeholders recorded for this segment.</p>
        )}
      </div>

      <RowActions
        isDirty={isDirty}
        canEdit={canEdit}
        isPendingExternal={isPending}
        onCopySource={copySourceToTarget}
        onReset={resetToRowTarget}
      />

      {showError ? (
        <Alert variant="destructive" className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{actionState.message}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}

function formatTimestamp(timestamp?: string) {
  if (!timestamp) {
    return "";
  }
  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return timestamp;
    }
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  } catch {
    return timestamp;
  }
}

export default TargetEditor;
