import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertCircle } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import type { UpdateJliffSegmentResult } from "@/ipc";
import { updateJliffSegment } from "@/ipc";
import { extractPlaceholderTokens, type PlaceholderChip, type SegmentRow } from "@/lib/jliff";
import { cn } from "@/lib/utils";

import { RowActions } from "./RowActions";

type EditorMessage = {
  kind: "info" | "warning";
  text: string;
};

const CHIP_CLASSNAME =
  "inline-flex items-center rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const BRACE_BLOCKED_MESSAGE =
  "Structured placeholders must be inserted via the controls below. Press Alt+P to focus the palette.";

const PLACEHOLDER_HINT_DEFAULT = "Use placeholder controls or Alt+P to insert structured tokens.";

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

function sanitizeTargetInput(rawValue: string): { value: string; sanitized: boolean } {
  if (!rawValue) {
    return { value: "", sanitized: false };
  }

  let sanitized = false;
  let index = 0;
  let result = "";

  while (index < rawValue.length) {
    if (rawValue.startsWith("{{", index)) {
      const closing = rawValue.indexOf("}}", index + 2);
      if (closing !== -1) {
        result += rawValue.slice(index, closing + 2);
        index = closing + 2;
        continue;
      }
    }

    const char = rawValue[index];
    if (char === "{" || char === "}") {
      sanitized = true;
      index += 1;
      continue;
    }

    result += char;
    index += 1;
  }

  if (!sanitized && result !== rawValue) {
    sanitized = true;
  }

  return {
    value: result,
    sanitized,
  };
}

function collectMissingPlaceholders(placeholders: PlaceholderChip[], targetValue: string): PlaceholderChip[] {
  if (placeholders.length === 0) {
    return [];
  }
  const tokens = extractPlaceholderTokens(targetValue);
  if (tokens.length === 0) {
    return [...placeholders];
  }

  const targetCounts = new Map<string, number>();
  for (const token of tokens) {
    targetCounts.set(token, (targetCounts.get(token) ?? 0) + 1);
  }

  const consumed = new Map<string, number>();
  const missing: PlaceholderChip[] = [];

  for (const placeholder of placeholders) {
    const token = placeholder.token;
    const used = consumed.get(token) ?? 0;
    const available = targetCounts.get(token) ?? 0;

    if (used < available) {
      consumed.set(token, used + 1);
    } else {
      consumed.set(token, used + 1);
      missing.push(placeholder);
    }
  }

  return missing;
}

