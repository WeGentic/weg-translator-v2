import type { ProjectFileConversionDto } from "@/core/ipc";

export function StatusBadge({ conversion }: { conversion: ProjectFileConversionDto }) {
  const color =
    conversion.status === "completed"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : conversion.status === "running"
      ? "bg-primary/10 text-primary"
      : conversion.status === "failed"
      ? "bg-destructive/10 text-destructive"
      : "bg-muted text-muted-foreground";
  const label = `${conversion.srcLang}→${conversion.tgtLang} (${conversion.version}) — ${conversion.status}`;
  return <span className={`inline-flex rounded px-2 py-0.5 text-[0.7rem] ${color}`}>{label}</span>;
}

export default StatusBadge;

