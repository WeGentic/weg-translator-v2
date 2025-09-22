import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import type { ProjectFileConversionDto } from "@/ipc";
import { Trash2 } from "lucide-react";
import { StatusBadge } from "../StatusBadge";

type Props = {
  name: string;
  ext: string;
  size?: number;
  importStatus: string;
  conversions: ProjectFileConversionDto[];
  onOpenEditor: () => void;
  onRemove: () => void;
};

export function FileListItem({ name, ext, size, importStatus, conversions, onOpenEditor, onRemove }: Props) {
  const { visible, remaining } = useMemo(() => {
    const subset = conversions.slice(0, 4);
    return { visible: subset, remaining: Math.max(0, conversions.length - subset.length) };
  }, [conversions]);

  const sizeLabel = useMemo(() => formatSize(size), [size]);
  const importStatusClass = useMemo(() => {
    if (importStatus === "imported") {
      return "inline-flex rounded bg-emerald-500/15 px-2 py-0.5 text-[0.7rem] text-emerald-700 dark:text-emerald-300";
    }
    if (importStatus === "failed") {
      return "inline-flex rounded bg-destructive/10 px-2 py-0.5 text-[0.7rem] text-destructive";
    }
    return "inline-flex rounded bg-muted px-2 py-0.5 text-[0.7rem] text-muted-foreground";
  }, [importStatus]);
  return (
    <li className="flex items-start justify-between gap-3 border-b border-border/60 px-3 py-2 last:border-b-0">
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground" title={name}>
          {name}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{ext}</span>
          <span>•</span>
          <span className="tabular-nums">{sizeLabel}</span>
          <span>•</span>
          <span className={importStatusClass}>
            {importStatus}
          </span>
          {conversions.length > 0 ? <span>•</span> : null}
          {visible.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {visible.map((c) => (
                <StatusBadge key={c.id} conversion={c} />
              ))}
              {remaining > 0 ? (
                <span className="inline-flex rounded bg-muted px-2 py-0.5 text-[0.7rem] text-muted-foreground">+{remaining} more</span>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="outline" onClick={onOpenEditor} aria-label="Open in editor">
          Editor
        </Button>
        <Button size="icon" variant="ghost" onClick={onRemove} aria-label="Remove file">
          <Trash2 className="h-4 w-4" />
        </Button>
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

export default FileListItem;