export function TargetEditor({ row, projectId, jliffRelPath, onSaveSuccess, className }: TargetEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const placeholderRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [value, setValue] = useState<string>(row.targetRaw ?? "");
  const [editorMessage, setEditorMessage] = useState<EditorMessage | null>(null);
  const [actionState, formAction, isPending] = useActionState(handleSubmit, INITIAL_ACTION_STATE);
  const { toast } = useToast();

  const transunitId = row.segmentId;
  const canEdit = Boolean(transunitId);
  const pristineValue = row.targetRaw ?? "";
  const isDirty = useMemo(() => value !== pristineValue, [pristineValue, value]);
  const instructionsId = `${row.key}-target-instructions`;
  const liveRegionId = `${row.key}-target-live`;

  const missingPlaceholders = useMemo(
    () => collectMissingPlaceholders(row.placeholders, value),
    [row.placeholders, value],
  );

  useEffect(() => {
    startTransition(() => {
      setValue(pristineValue);
      setEditorMessage(null);
      placeholderRefs.current = [];
    });
  }, [pristineValue, row.key]);

  const registerPlaceholderRef = useCallback(
    (index: number) => (node: HTMLButtonElement | null) => {
      placeholderRefs.current[index] = node;
    },
    [],
  );

  const focusFirstPlaceholder = useCallback(() => {
    const storedTarget = placeholderRefs.current.find((button) => Boolean(button) && !button?.disabled);
    if (storedTarget) {
      storedTarget.focus();
      return true;
    }

    const ownerForm = textareaRef.current?.form ?? textareaRef.current?.closest("form");
    const fallbackTarget = ownerForm?.querySelector<HTMLButtonElement>("button[data-placeholder-chip]");
    if (fallbackTarget) {
      fallbackTarget.focus();
      return true;
    }

    return false;
  }, []);

  const applyInsertion = useCallback(
    (text: string, options?: { surroundWithSpaces?: boolean }) => {
      const textarea = textareaRef.current;
      const selectionStart = textarea?.selectionStart ?? value.length;
      const selectionEnd = textarea?.selectionEnd ?? selectionStart;
      const before = value.slice(0, selectionStart);
      const after = value.slice(selectionEnd);

      let insertion = text;
      if (options?.surroundWithSpaces) {
        const needsLeadingSpace = before !== "" && !/\s$/.test(before);
        const needsTrailingSpace = after !== "" && !/^\s/.test(after);
        insertion = `${needsLeadingSpace ? " " : ""}${insertion}${needsTrailingSpace ? " " : ""}`;
      }

      const nextValue = `${before}${insertion}${after}`;
      setValue(nextValue);

      queueMicrotask(() => {
        const textareaNode = textareaRef.current;
        if (!textareaNode) {
          return;
        }
        const caret = before.length + insertion.length;
        textareaNode.focus();
        textareaNode.setSelectionRange(caret, caret);
      });
    },
    [value],
  );

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
    setEditorMessage(null);
  }

  function copySourceToTarget() {
    setValue(row.sourceRaw ?? "");
    queueMicrotask(() => textareaRef.current?.focus());
    setEditorMessage({
      kind: "info",
      text: "Source text copied. Review placeholders before saving.",
    });
  }

  function handlePlaceholderInsert(placeholder: PlaceholderChip) {
    applyInsertion(placeholder.token);
    setEditorMessage({
      kind: "info",
      text: `Inserted ${placeholder.token} at the caret position.`,
    });
  }

  const handleInsertMissingPlaceholders = useCallback(() => {
    if (missingPlaceholders.length === 0) {
      setEditorMessage({
        kind: "info",
        text: "Target already includes all recorded placeholders.",
      });
      return;
    }
    const insertion = missingPlaceholders.map((placeholder) => placeholder.token).join(" ");
    applyInsertion(insertion, { surroundWithSpaces: true });
    setEditorMessage({
      kind: "info",
      text:
        missingPlaceholders.length === 1
          ? "Inserted one missing placeholder at the caret."
          : `Inserted ${missingPlaceholders.length} missing placeholders at the caret.`,
    });
  }, [applyInsertion, missingPlaceholders]);

  const handleBeforeInput = useCallback(
    (event: React.FormEvent<HTMLTextAreaElement>) => {
      const nativeEvent = event.nativeEvent as InputEvent | undefined;
      if (!nativeEvent || nativeEvent.inputType !== "insertText") {
        return;
      }
      if (nativeEvent.data === "{" || nativeEvent.data === "}") {
        event.preventDefault();
        const moved = focusFirstPlaceholder();
        setEditorMessage({
          kind: "warning",
          text: moved ? BRACE_BLOCKED_MESSAGE : "No placeholders recorded for this segment.",
        });
      }
    },
    [focusFirstPlaceholder],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        const moved = focusFirstPlaceholder();
        setEditorMessage({
          kind: moved ? "info" : "warning",
          text: moved
            ? "Placeholder chips focused. Press Enter or Space on a chip to insert it."
            : "No placeholders recorded for this segment.",
        });
      }
    },
    [focusFirstPlaceholder],
  );

  function handleTextareaChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const rawValue = event.target.value;
    const { value: sanitizedValue, sanitized } = sanitizeTargetInput(rawValue);
    setValue(sanitizedValue);
    if (sanitized) {
      setEditorMessage({
        kind: "warning",
        text: BRACE_BLOCKED_MESSAGE,
      });
    } else if (!editorMessage || editorMessage.kind === "warning") {
      setEditorMessage(null);
    }
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
      setEditorMessage(null);
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
  const liveRegionRole = editorMessage?.kind === "warning" ? "alert" : "status";
  const liveRegionClassName = cn(
    "text-xs",
    editorMessage?.kind === "warning" ? "text-amber-600" : "text-muted-foreground",
    !editorMessage && "sr-only",
  );
  const liveRegionText = editorMessage?.text ?? PLACEHOLDER_HINT_DEFAULT;

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
          onChange={handleTextareaChange}
          onBeforeInput={handleBeforeInput}
          onKeyDown={handleKeyDown}
          disabled={!canEdit || isPending}
          spellCheck
          aria-invalid={row.status === "extra" || row.status === "missing"}
          aria-describedby={`${instructionsId} ${liveRegionId}`}
          className="min-h-[160px] font-sans"
          data-testid={`target-editor-${row.key}`}
        />
        <p
          id={instructionsId}
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70"
        >
          Press Alt+P to focus placeholder chips. Braces cannot be typed directly.
        </p>
        <div
          id={liveRegionId}
          role={liveRegionRole}
          aria-live="polite"
          className={liveRegionClassName}
        >
          {liveRegionText}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
          Insert placeholder
        </span>
        {row.placeholders.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {row.placeholders.map((placeholder, index) => (
              <button
                key={placeholder.id}
                type="button"
                className={CHIP_CLASSNAME}
                onClick={() => handlePlaceholderInsert(placeholder)}
                disabled={isPending || !canEdit}
                aria-label={`Insert placeholder ${placeholder.token}`}
                ref={registerPlaceholderRef(index)}
                data-placeholder-chip
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
        onInsertMissingPlaceholders={handleInsertMissingPlaceholders}
        missingPlaceholderCount={missingPlaceholders.length}
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
