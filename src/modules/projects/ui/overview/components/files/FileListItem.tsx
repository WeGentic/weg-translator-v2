import { useMemo } from "react";

import { IconTooltipButton } from "@/shared/icons";
import type { ProjectFileConversionDto } from "@/core/ipc";
import { FilePenLine, FileText, Loader2, RefreshCw, Trash2 } from "lucide-react";

import { StatusBadge } from "../StatusBadge";

type Props = {
  name: string;
  ext: string;
  size?: number;
  importStatus: string;
  conversions: ProjectFileConversionDto[];
  onOpenEditor: () => void;
  onRebuild: () => void;
  onRemove: () => void;
  isRebuilding?: boolean;
};

export function FileListItem({
  name,
  ext,
  size,
  importStatus,
  conversions,
  onOpenEditor,
  onRebuild,
  onRemove,
  isRebuilding = false,
}: Props) {
  const { visible, remaining } = useMemo(() => {
    const subset = conversions.slice(0, 4);
    return { visible: subset, remaining: Math.max(0, conversions.length - subset.length) };
  }, [conversions]);

  const sizeLabel = useMemo(() => formatSize(size), [size]);
  const extLabel = useMemo(() => formatExt(ext), [ext]);
  const importStatusClass = useMemo(() => {
    if (importStatus === "imported") {
      return "inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[0.65rem] font-medium text-emerald-700 dark:text-emerald-300";
    }
    if (importStatus === "failed") {
      return "inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[0.65rem] font-medium text-destructive";
    }
    return "inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground";
  }, [importStatus]);

  const importStatusLabel = useMemo(() => formatStatus(importStatus), [importStatus]);

  const hasConversions = conversions.length > 0;

  return (
    <li className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border/70 bg-muted/60 text-[0.7rem] font-semibold uppercase text-muted-foreground">
            {extLabel ? extLabel : <FileText aria-hidden="true" className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground" title={name}>
              {name}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <IconTooltipButton label="Open in editor" ariaLabel={`Open ${name} in editor`} onClick={onOpenEditor}>
            <FilePenLine className="h-4 w-4" aria-hidden="true" />
          </IconTooltipButton>
          <IconTooltipButton
            label="Rebuild conversions"
            ariaLabel={`Rebuild conversions for ${name}`}
            onClick={onRebuild}
            tone="muted"
            disabled={!hasConversions || isRebuilding}
          >
            {isRebuilding ? (
              <LoaderIcon />
            ) : (
              <RefreshIcon />
            )}
          </IconTooltipButton>
          <IconTooltipButton
            label="Remove file"
            ariaLabel={`Remove file ${name}`}
            onClick={onRemove}
            tone="destructive"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </IconTooltipButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:text-sm">
        <span className="inline-flex items-center rounded-full border border-border/60 px-2 py-0.5 font-medium uppercase">
          {extLabel || "FILE"}
        </span>
        <span className="inline-flex items-center rounded-full border border-border/60 px-2 py-0.5 font-medium">
          {sizeLabel}
        </span>
        <span className={importStatusClass}>{importStatusLabel}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[0.75rem] text-muted-foreground">
        {visible.length > 0 ? (
          <>
            {visible.map((c) => (
              <StatusBadge key={c.id} conversion={c} />
            ))}
            {remaining > 0 ? (
              <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-[0.7rem] text-muted-foreground">+{remaining} more</span>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground/80">No conversions yet.</span>
        )}
      </div>
    </li>
  );
}

function formatSize(size?: number) {
  if (!size || size <= 0) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 10.24) / 100} KB`;
  return `${Math.round(size / 10485.76) / 100} MB`;
}

function formatStatus(status: string) {
  return status
    .split(/[\s_-]+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatExt(ext: string) {
  if (!ext) return "";
  return ext.replace(/^\./, "").slice(0, 4).toUpperCase();
}

function LoaderIcon() {
  return <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;
}

function RefreshIcon() {
  return <RefreshCw className="h-4 w-4" aria-hidden="true" />;
}

export default FileListItem;
