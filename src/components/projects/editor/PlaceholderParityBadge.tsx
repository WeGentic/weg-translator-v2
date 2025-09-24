import { useMemo } from "react";

import type { PlaceholderCounts, PlaceholderParityStatus } from "@/lib/jliff";
import { cn } from "@/lib/utils";

const STATUS_CLASS_MAP: Record<PlaceholderParityStatus, string> = {
  ok: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
  missing: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  extra: "border-red-500/40 bg-red-500/10 text-red-600",
  unknown: "border-border/60 bg-muted/40 text-muted-foreground",
};

export type PlaceholderParityBadgeProps = {
  counts: PlaceholderCounts;
  status: PlaceholderParityStatus;
};

export function PlaceholderParityBadge({ counts, status }: PlaceholderParityBadgeProps) {
  const { statusLabel, details } = useMemo(() => {
    const label =
      status === "ok"
        ? "Parity OK"
        : status === "missing"
          ? `${counts.missing} placeholder${counts.missing === 1 ? " is" : "s are"} missing in target`
          : status === "extra"
            ? `${counts.extra} extra placeholder${counts.extra === 1 ? "" : "s"} in target`
            : "Placeholder parity unknown";
    const descriptor = `Source ${counts.source} / Target ${counts.target} (missing ${counts.missing}, extra ${counts.extra})`;
    return { statusLabel: label, details: descriptor };
  }, [counts.extra, counts.missing, counts.source, counts.target, status]);

  return (
    <span
      className={cn(
        "inline-flex min-w-[4.25rem] items-center justify-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
        STATUS_CLASS_MAP[status],
      )}
      data-placeholder-status={status}
      title={`${statusLabel}. ${details}.`}
      role="status"
      aria-label={`${statusLabel}. ${details}.`}
    >
      <span className="font-mono text-xs">{counts.source}</span>
      <span className="text-[10px] text-muted-foreground/80">src</span>
      <span className="text-[10px] text-muted-foreground/60">/</span>
      <span className="font-mono text-xs">{counts.target}</span>
      <span className="text-[10px] text-muted-foreground/80">tgt</span>
    </span>
  );
}

export default PlaceholderParityBadge;
